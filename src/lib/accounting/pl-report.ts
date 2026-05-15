import type { Prisma } from "@prisma/client";

export type PlReportMode = "statutory" | "internal";
export type PlAggregationUnit = "company" | "project";
export type PlAllocationView = "before" | "after";
export type PlPeriodType = "monthly" | "fiscalYear";
export type PlAmountBasis = "taxExcluded" | "taxIncluded";

export const PL_ACCOUNT_CATEGORIES = [
  "revenue",
  "cost_of_sales",
  "sga",
  "non_operating_revenue",
  "non_operating_expense",
  "extraordinary_income",
  "extraordinary_loss",
] as const;

export type PlAccountCategory = (typeof PL_ACCOUNT_CATEGORIES)[number];

export const PL_CATEGORY_LABELS: Record<PlAccountCategory, string> = {
  revenue: "売上高",
  cost_of_sales: "売上原価",
  sga: "販管費",
  non_operating_revenue: "営業外収益",
  non_operating_expense: "営業外費用",
  extraordinary_income: "特別利益",
  extraordinary_loss: "特別損失",
};

export const PL_CATEGORY_ORDER: Record<PlAccountCategory, number> = {
  revenue: 10,
  cost_of_sales: 20,
  sga: 30,
  non_operating_revenue: 40,
  non_operating_expense: 50,
  extraordinary_income: 60,
  extraordinary_loss: 70,
};

export function normalizePlReportMode(value: string | null | undefined): PlReportMode {
  return value === "internal" ? "internal" : "statutory";
}

export function normalizePlAggregationUnit(value: string | null | undefined): PlAggregationUnit {
  return value === "project" ? "project" : "company";
}

export function normalizePlAllocationView(value: string | null | undefined): PlAllocationView {
  return value === "after" ? "after" : "before";
}

export function normalizePlPeriodType(value: string | null | undefined): PlPeriodType {
  return value === "fiscalYear" ? "fiscalYear" : "monthly";
}

export function normalizePlAmountBasis(value: string | null | undefined): PlAmountBasis {
  return value === "taxIncluded" ? "taxIncluded" : "taxExcluded";
}

export function buildPlReportJournalEntryWhere(input: {
  startDate: Date;
  endDate: Date;
  mode?: PlReportMode;
  operatingCompanyId?: number | null;
  projectId?: number | null;
  costCenterId?: number | null;
}): Prisma.JournalEntryWhereInput {
  const where: Prisma.JournalEntryWhereInput = {
    deletedAt: null,
    journalDate: {
      gte: input.startDate,
      lt: input.endDate,
    },
  };

  if (input.operatingCompanyId) {
    where.OR = [
      { operatingCompanyId: input.operatingCompanyId },
      { invoiceGroup: { operatingCompanyId: input.operatingCompanyId } },
      { paymentGroup: { operatingCompanyId: input.operatingCompanyId } },
      { project: { operatingCompanyId: input.operatingCompanyId } },
      { transaction: { invoiceGroup: { operatingCompanyId: input.operatingCompanyId } } },
      { transaction: { paymentGroup: { operatingCompanyId: input.operatingCompanyId } } },
      { transaction: { project: { operatingCompanyId: input.operatingCompanyId } } },
    ];
  }

  if (input.projectId || input.costCenterId) {
    const projectOrCostCenterWhere: Prisma.JournalEntryWhereInput[] = [];
    if (input.projectId) {
      projectOrCostCenterWhere.push(
        { projectId: input.projectId },
        { invoiceGroup: { projectId: input.projectId } },
        { paymentGroup: { projectId: input.projectId } },
        { transaction: { projectId: input.projectId } },
        { transaction: { costCenter: { projectId: input.projectId } } },
        { lines: { some: { plAllocations: { some: { projectId: input.projectId } } } } },
        {
          lines: {
            some: {
              plAllocations: {
                some: { costCenter: { projectId: input.projectId } },
              },
            },
          },
        }
      );
    }
    if (input.costCenterId) {
      projectOrCostCenterWhere.push(
        { transaction: { costCenterId: input.costCenterId } },
        { lines: { some: { plAllocations: { some: { costCenterId: input.costCenterId } } } } }
      );
    }
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { OR: projectOrCostCenterWhere },
    ];
  }

  if (input.mode !== "internal") {
    return where;
  }

  return {
    ...where,
    AND: [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { invoiceGroupId: null },
          { invoiceGroup: { excludeFromInternalPl: false } },
        ],
      },
      {
        OR: [
          { transactionId: null },
          { transaction: { invoiceGroupId: null } },
          { transaction: { invoiceGroup: { excludeFromInternalPl: false } } },
        ],
      },
      {
        OR: [
          { paymentGroupId: null },
          { paymentGroup: { excludeFromInternalPl: false } },
        ],
      },
      {
        OR: [
          { transactionId: null },
          { transaction: { paymentGroupId: null } },
          { transaction: { paymentGroup: { excludeFromInternalPl: false } } },
        ],
      },
    ],
  };
}

export function getPlPeriodRange(input: {
  periodType: PlPeriodType;
  year: number;
  month: number;
  fiscalClosingMonth: number;
}): { startDate: Date; endDate: Date; label: string } {
  if (input.periodType === "fiscalYear") {
    const closingMonth = Math.min(Math.max(input.fiscalClosingMonth, 1), 12);
    const startMonthIndex = closingMonth % 12;
    const startYear = startMonthIndex === 0 ? input.year - 1 : input.year;
    const startDate = new Date(startYear, startMonthIndex, 1);
    const endYear = startMonthIndex === 0 ? input.year : input.year + 1;
    const endDate = new Date(endYear, closingMonth, 1);
    return {
      startDate,
      endDate,
      label: `${input.year}年度`,
    };
  }

  const safeMonth = Math.min(Math.max(input.month, 1), 12);
  return {
    startDate: new Date(input.year, safeMonth - 1, 1),
    endDate: new Date(input.year, safeMonth, 1),
    label: `${input.year}年${safeMonth}月`,
  };
}

export function calculatePlSignedAmount(input: {
  accountCategory: string;
  side: string;
  amount: number;
}): number {
  const incomeCategories = new Set([
    "revenue",
    "non_operating_revenue",
    "extraordinary_income",
  ]);
  const isIncome = incomeCategories.has(input.accountCategory);
  if (isIncome) {
    return input.side === "credit" ? input.amount : -input.amount;
  }
  return input.side === "debit" ? input.amount : -input.amount;
}

export function isPlAccountCategory(category: string): category is PlAccountCategory {
  return (PL_ACCOUNT_CATEGORIES as readonly string[]).includes(category);
}
