import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSlpRemind } from "@/lib/slp-cloudsign";
import { logAutomationError } from "@/lib/automation-error";

/**
 * GET /api/cron/remind-slp-members
 *
 * 自動リマインド: 契約書送付から7日経過した未締結メンバーにリマインドを送る
 * - 対象: ステータス=「契約書送付済」 & 送付日から7日経過 & リマインド回数=0
 * - 1回のみ自動リマインド（GASと同じロジック）
 *
 * VPSのcrontabで毎日10時に実行:
 * 0 10 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:4001/api/cron/remind-slp-members
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
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    // 送付日から7〜8日経過 & リマインド0回 & 未締結
    const targets = await prisma.slpMember.findMany({
      where: {
        deletedAt: null,
        status: "契約書送付済",
        documentId: { not: null },
        reminderCount: 0,
        contractSentDate: {
          gte: eightDaysAgo,
          lte: sevenDaysAgo,
        },
      },
    });

    const results: { id: number; name: string; success: boolean; error?: string }[] = [];

    for (const member of targets) {
      try {
        await sendSlpRemind(member.documentId!);
        await prisma.slpMember.update({
          where: { id: member.id },
          data: {
            reminderCount: member.reminderCount + 1,
            lastReminderSentAt: now,
          },
        });
        results.push({ id: member.id, name: member.name, success: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "不明なエラー";
        results.push({ id: member.id, name: member.name, success: false, error: errorMsg });
        await logAutomationError({
          source: "cron/remind-slp-members",
          message: `リマインド送付失敗: ${member.name} (ID=${member.id})`,
          detail: { memberId: member.id, name: member.name, error: errorMsg },
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(
      `[SLP Auto Remind] 対象: ${targets.length}件, 成功: ${successCount}件, 失敗: ${failCount}件`
    );

    return NextResponse.json({
      success: true,
      total: targets.length,
      succeeded: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("[SLP Auto Remind] Error:", error);
    await logAutomationError({
      source: "cron/remind-slp-members",
      message: error instanceof Error ? error.message : "不明なエラー",
      detail: { error: String(error) },
    });
    return NextResponse.json(
      { success: false, error: "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
