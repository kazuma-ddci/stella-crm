import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { parseReservationDate } from "@/lib/slp/parse-reservation-date";
import { applyProlineChangeToSession } from "@/lib/slp/session-helper";
import { handleSessionReservationSideEffects } from "@/lib/slp/session-lifecycle";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから概要案内予約変更時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl1-booking-id]])
 *   booked: 予約日 ([[cl1-booking-create]])
 *   briefingDate: 概要案内日 ([[cl1-booking-start]])
 *   briefingStaff: 概要案内担当者 ([[cl1-booking-staff]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. bookingId で reservationId が一致する全レコードを検索（複製対応）
 *   2. 見つかった全レコードを updateMany で一括更新
 *   3. 見つからない場合は automation_errors にログを残して終了
 *      （過去に存在した uid ベースのフォールバック／新規作成は、Webhook到着順
 *        逆転時に別の新規予約を誤って上書きする事故を起こしたため撤去）
 *
 * 重要:
 *   同じ予約IDが複数レコードに紐付いている場合（CRMで案件分割した時）、
 *   全レコードがまとめて変更される（ユーザー要件）。
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const bookingId = searchParams.get("bookingId");
  const booked = searchParams.get("booked");
  const briefingDate = searchParams.get("briefingDate");
  const briefingStaff = searchParams.get("briefingStaff");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // プロライン担当者マッピングを解決
    let resolvedStaffId: number | null = null;
    if (briefingStaff) {
      const mapping = await prisma.slpProlineStaffMapping.findUnique({
        where: { prolineStaffName: briefingStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;

      if (!mapping) {
        await logAutomationError({
          source: "slp-briefing-change",
          message: `マッピング未登録のプロライン担当者名を受信: "${briefingStaff}"`,
          detail: {
            prolineStaffName: briefingStaff,
            uid,
            bookingId: bookingId ?? null,
            hint: "/slp/settings/proline-staff でマッピングを追加してください",
          },
        });
      }
    }

    // 日付パース（プロラインの複数フォーマットに対応）
    const briefingBookedAt = parseReservationDate(booked);
    const briefingDateParsed = parseReservationDate(briefingDate);

    if (booked && !briefingBookedAt) {
      await logAutomationError({
        source: "slp-briefing-change",
        message: `booked(予約作成日時)の日付形式がパースできません: "${booked}"`,
        detail: { uid, bookingId: bookingId ?? null, rawBooked: booked },
      });
    }
    if (briefingDate && !briefingDateParsed) {
      await logAutomationError({
        source: "slp-briefing-change",
        message: `briefingDate(概要案内日)の日付形式がパースできません: "${briefingDate}"`,
        detail: {
          uid,
          bookingId: bookingId ?? null,
          rawBriefingDate: briefingDate,
        },
      });
    }

    let updatedCount = 0;
    const changedRecordIds: number[] = [];

    // bookingId でセッションを検索してcompanyRecordIdを特定
    if (bookingId) {
      const targetSessions = await prisma.slpMeetingSession.findMany({
        where: {
          prolineReservationId: bookingId,
          category: "briefing",
          deletedAt: null,
        },
        select: { companyRecordId: true, prolineReservationId: true },
      });
      const uniqueRecordIds = [...new Set(targetSessions.map((s) => s.companyRecordId))];
      if (uniqueRecordIds.length > 0) {
        changedRecordIds.push(...uniqueRecordIds);
        updatedCount = uniqueRecordIds.length;
      }
    }

    if (updatedCount === 0 && uid) {
      const contactCompanyIds = await prisma.slpCompanyContact.findMany({
        where: { lineFriend: { uid }, companyRecord: { deletedAt: null } },
        select: { companyRecordId: true },
      });
      const companyIds = [...new Set(contactCompanyIds.map((c) => c.companyRecordId))];
      const activeSessions =
        companyIds.length > 0
          ? await prisma.slpMeetingSession.findMany({
              where: {
                companyRecordId: { in: companyIds },
                category: "briefing",
                status: "予約中",
                deletedAt: null,
              },
              select: { companyRecordId: true, prolineReservationId: true },
            })
          : [];
      const activeReservationIds = [
        ...new Set(activeSessions.map((s) => s.prolineReservationId).filter(Boolean)),
      ];
      if (activeSessions.length > 0 && activeReservationIds.length <= 1) {
        const uniqueRecordIds = [...new Set(activeSessions.map((s) => s.companyRecordId))];
        changedRecordIds.push(...uniqueRecordIds);
        updatedCount = uniqueRecordIds.length;
      } else if (activeSessions.length > 0) {
        await logAutomationError({
          source: "slp-briefing-change",
          message: "変更対象の予約中セッションが複数あり特定できません",
          detail: { uid, bookingId, activeReservationIds },
        });
        return NextResponse.json(
          { success: false, error: "変更対象の予約が複数あり特定できません" },
          { status: 409 }
        );
      }
    }

    // 見つからなかった場合はログだけ残して終了
    if (updatedCount === 0) {
      await logAutomationError({
        source: "slp-briefing-change",
        message: `bookingId=${bookingId} に該当する予約レコードが見つかりません`,
        detail: { bookingId, uid },
      });
      return NextResponse.json(
        { success: false, error: "対象の予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    // セッションテーブル更新 → 副作用処理（Zoom更新 + LINE通知 + 紹介者通知）
    for (const recordId of changedRecordIds) {
      try {
        // 変更リクエストを発した担当者（LINE UIDから逆引き）
        let bookerContactId: number | null = null;
        if (uid) {
          const c = await prisma.slpCompanyContact.findFirst({
            where: { companyRecordId: recordId, lineFriend: { uid } },
            select: { id: true },
          });
          bookerContactId = c?.id ?? null;
        }

        const applied = await prisma.$transaction(async (tx) => {
          return applyProlineChangeToSession(
            recordId,
            "briefing",
            {
              scheduledAt: briefingDateParsed,
              assignedStaffId: resolvedStaffId,
              prolineReservationId: bookingId ?? null,
              prolineStaffName: briefingStaff || null,
              bookedAt: briefingBookedAt,
              bookerContactId,
            },
            tx
          );
        });
        const updatedSession = applied.session;

        if (applied.action !== "noop") {
          await prisma.slpReservationHistory.create({
            data: {
              companyRecordId: recordId,
              reservationType: "briefing",
              actionType: "変更",
              reservationId: bookingId ?? null,
              reservedAt: briefingDateParsed,
              bookedAt: briefingBookedAt,
              staffName: briefingStaff || null,
              staffId: resolvedStaffId,
            },
          });

          handleSessionReservationSideEffects({
            sessionId: updatedSession.id,
            companyRecordId: recordId,
            category: "briefing",
            triggerReason: "change",
            roundNumber: updatedSession.roundNumber,
            notifyReferrer: true,
          }).catch(async (err) => {
            await logAutomationError({
              source: "slp-briefing-change-side-effects",
              message: `変更副作用処理失敗: sessionId=${updatedSession.id}`,
              detail: { error: err instanceof Error ? err.message : String(err) },
            });
          });
        }
      } catch (err) {
        await logAutomationError({
          source: "slp-briefing-change-session",
          message: `セッション並列書き込み失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    return NextResponse.json({
      success: true,
      action: "updated_by_id",
      updatedCount,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-briefing-change",
      message: `概要案内変更Webhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
