import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { calcTotalWithTax } from "@/lib/finance/auto-generate";
import { FinanceSummaryTable } from "@/components/finance-summary-table";
import { ArrowLeft } from "lucide-react";

const EXPENSE_TYPES = [
  { key: "agent_initial", label: "代理店初期費用" },
  { key: "agent_monthly", label: "代理店月額" },
  { key: "commission_initial", label: "紹介報酬（初期）" },
  { key: "commission_monthly", label: "紹介報酬（月額）" },
  { key: "commission_performance", label: "紹介報酬（成果）" },
];

const REVENUE_TYPES = [
  { key: "initial", label: "初期費用" },
  { key: "monthly", label: "月額" },
  { key: "performance", label: "成果報酬" },
];

export default async function AgentSummaryPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: agentIdStr } = await params;
  const agentId = Number(agentIdStr);
  if (isNaN(agentId)) notFound();

  // 代理店情報と紹介企業IDリストを取得
  const [agent, expenseRecords, referredCompanies] = await Promise.all([
    prisma.stpAgent.findUnique({
      where: { id: agentId },
      include: { company: true },
    }),
    prisma.stpExpenseRecord.findMany({
      where: { agentId, deletedAt: null },
    }),
    prisma.stpCompany.findMany({
      where: { agentId },
      select: { id: true },
    }),
  ]);

  if (!agent) notFound();

  // 紹介企業の売上レコードを取得
  const referredCompanyIds = referredCompanies.map((c) => c.id);
  const revenueRecords = referredCompanyIds.length > 0
    ? await prisma.stpRevenueRecord.findMany({
        where: {
          stpCompanyId: { in: referredCompanyIds },
          deletedAt: null,
        },
      })
    : [];

  // 全レコードから月一覧を抽出（昇順）
  const monthSet = new Set<string>();
  expenseRecords.forEach((r) => {
    const d = r.targetMonth;
    const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthSet.add(key);
  });
  revenueRecords.forEach((r) => {
    const d = r.targetMonth;
    const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthSet.add(key);
  });

  const months = Array.from(monthSet).sort();

  // 売上の月別データを構築（参考: 紹介企業の売上）
  const revenueMonthlyData = months.map((month) => {
    const amounts: Record<string, number> = {};
    REVENUE_TYPES.forEach((type) => {
      amounts[type.key] = 0;
    });

    revenueRecords.forEach((r) => {
      const d = r.targetMonth;
      const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (key === month) {
        const taxIncluded = calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate);
        amounts[r.revenueType] = (amounts[r.revenueType] || 0) + taxIncluded;
      }
    });

    return { month, amounts };
  });

  // 経費の月別データを構築
  const expenseMonthlyData = months.map((month) => {
    const amounts: Record<string, number> = {};
    EXPENSE_TYPES.forEach((type) => {
      amounts[type.key] = 0;
    });

    expenseRecords.forEach((r) => {
      const d = r.targetMonth;
      const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (key === month) {
        const taxIncluded = calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate);
        amounts[r.expenseType] = (amounts[r.expenseType] || 0) + taxIncluded;
      }
    });

    return { month, amounts };
  });

  // セクション順: 売上（参考）→ 経費（メイン）
  const sections = [
    {
      title: "売上（紹介企業分・参考）",
      types: REVENUE_TYPES,
      monthlyData: revenueMonthlyData,
    },
    {
      title: "経費（代理店への支払い）",
      types: EXPENSE_TYPES,
      monthlyData: expenseMonthlyData,
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/stp/finance/agent-summary"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        代理店一覧に戻る
      </Link>

      <FinanceSummaryTable
        sections={sections}
        months={months}
        showGrossProfit={true}
        entityName={agent.company.name}
      />
    </div>
  );
}
