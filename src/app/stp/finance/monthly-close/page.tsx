import { prisma } from "@/lib/prisma";
import { MonthlyCloseControls } from "./monthly-close-controls";
import { calcTotalWithTax } from "@/lib/finance/auto-generate";

export default async function MonthlyClosePage() {
  // Generate 12 months of data (current month + 11 previous)
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }

  // Fetch close statuses
  const closeRecords = await prisma.stpMonthlyClose.findMany({
    include: { closer: true, reopener: true },
  });

  const closeMap = new Map<
    string,
    {
      id: number;
      closedAt: string;
      closedByName: string;
      reopenedAt: string | null;
      reopenedByName: string | null;
      reopenReason: string | null;
    }
  >();

  for (const rec of closeRecords) {
    const key = rec.targetMonth.toISOString().split("T")[0].slice(0, 7);
    closeMap.set(key, {
      id: rec.id,
      closedAt: rec.closedAt.toISOString(),
      closedByName: rec.closer.name,
      reopenedAt: rec.reopenedAt?.toISOString() || null,
      reopenedByName: rec.reopener?.name || null,
      reopenReason: rec.reopenReason,
    });
  }

  // Fetch revenue and expense summaries for each month
  const [revenueRecords, expenseRecords] = await Promise.all([
    prisma.stpRevenueRecord.findMany({
      where: { deletedAt: null },
      select: {
        targetMonth: true,
        expectedAmount: true,
        taxType: true,
        taxRate: true,
      },
    }),
    prisma.stpExpenseRecord.findMany({
      where: { deletedAt: null },
      select: {
        targetMonth: true,
        expectedAmount: true,
        taxType: true,
        taxRate: true,
      },
    }),
  ]);

  const monthData = months.map((month) => {
    const monthRevenue = revenueRecords
      .filter((r) => r.targetMonth.toISOString().split("T")[0].startsWith(month))
      .reduce(
        (sum, r) =>
          sum + calcTotalWithTax(r.expectedAmount, r.taxType || "tax_included", r.taxRate ?? 10),
        0
      );

    const monthExpense = expenseRecords
      .filter((r) => r.targetMonth.toISOString().split("T")[0].startsWith(month))
      .reduce(
        (sum, r) =>
          sum + calcTotalWithTax(r.expectedAmount, r.taxType || "tax_included", r.taxRate ?? 10),
        0
      );

    const closeInfo = closeMap.get(month) || null;
    const isClosed = closeInfo != null && closeInfo.reopenedAt == null;

    return {
      month,
      revenue: monthRevenue,
      expense: monthExpense,
      grossProfit: monthRevenue - monthExpense,
      isClosed,
      isReopened: closeInfo != null && closeInfo.reopenedAt != null,
      closeInfo,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">月次締め管理</h1>
      <MonthlyCloseControls monthData={monthData} />
    </div>
  );
}
