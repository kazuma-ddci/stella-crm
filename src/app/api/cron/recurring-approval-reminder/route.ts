import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/create-notification";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // 決済予定日が7日以内で、まだプロジェクト承認待ちのPaymentGroupを取得
    const overdueGroups = await prisma.paymentGroup.findMany({
      where: {
        deletedAt: null,
        status: "pending_project_approval",
        approverStaffId: { not: null },
        expectedPaymentDate: {
          not: null,
          lte: sevenDaysLater,
        },
        // 定期取引由来のものだけ対象
        transactions: {
          some: {
            deletedAt: null,
            sourceType: "recurring",
          },
        },
      },
      select: {
        id: true,
        referenceCode: true,
        approverStaffId: true,
        expectedPaymentDate: true,
        totalAmount: true,
        counterparty: { select: { name: true } },
        customCounterpartyName: true,
        project: { select: { code: true } },
      },
    });

    let sentCount = 0;

    for (const group of overdueGroups) {
      if (!group.approverStaffId || !group.expectedPaymentDate) continue;

      // 同じグループへの承認リマインドが今日既に送られていたらスキップ
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const existing = await prisma.notification.findFirst({
        where: {
          recipientId: group.approverStaffId,
          actionType: "recurring_approval_reminder",
          actionTargetId: group.id,
          createdAt: { gte: todayStart },
        },
      });
      if (existing) continue;

      const daysUntil = Math.ceil(
        (group.expectedPaymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const counterpartyName =
        group.counterparty?.name ?? group.customCounterpartyName ?? "不明";
      const urgency = daysUntil <= 0 ? "期限超過" : `あと${daysUntil}日`;
      const projectCode = group.project?.code?.toUpperCase() ?? "";
      const linkUrl = projectCode
        ? `/${group.project!.code}/expenses/new`
        : "/accounting/workflow";

      await createNotification({
        recipientId: group.approverStaffId,
        senderType: "system",
        category: "accounting",
        title: `経費承認リマインド: ${counterpartyName}（${urgency}）`,
        message: `${group.referenceCode ?? `PG-${group.id}`} の承認をお願いします。決済予定日: ${group.expectedPaymentDate.toLocaleDateString("ja-JP")}`,
        linkUrl,
        actionType: "recurring_approval_reminder",
        actionTargetId: group.id,
      });
      sentCount++;
    }

    return NextResponse.json({
      ok: true,
      checked: overdueGroups.length,
      notified: sentCount,
    });
  } catch (error) {
    console.error("[Cron] recurring-approval-reminder error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
