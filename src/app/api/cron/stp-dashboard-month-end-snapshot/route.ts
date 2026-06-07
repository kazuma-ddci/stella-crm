import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { saveCurrentMonthEndSnapshotsForCron } from "@/app/stp/new-dashboard/actions";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await saveCurrentMonthEndSnapshotsForCron();
    console.log(
      `[Cron] stp-dashboard-month-end-snapshot: targetMonth=${result.targetMonth}, saved=${result.saved}`
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cron] stp-dashboard-month-end-snapshot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
