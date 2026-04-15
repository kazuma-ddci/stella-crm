/**
 * SLP 後追いLINE紐付けの再処理 cron
 *
 * 目的:
 *   フォーム送信時点で SlpLineFriend がまだ無かった申請（status=pending_friend_sync）を、
 *   プロライン同期（毎時の sync-line-friends cron）後に再処理して紐付けを完了させる。
 *
 * 処理対象:
 *   - SlpLineLinkRequest.status = "pending_friend_sync" のレコードのみ
 *   - 既に resolved_auto / resolved_manual / rejected / email_not_found / pending_staff_review のものは触らない
 *
 * 各レコードについて:
 *   1. uid に対応する SlpLineFriend が存在するか確認 → 無ければ次回まで保留
 *   2. 共通ヘルパー attemptLineLink を呼び出して紐付け試行
 *   3. 結果を SlpLineLinkRequest に反映
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logAutomationError } from "@/lib/automation-error";
import {
  attemptLineLink,
  persistLinkRequestOutcome,
} from "@/lib/slp-link-recovery";

export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  return await runResolveCron();
}

// 動作確認・手動再実行用に GET も許可（同じ認証を通す）
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  return await runResolveCron();
}

async function runResolveCron() {
  const startedAt = new Date();
  let processed = 0;
  let resolved = 0;
  let stillPending = 0;
  let staffReview = 0;
  let errors = 0;
  const errorDetails: Array<{ requestId: number; uid: string; error: string }> = [];

  try {
    const pendingRequests = await prisma.slpLineLinkRequest.findMany({
      where: {
        status: "pending_friend_sync",
        deletedAt: null,
      },
      orderBy: { id: "asc" },
    });

    for (const req of pendingRequests) {
      processed++;
      try {
        // SlpLineFriend がまだ存在しないなら次回に持ち越し
        const friend = await prisma.slpLineFriend.findUnique({
          where: { uid: req.uid },
          select: { uid: true },
        });
        if (!friend) {
          stillPending++;
          continue;
        }

        // 紐付け試行
        const outcome = await attemptLineLink({
          uid: req.uid,
          submittedLineName: req.submittedLineName,
          submittedEmail: req.submittedEmail,
          source: "cron",
        });

        await persistLinkRequestOutcome({
          uid: req.uid,
          submittedLineName: req.submittedLineName,
          submittedEmail: req.submittedEmail,
          outcome,
          source: "cron",
        });

        switch (outcome.kind) {
          case "resolved":
            resolved++;
            break;
          case "pending_friend_sync":
            // friend が見つかったのに pending_friend_sync が返ってくる事は無いはず
            stillPending++;
            break;
          case "pending_staff_review":
          case "email_not_found":
            staffReview++;
            break;
        }
      } catch (e) {
        errors++;
        const msg = e instanceof Error ? e.message : String(e);
        errorDetails.push({ requestId: req.id, uid: req.uid, error: msg });
        await logAutomationError({
          source: "cron/slp-line-link-resolve",
          message: `LINE紐付け再処理失敗 (requestId=${req.id}, uid=${req.uid})`,
          detail: { requestId: req.id, uid: req.uid, error: msg },
        });
      }
    }

    const finishedAt = new Date();
    console.log(
      `[Cron] slp-line-link-resolve: processed=${processed}, resolved=${resolved}, stillPending=${stillPending}, staffReview=${staffReview}, errors=${errors}, duration=${
        finishedAt.getTime() - startedAt.getTime()
      }ms`
    );

    return NextResponse.json({
      success: true,
      processed,
      resolved,
      stillPending,
      staffReview,
      errors,
      errorDetails,
    });
  } catch (err) {
    console.error("[Cron] slp-line-link-resolve failed:", err);
    await logAutomationError({
      source: "cron/slp-line-link-resolve",
      message: "後追い紐付け再処理cron全体エラー",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
