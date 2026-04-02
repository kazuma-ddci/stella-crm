import { NextResponse } from "next/server";
import { syncCounterpartiesCore } from "@/app/accounting/masters/counterparties/actions";

const SYSTEM_STAFF_ID = 1;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
