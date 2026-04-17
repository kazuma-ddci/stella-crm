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
 * プロラインフリーから概要案内予約キャンセル時に呼ばれるWebhook（中継URL方式対応版）
 *
 * クエリパラメータ:
 *   uid: ユーザーID ([[uid]])
 *   bookingId: 予約ID ([[cl1-booking-id]])
 *   secret: 認証用シークレット
 *
 * 動作:
 *   1. bookingId で reservationId が一致する全レコードを検索
 *   2. 見つかった全レコードを updateMany で一括キャンセル（複製対応）
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
          category: "briefing",
          deletedAt: null,
        },
        select: {
          companyRecordId: true,
          scheduledAt: true,
          bookedAt: true,
          assignedStaffId: true,
          assignedStaff: { select: { name: true } },
        },
      });
      const uniqueRecordIds = [...new Set(targetSessions.map((s) => s.companyRecordId))];

      if (uniqueRecordIds.length > 0) {
        canceledRecordIds.push(...uniqueRecordIds);
        canceledCount = uniqueRecordIds.length;

        // 履歴記録: 各レコード（キャンセル前の値をスナップショット）
        await prisma.slpReservationHistory.createMany({
          data: targetSessions.map((s) => ({
            companyRecordId: s.companyRecordId,
            reservationType: "briefing",
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
        source: "slp-briefing-cancel",
        message: `bookingId=${bookingId} に該当する予約レコードが見つかりません`,
        detail: { bookingId, uid },
      });
      return NextResponse.json(
        { success: false, error: "対象の予約レコードが見つかりません" },
        { status: 404 }
      );
    }

    // セッションテーブル更新 → 副作用処理（キャンセル通知 + 紹介者通知）
    for (const recordId of canceledRecordIds) {
      try {
        const cancelledSession = await prisma.$transaction(async (tx) => {
          return applyProlineCancelToSession(
            recordId,
            "briefing",
            bookingId ?? null,
            "プロラインwebhookによるキャンセル",
            tx
          );
        });

        if (cancelledSession) {
          // 副作用処理（内部でZoom削除 + キャンセル通知 + 紹介者通知）
          handleSessionStatusChangeSideEffects({
            sessionId: cancelledSession.id,
            newStatus: "キャンセル",
            category: "briefing",
          }).catch(async (err) => {
            await logAutomationError({
              source: "slp-briefing-cancel-side-effects",
              message: `キャンセル副作用処理失敗: sessionId=${cancelledSession.id}`,
              detail: { error: err instanceof Error ? err.message : String(err) },
            });
          });
        }
      } catch (err) {
        await logAutomationError({
          source: "slp-briefing-cancel-session",
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
      source: "slp-briefing-cancel",
      message: `概要案内キャンセルWebhook処理失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
