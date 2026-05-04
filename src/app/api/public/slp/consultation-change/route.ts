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
 * プロラインフリーから導入希望商談予約変更時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl2-booking-id]])
 *   booked: 予約日 ([[cl2-booking-create]])
 *   consultationDate: 導入希望商談日 ([[cl2-booking-start]])
 *   consultationStaff: 導入希望商談担当者 ([[cl2-booking-staff]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. bookingId で consultationReservationId 一致のレコードを検索
 *   2. 該当する全レコードを updateMany で一括更新（複製対応）
 *   3. 見つからない場合は automation_errors にログを残して終了
 *      （過去に存在した uid ベースのフォールバック／新規作成は、Webhook到着順
 *        逆転時に別の新規予約を誤って上書きする事故を起こしたため撤去）
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const bookingId = searchParams.get("bookingId");
  const booked = searchParams.get("booked");
  const consultationDate = searchParams.get("consultationDate");
  const consultationStaff = searchParams.get("consultationStaff");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    // プロライン担当者マッピング解決
    let resolvedStaffId: number | null = null;
    if (consultationStaff) {
      const mapping = await prisma.slpProlineStaffMapping.findUnique({
        where: { prolineStaffName: consultationStaff },
        select: { staffId: true },
      });
      resolvedStaffId = mapping?.staffId ?? null;

      if (!mapping) {
        await logAutomationError({
          source: "slp-consultation-change",
          message: `マッピング未登録のプロライン担当者名を受信: "${consultationStaff}"`,
          detail: {
            prolineStaffName: consultationStaff,
            uid,
            bookingId: bookingId ?? null,
            hint: "/slp/settings/proline-staff でマッピングを追加してください",
          },
        });
      }
    }

    // 日付パース（プロラインの複数フォーマットに対応）
    const consultationBookedAt = parseReservationDate(booked);
    const consultationDateParsed = parseReservationDate(consultationDate);

    if (booked && !consultationBookedAt) {
      await logAutomationError({
        source: "slp-consultation-change",
        message: `booked(予約作成日時)の日付形式がパースできません: "${booked}"`,
        detail: { uid, bookingId: bookingId ?? null, rawBooked: booked },
      });
    }
    if (consultationDate && !consultationDateParsed) {
      await logAutomationError({
        source: "slp-consultation-change",
        message: `consultationDate(商談日)の日付形式がパースできません: "${consultationDate}"`,
        detail: {
          uid,
          bookingId: bookingId ?? null,
          rawConsultationDate: consultationDate,
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
          category: "consultation",
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
                category: "consultation",
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
          source: "slp-consultation-change",
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
        source: "slp-consultation-change",
        message: `bookingId=${bookingId} に該当する導入希望商談予約レコードが見つかりません`,
        detail: { bookingId, uid },
      });
      return NextResponse.json(
        { success: false, error: "対象の導入希望商談予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    // セッションテーブル更新 → 副作用処理（Zoom更新 + LINE通知）
    // 導入希望商談では紹介者通知は送らない
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
            "consultation",
            {
              scheduledAt: consultationDateParsed,
              assignedStaffId: resolvedStaffId,
              prolineReservationId: bookingId ?? null,
              prolineStaffName: consultationStaff || null,
              bookedAt: consultationBookedAt,
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
              reservationType: "consultation",
              actionType: "変更",
              reservationId: bookingId ?? null,
              reservedAt: consultationDateParsed,
              bookedAt: consultationBookedAt,
              staffName: consultationStaff || null,
              staffId: resolvedStaffId,
            },
          });

          handleSessionReservationSideEffects({
            sessionId: updatedSession.id,
            companyRecordId: recordId,
            category: "consultation",
            triggerReason: "change",
            roundNumber: updatedSession.roundNumber,
            notifyReferrer: false,
          }).catch(async (err) => {
            await logAutomationError({
              source: "slp-consultation-change-side-effects",
              message: `変更副作用処理失敗: sessionId=${updatedSession.id}`,
              detail: { error: err instanceof Error ? err.message : String(err) },
            });
          });
        }
      } catch (err) {
        await logAutomationError({
          source: "slp-consultation-change-session",
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
      source: "slp-consultation-change",
      message: `導入希望商談変更Webhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
