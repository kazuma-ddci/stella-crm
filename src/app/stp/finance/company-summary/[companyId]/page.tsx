import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { calcTotalWithTax } from "@/lib/finance/auto-generate";
import { FinanceSummaryTable } from "@/components/finance-summary-table";
import { ArrowLeft } from "lucide-react";

const REVENUE_TYPES = [
  { key: "initial", label: "初期費用" },
  { key: "monthly", label: "月額" },
  { key: "performance", label: "成果報酬" },
];

const EXPENSE_TYPES = [
  { key: "agent_initial", label: "代理店初期費用" },
  { key: "agent_monthly", label: "代理店月額" },
  { key: "commission_initial", label: "紹介報酬（初期）" },
  { key: "commission_monthly", label: "紹介報酬（月額）" },
  { key: "commission_performance", label: "紹介報酬（成果）" },
];

export default async function CompanySummaryPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: companyIdStr } = await params;
  const companyId = Number(companyIdStr);
  if (isNaN(companyId)) notFound();

  const [stpCompany, revenueRecords, expenseRecords] = await Promise.all([
    prisma.stpCompany.findUnique({
      where: { id: companyId },
      include: { company: true },
    }),
    prisma.stpRevenueRecord.findMany({
      where: { stpCompanyId: companyId, deletedAt: null },
    }),
    prisma.stpExpenseRecord.findMany({
      where: { stpCompanyId: companyId, deletedAt: null },
    }),
  ]);

  if (!stpCompany) notFound();

  // 全レコードから月一覧を抽出（昇順）
  const monthSet = new Set<string>();
  revenueRecords.forEach((r) => {
    const d = r.targetMonth;
    const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthSet.add(key);
  });
  expenseRecords.forEach((r) => {
    const d = r.targetMonth;
    const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthSet.add(key);
  });

  const months = Array.from(monthSet).sort();

  // 売上の月別データを構築
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

  const sections = [
    {
      title: "売上",
      types: REVENUE_TYPES,
      monthlyData: revenueMonthlyData,
    },
    {
      title: "経費",
      types: EXPENSE_TYPES,
      monthlyData: expenseMonthlyData,
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/stp/finance/company-summary"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        企業一覧に戻る
      </Link>

      <FinanceSummaryTable
        sections={sections}
        months={months}
        showGrossProfit={true}
        entityName={stpCompany.company.name}
      />
    </div>
  );
}
