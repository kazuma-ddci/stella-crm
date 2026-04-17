import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
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

    const updateData = {
      consultationStatus: "予約中" as const,
      consultationBookedAt: consultationBookedAt ?? undefined,
      consultationDate: consultationDateParsed ?? undefined,
      consultationStaff: consultationStaff || undefined,
      consultationStaffId: consultationStaff ? resolvedStaffId : undefined,
      consultationChangedAt: new Date(),
      consultationCanceledAt: null,
    };

    let updatedCount = 0;
    const changedRecordIds: number[] = [];

    // 1. bookingId で予約ID一致のレコードを優先的に検索
    // メインの consultationReservationId だけでなく、マージで取り込まれた配列も検索対象に
    if (bookingId) {
      const targets = await prisma.slpCompanyRecord.findMany({
        where: {
          OR: [
            { consultationReservationId: bookingId },
            { mergedConsultationReservationIds: { has: bookingId } },
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
        source: "slp-consultation-change",
        message: `bookingId=${bookingId} に該当する導入希望商談予約レコードが見つかりません（uidフォールバック／新規作成は実行せず）`,
        detail: { bookingId, uid },
      });
      return NextResponse.json(
        { success: false, error: "対象の導入希望商談予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    // 履歴記録（変更）
    if (changedRecordIds.length > 0) {
      await prisma.slpReservationHistory.createMany({
        data: changedRecordIds.map((recordId) => ({
          companyRecordId: recordId,
          reservationType: "consultation",
          actionType: "変更",
          reservationId: bookingId ?? null,
          reservedAt: consultationDateParsed,
          bookedAt: consultationBookedAt,
          staffName: consultationStaff || null,
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
            "consultation",
            {
              scheduledAt: consultationDateParsed,
              assignedStaffId: resolvedStaffId,
              prolineReservationId: bookingId ?? null,
              bookedAt: consultationBookedAt,
            },
            tx
          );
        });
      } catch (err) {
        await logAutomationError({
          source: "slp-consultation-change-session",
          message: `セッション並列書き込み失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    // Zoom会議を更新 → プロライン経由でお客様に変更通知LINE送信（fire-and-forget）
    for (const recordId of changedRecordIds) {
      ensureZoomMeetingForReservation({
        companyRecordId: recordId,
        category: "consultation",
        triggerReason: "change",
      }).catch(async (err) => {
        await logAutomationError({
          source: "slp-consultation-change-zoom",
          message: `Zoom更新フロー失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
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
      source: "slp-consultation-change",
      message: `導入希望商談変更Webhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
