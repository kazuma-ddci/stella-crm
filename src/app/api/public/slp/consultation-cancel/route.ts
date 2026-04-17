import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { cancelZoomMeetingForReservation } from "@/lib/slp/zoom-reservation-handler";
import { applyProlineCancelToSession } from "@/lib/slp/session-helper";

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
 *   3. 見つからない場合は automation_errors にログを残して終了
 *      （過去に存在した uid ベースのフォールバックは、Webhook到着順逆転時に
 *       別の新規予約を誤キャンセルする事故を起こしたため撤去）
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

    // 2. 見つからなかった場合はログだけ残して終了
    // （uidベースのフォールバックは撤去: Webhook到着順逆転時に別の新規予約を
    //  誤ってキャンセルする事故が発生していたため）
    if (canceledCount === 0) {
      await logAutomationError({
        source: "slp-consultation-cancel",
        message: `bookingId=${bookingId} に該当する導入希望商談予約レコードが見つかりません（uidフォールバックは実行せず）`,
        detail: { bookingId, uid },
      });
      return NextResponse.json(
        { success: false, error: "対象の導入希望商談予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    // 並列書き込み: SlpMeetingSession にもキャンセル記録（セッション再設計Phase 1）
    for (const recordId of canceledRecordIds) {
      try {
        await prisma.$transaction(async (tx) => {
          await applyProlineCancelToSession(
            recordId,
            "consultation",
            bookingId ?? null,
            "プロラインwebhookによるキャンセル",
            tx
          );
        });
      } catch (err) {
        await logAutomationError({
          source: "slp-consultation-cancel-session",
          message: `セッション並列書き込み失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      }
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
      action: "canceled_by_id",
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
