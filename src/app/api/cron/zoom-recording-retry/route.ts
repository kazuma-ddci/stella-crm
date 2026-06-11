import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { logAutomationError } from "@/lib/automation-error";
import { runZoomRecordingRetryJob } from "@/lib/zoom/recording-retry-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/zoom-recording-retry
 * Authorization: Bearer {CRON_SECRET}
 *
 * 15分おきに叩かれる想定。
 * Zoom側で文字起こし生成が遅れた録画を後追いで再取得する。
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await runZoomRecordingRetryJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logAutomationError({
      source: "cron/zoom-recording-retry",
      message: `Zoom文字起こし再取得cron失敗: ${
        err instanceof Error ? err.message : String(err)
      }`,
      detail: { error: err instanceof Error ? err.stack : String(err) },
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
