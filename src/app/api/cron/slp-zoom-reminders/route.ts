import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runSlpZoomReminderJob } from "@/lib/slp/zoom-reminder-job";
import { logAutomationError } from "@/lib/automation-error";

export const dynamic = "force-dynamic";
// 大量予約時（100件以上）の順次処理に備えて5分まで許容
export const maxDuration = 300;

/**
 * GET /api/cron/slp-zoom-reminders
 * Authorization: Bearer {CRON_SECRET}
 *
 * 15分おきに叩かれる想定のcron。
 * - 前日10:00の時間帯に該当すれば前日リマインドを送信
 * - 予約30-89分前の範囲なら1時間前リマインドを送信
 * 送信済みフラグで二重送信を防止。
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await runSlpZoomReminderJob();
    return NextResponse.json({
      ok: true,
      dayBeforeProcessed: result.dayBeforeProcessed,
      hourBeforeProcessed: result.hourBeforeProcessed,
    });
  } catch (err) {
    await logAutomationError({
      source: "cron/slp-zoom-reminders",
      message: `Zoomリマインドcron失敗: ${err instanceof Error ? err.message : String(err)}`,
      detail: { error: err instanceof Error ? err.stack : String(err) },
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
}
