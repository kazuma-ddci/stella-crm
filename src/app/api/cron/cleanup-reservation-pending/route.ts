import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

/**
 * GET /api/cron/cleanup-reservation-pending
 *
 * 期限切れの SlpReservationPending レコードを物理削除する。
 * 30分の有効期限切れか、既に消費済みかつ24時間以上経過したレコードが対象。
 *
 * VPSのcrontabで1日1回実行:
 *   0 4 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:4001/api/cron/cleanup-reservation-pending
 */
export async function GET(request: NextRequest) {
  // Bearer認証
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 期限切れ or 24時間以上前に消費済みのものを削除
    const result = await prisma.slpReservationPending.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now }, consumedAt: null },
          { consumedAt: { lt: oneDayAgo } },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-cleanup-reservation-pending",
      message: "予約ペンディング情報のクリーンアップに失敗",
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
