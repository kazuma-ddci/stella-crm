import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { cancelZoomMeetingForReservation } from "@/lib/slp/zoom-reservation-handler";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

/**
 * プロラインフリーから導入希望商談予約キャンセル時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl2-booking-id]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. bookingId で consultationReservationId 一致のレコードを検索
 *   2. 該当する全レコードを updateMany で一括キャンセル（複製対応）
 *   3. 見つからない場合は uid ベースでフォールバック
 */
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const bookingId = searchParams.get("bookingId");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    let canceledCount = 0;
    let action: "canceled_by_id" | "canceled_by_uid" = "canceled_by_uid";
    const canceledRecordIds: number[] = [];

    // 1. bookingId で予約ID一致のレコードを優先的にキャンセル
    // メインの consultationReservationId だけでなく、マージで取り込まれた配列も検索対象に
    if (bookingId) {
      // 履歴記録用に、クリア前の値を取得
      const targets = await prisma.slpCompanyRecord.findMany({
        where: {
          OR: [
            { consultationReservationId: bookingId },
            { mergedConsultationReservationIds: { has: bookingId } },
          ],
          deletedAt: null,
        },
        select: {
          id: true,
          consultationReservationId: true,
          consultationDate: true,
          consultationBookedAt: true,
          consultationStaff: true,
          consultationStaffId: true,
        },
      });

      if (targets.length > 0) {
        const ids = targets.map((t) => t.id);
        const result = await prisma.slpCompanyRecord.updateMany({
          where: { id: { in: ids } },
          data: {
            consultationStatus: "キャンセル",
            consultationCanceledAt: new Date(),
            // 予約日時・商談日時・担当者・予約IDをクリア（履歴は別テーブルに残す）
            consultationBookedAt: null,
            consultationDate: null,
            consultationStaff: null,
            consultationStaffId: null,
            consultationReservationId: null,
          },
        });
        canceledCount = result.count;
        action = "canceled_by_id";
        canceledRecordIds.push(...ids);

        await prisma.slpReservationHistory.createMany({
          data: targets.map((t) => ({
            companyRecordId: t.id,
            reservationType: "consultation",
            actionType: "キャンセル",
            reservationId: t.consultationReservationId ?? bookingId,
            reservedAt: t.consultationDate,
            bookedAt: t.consultationBookedAt,
            staffName: t.consultationStaff,
            staffId: t.consultationStaffId,
          })),
        });
      }
    }

    // 2. フォールバック: uid + 直近のアクティブレコード
    if (canceledCount === 0) {
      const target = await prisma.slpCompanyRecord.findFirst({
        where: {
          prolineUid: uid,
          consultationCanceledAt: null,
          deletedAt: null,
        },
        orderBy: { id: "desc" },
        select: {
          id: true,
          consultationReservationId: true,
          consultationDate: true,
          consultationBookedAt: true,
          consultationStaff: true,
          consultationStaffId: true,
        },
      });

      if (!target) {
        return NextResponse.json(
          { success: false, error: "対象の導入希望商談予約レコードが見つかりません" },
          { status: 404 }
        );
      }

      await prisma.slpCompanyRecord.update({
        where: { id: target.id },
        data: {
          consultationStatus: "キャンセル",
          consultationCanceledAt: new Date(),
          consultationBookedAt: null,
          consultationDate: null,
          consultationStaff: null,
          consultationStaffId: null,
          consultationReservationId: null,
        },
      });
      canceledCount = 1;
      action = "canceled_by_uid";
      canceledRecordIds.push(target.id);

      await prisma.slpReservationHistory.create({
        data: {
          companyRecordId: target.id,
          reservationType: "consultation",
          actionType: "キャンセル",
          reservationId: target.consultationReservationId ?? bookingId,
          reservedAt: target.consultationDate,
          bookedAt: target.consultationBookedAt,
          staffName: target.consultationStaff,
          staffId: target.consultationStaffId,
        },
      });

      await logAutomationError({
        source: "slp-consultation-cancel",
        message: `予約IDで一致するレコードが見つからずuidベースでキャンセル: bookingId=${bookingId}, uid=${uid}`,
        detail: { bookingId, uid, targetId: target.id },
      });
    }

    // Zoom会議を削除（fire-and-forget）
    for (const recordId of canceledRecordIds) {
      cancelZoomMeetingForReservation({
        companyRecordId: recordId,
        category: "consultation",
      }).catch(async (err) => {
        await logAutomationError({
          source: "slp-consultation-cancel-zoom",
          message: `Zoomキャンセルフロー失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      });
    }

    return NextResponse.json({
      success: true,
      action,
      canceledCount,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-consultation-cancel",
      message: `導入希望商談キャンセルWebhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
