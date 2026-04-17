import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm7BriefingChange } from "@/lib/proline-form";
import { parseReservationDate } from "@/lib/slp/parse-reservation-date";
import { ensureZoomMeetingForReservation } from "@/lib/slp/zoom-reservation-handler";
import { applyProlineChangeToSession } from "@/lib/slp/session-helper";

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

    // LINE友達情報（紹介者通知用に共通取得）
    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid },
      select: { id: true, snsname: true, phone: true, free1: true },
    });

    // 共通の更新データ
    const updateData = {
      briefingStatus: "予約中" as const,
      briefingBookedAt:
        briefingBookedAt && !isNaN(briefingBookedAt.getTime())
          ? briefingBookedAt
          : undefined,
      briefingDate:
        briefingDateParsed && !isNaN(briefingDateParsed.getTime())
          ? briefingDateParsed
          : undefined,
      briefingStaff: briefingStaff || undefined,
      briefingStaffId: briefingStaff ? resolvedStaffId : undefined,
      briefingChangedAt: new Date(),
      // 再予約時のキャンセルクリア
      briefingCanceledAt: null,
    };

    let updatedCount = 0;
    const changedRecordIds: number[] = [];

    // 1. bookingId で予約ID一致のレコードを優先的に検索
    // メインの reservationId だけでなく、マージで取り込まれた配列も検索対象に
    if (bookingId) {
      const targets = await prisma.slpCompanyRecord.findMany({
        where: {
          OR: [
            { reservationId: bookingId },
            { mergedBriefingReservationIds: { has: bookingId } },
          ],
          deletedAt: null,
        },
        select: { id: true },
      });
      if (targets.length > 0) {
        const ids = targets.map((t) => t.id);
        const result = await prisma.slpCompanyRecord.updateMany({
          where: { id: { in: ids } },
          data: updateData,
        });
        updatedCount = result.count;
        changedRecordIds.push(...ids);
      }
    }

    // 2. 見つからなかった場合はログだけ残して終了
    // （uidベースのフォールバック／新規作成は撤去: Webhook到着順逆転時に
    //  別の新規予約を古い変更データで上書きする事故が発生していたため。
    //  予約Webhookが先に届いていないケースは automation_errors から手動復旧する）
    if (updatedCount === 0) {
      await logAutomationError({
        source: "slp-briefing-change",
        message: `bookingId=${bookingId} に該当する予約レコードが見つかりません（uidフォールバック／新規作成は実行せず）`,
        detail: { bookingId, uid },
      });
      return NextResponse.json(
        { success: false, error: "対象の予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    // 履歴記録（変更）
    if (changedRecordIds.length > 0) {
      await prisma.slpReservationHistory.createMany({
        data: changedRecordIds.map((recordId) => ({
          companyRecordId: recordId,
          reservationType: "briefing",
          actionType: "変更",
          reservationId: bookingId ?? null,
          reservedAt: briefingDateParsed,
          bookedAt: briefingBookedAt,
          staffName: briefingStaff || null,
          staffId: resolvedStaffId,
        })),
      });
    }

    // 並列書き込み: SlpMeetingSession にも記録（セッション再設計Phase 1）
    for (const recordId of changedRecordIds) {
      try {
        await prisma.$transaction(async (tx) => {
          await applyProlineChangeToSession(
            recordId,
            "briefing",
            {
              scheduledAt: briefingDateParsed,
              assignedStaffId: resolvedStaffId,
              prolineReservationId: bookingId ?? null,
              bookedAt: briefingBookedAt,
            },
            tx
          );
        });
      } catch (err) {
        await logAutomationError({
          source: "slp-briefing-change-session",
          message: `セッション並列書き込み失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    // Zoom会議を更新 → プロライン経由でお客様に変更通知LINE送信（fire-and-forget）
    for (const recordId of changedRecordIds) {
      ensureZoomMeetingForReservation({
        companyRecordId: recordId,
        category: "briefing",
        triggerReason: "change",
      }).catch(async (err) => {
        await logAutomationError({
          source: "slp-briefing-change-zoom",
          message: `Zoom更新フロー失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      });
    }

    // 紹介者通知（form7）— 紹介者がいれば fire-and-forget で送信
    const referrerUid = lineFriend?.free1?.trim();
    const snsname = lineFriend?.snsname;
    if (referrerUid && snsname) {
      submitForm7BriefingChange(
        referrerUid,
        snsname,
        briefingDate ?? ""
      ).catch(async (err) => {
        await logAutomationError({
          source: "slp-briefing-change-form7",
          message: `概要案内変更通知（form7）送信失敗: referrerUid=${referrerUid}, snsname=${snsname}`,
          detail: {
            error: err instanceof Error ? err.message : String(err),
            referrerUid,
            snsname,
            briefingDate: briefingDate ?? "",
            retryAction: "form7-briefing-change",
          },
        });
      });
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
