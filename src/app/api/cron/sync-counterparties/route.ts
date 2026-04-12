import { NextResponse } from "next/server";
import { syncCounterpartiesCore } from "@/app/accounting/masters/counterparties/actions";
import { verifyCronAuth } from "@/lib/cron-auth";

const SYSTEM_STAFF_ID = 1;

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await syncCounterpartiesCore(SYSTEM_STAFF_ID);
    console.log(`[Cron] sync-counterparties: created=${result.created}, updated=${result.updated}, total=${result.total}`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Cron] sync-counterparties error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
