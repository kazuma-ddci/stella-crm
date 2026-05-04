import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { applyProlineCancelToSession } from "@/lib/slp/session-helper";
import { handleSessionStatusChangeSideEffects } from "@/lib/slp/session-lifecycle";

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

    // bookingId でセッションを検索してcompanyRecordId一覧を取得
    if (bookingId) {
      const targetSessions = await prisma.slpMeetingSession.findMany({
        where: {
          prolineReservationId: bookingId,
          category: "consultation",
          deletedAt: null,
        },
        select: {
          status: true,
          companyRecordId: true,
          scheduledAt: true,
          bookedAt: true,
          assignedStaffId: true,
          assignedStaff: { select: { name: true } },
        },
      });
      const activeTargetSessions = targetSessions.filter((s) => s.status !== "キャンセル");
      const uniqueRecordIds = [...new Set(activeTargetSessions.map((s) => s.companyRecordId))];

      if (targetSessions.length > 0 && activeTargetSessions.length === 0) {
        return NextResponse.json({
          success: true,
          action: "noop",
          canceledCount: 0,
        });
      }

      if (uniqueRecordIds.length > 0) {
        canceledRecordIds.push(...uniqueRecordIds);
        canceledCount = uniqueRecordIds.length;

        await prisma.slpReservationHistory.createMany({
          data: activeTargetSessions.map((s) => ({
            companyRecordId: s.companyRecordId,
            reservationType: "consultation",
            actionType: "キャンセル",
            reservationId: bookingId,
            reservedAt: s.scheduledAt,
            bookedAt: s.bookedAt,
            staffName: s.assignedStaff?.name ?? null,
            staffId: s.assignedStaffId,
          })),
        });
      }
    }

    // 見つからなかった場合はログだけ残して終了
    if (canceledCount === 0) {
      await logAutomationError({
        source: "slp-consultation-cancel",
        message: `bookingId=${bookingId} に該当する導入希望商談予約レコードが見つかりません`,
        detail: { bookingId, uid },
      });
      return NextResponse.json(
        { success: false, error: "対象の導入希望商談予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    // セッションテーブル更新 → 副作用処理（キャンセル通知）
    for (const recordId of canceledRecordIds) {
      try {
        const applied = await prisma.$transaction(async (tx) => {
          return applyProlineCancelToSession(
            recordId,
            "consultation",
            bookingId ?? null,
            "プロラインwebhookによるキャンセル",
            tx
          );
        });

        if (applied?.action === "cancelled") {
          const cancelledSession = applied.session;
          // 副作用処理（内部でZoom削除 + キャンセル通知）
          handleSessionStatusChangeSideEffects({
            sessionId: cancelledSession.id,
            newStatus: "キャンセル",
            category: "consultation",
          }).catch(async (err) => {
            await logAutomationError({
              source: "slp-consultation-cancel-side-effects",
              message: `キャンセル副作用処理失敗: sessionId=${cancelledSession.id}`,
              detail: { error: err instanceof Error ? err.message : String(err) },
            });
          });
        }
      } catch (err) {
        await logAutomationError({
          source: "slp-consultation-cancel-session",
          message: `セッション並列書き込み失敗: companyRecordId=${recordId}`,
          detail: { error: err instanceof Error ? err.message : String(err) },
        });
      }
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
