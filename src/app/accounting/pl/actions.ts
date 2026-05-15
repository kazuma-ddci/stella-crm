"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import { ensureCostCentersForActiveProjects } from "@/lib/accounting/cost-centers";
import { closeMonth, isMonthClosed, reopenMonth } from "@/lib/finance/monthly-close";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  buildPlReportJournalEntryWhere,
  calculatePlSignedAmount,
  getPlPeriodRange,
  isPlAccountCategory,
  normalizePlAggregationUnit,
  normalizePlAllocationView,
  normalizePlAmountBasis,
  normalizePlPeriodType,
  normalizePlReportMode,
  PL_CATEGORY_LABELS,
  PL_CATEGORY_ORDER,
  type PlAggregationUnit,
  type PlAllocationView,
  type PlAmountBasis,
  type PlPeriodType,
  type PlReportMode,
} from "@/lib/accounting/pl-report";

export type PlReportRow = {
  entityId: number | null;
  entityName: string;
  category: string;
  categoryLabel: string;
  accountId: number;
  accountCode: string;
  accountName: string;
  amount: number;
};

export type PlPageData = {
  companies: { id: number; companyName: string; fiscalClosingMonth: number }[];
  projects: { id: number; name: string; projectId: number | null; operatingCompanyId: number | null }[];
  selectedCompanyId: number | null;
  selectedProjectId: number | null;
  periodLabel: string;
  isClosed: boolean;
  rows: PlReportRow[];
  totals: {
    revenue: number;
    costOfSales: number;
    grossProfit: number;
    sga: number;
    operatingProfit: number;
    ordinaryProfit: number;
    netProfit: number;
  };
};

export type PlPageParams = {
  reportMode?: string | null;
  aggregationUnit?: string | null;
  allocationView?: string | null;
  periodType?: string | null;
  amountBasis?: string | null;
  operatingCompanyId?: string | null;
  projectId?: string | null;
  year?: string | null;
  month?: string | null;
};

function getAmountByBasis(input: {
  amountExcludingTax: number;
  taxAmount: number;
  amountIncludingTax: number;
  amountBasis: PlAmountBasis;
}) {
  return input.amountBasis === "taxIncluded"
    ? input.amountIncludingTax
    : input.amountExcludingTax;
}

function buildTotals(rows: PlReportRow[]) {
  const sumByCategory = (category: string) =>
    rows.filter((row) => row.category === category).reduce((sum, row) => sum + row.amount, 0);

  const revenue = sumByCategory("revenue");
  const costOfSales = sumByCategory("cost_of_sales");
  const sga = sumByCategory("sga");
  const nonOperatingRevenue = sumByCategory("non_operating_revenue");
  const nonOperatingExpense = sumByCategory("non_operating_expense");
  const extraordinaryIncome = sumByCategory("extraordinary_income");
  const extraordinaryLoss = sumByCategory("extraordinary_loss");
  const grossProfit = revenue - costOfSales;
  const operatingProfit = grossProfit - sga;
  const ordinaryProfit = operatingProfit + nonOperatingRevenue - nonOperatingExpense;
  const netProfit = ordinaryProfit + extraordinaryIncome - extraordinaryLoss;

  return {
    revenue,
    costOfSales,
    grossProfit,
    sga,
    operatingProfit,
    ordinaryProfit,
    netProfit,
  };
}

export async function getPlPageData(params: PlPageParams): Promise<PlPageData> {
  await requireStaffForAccounting("view");
  await ensureCostCentersForActiveProjects();

  const reportMode: PlReportMode = normalizePlReportMode(params.reportMode);
  const aggregationUnit: PlAggregationUnit = normalizePlAggregationUnit(params.aggregationUnit);
  const allocationView: PlAllocationView = normalizePlAllocationView(params.allocationView);
  const periodType: PlPeriodType = normalizePlPeriodType(params.periodType);
  const amountBasis: PlAmountBasis = normalizePlAmountBasis(params.amountBasis);

  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const companies = await prisma.operatingCompany.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true, fiscalClosingMonth: true },
    orderBy: { id: "asc" },
  });

  const projects = await prisma.costCenter.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: { select: { operatingCompanyId: true } },
    },
    orderBy: [{ projectId: "asc" }, { name: "asc" }],
  });
  const accountingProjects = projects.map((project) => ({
    id: project.id,
    name: project.name,
    projectId: project.projectId,
    operatingCompanyId: project.project?.operatingCompanyId ?? null,
  }));
  const costCenterByProjectId = new Map(
    accountingProjects
      .filter((project) => project.projectId !== null)
      .map((project) => [project.projectId as number, project])
  );

  const requestedProjectId =
    aggregationUnit === "project" && params.projectId ? Number(params.projectId) : null;
  const selectedProject =
    aggregationUnit === "project"
      ? accountingProjects.find((project) => project.id === requestedProjectId) ??
        accountingProjects[0] ??
        null
      : null;

  const selectedCompanyId =
    aggregationUnit === "project"
      ? selectedProject?.operatingCompanyId ?? null
      : params.operatingCompanyId
        ? Number(params.operatingCompanyId)
        : companies[0]?.id ?? null;
  const selectedCompany =
    companies.find((company) => company.id === selectedCompanyId) ??
    (aggregationUnit === "project" ? null : companies[0] ?? null);
  const period = getPlPeriodRange({
    periodType,
    year,
    month,
    fiscalClosingMonth: selectedCompany?.fiscalClosingMonth ?? 3,
  });

  const entries = await prisma.journalEntry.findMany({
    where: buildPlReportJournalEntryWhere({
      startDate: period.startDate,
      endDate: period.endDate,
      mode: reportMode,
      operatingCompanyId: selectedCompany?.id ?? null,
      projectId: aggregationUnit === "project" ? selectedProject?.projectId ?? null : null,
      costCenterId: aggregationUnit === "project" ? selectedProject?.id ?? null : null,
    }),
    include: {
      operatingCompany: { select: { id: true, companyName: true } },
      project: {
        select: {
          id: true,
          code: true,
          name: true,
          operatingCompanyId: true,
          operatingCompany: { select: { id: true, companyName: true } },
        },
      },
      invoiceGroup: {
        select: {
          operatingCompany: { select: { id: true, companyName: true } },
          project: {
            select: {
              id: true,
              code: true,
              name: true,
              operatingCompanyId: true,
              operatingCompany: { select: { id: true, companyName: true } },
            },
          },
        },
      },
      paymentGroup: {
        select: {
          operatingCompany: { select: { id: true, companyName: true } },
          project: {
            select: {
              id: true,
              code: true,
              name: true,
              operatingCompanyId: true,
              operatingCompany: { select: { id: true, companyName: true } },
            },
          },
        },
      },
      transaction: {
        select: {
          project: {
            select: {
              id: true,
              code: true,
              name: true,
              operatingCompanyId: true,
              operatingCompany: { select: { id: true, companyName: true } },
            },
          },
          costCenter: {
            select: {
              id: true,
              name: true,
              project: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  operatingCompanyId: true,
                  operatingCompany: { select: { id: true, companyName: true } },
                },
              },
            },
          },
          invoiceGroup: { select: { operatingCompany: { select: { id: true, companyName: true } } } },
          paymentGroup: { select: { operatingCompany: { select: { id: true, companyName: true } } } },
        },
      },
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, category: true } },
          plAllocations: {
            include: {
              operatingCompany: { select: { id: true, companyName: true } },
              project: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  operatingCompanyId: true,
                  operatingCompany: { select: { id: true, companyName: true } },
                },
              },
              costCenter: {
                select: {
                  id: true,
                  name: true,
                  project: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      operatingCompanyId: true,
                      operatingCompany: { select: { id: true, companyName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const rowMap = new Map<string, PlReportRow>();

  for (const entry of entries) {
    const fallbackCompany =
      entry.operatingCompany ??
      entry.invoiceGroup?.operatingCompany ??
      entry.paymentGroup?.operatingCompany ??
      entry.transaction?.invoiceGroup?.operatingCompany ??
      entry.transaction?.paymentGroup?.operatingCompany ??
      entry.project?.operatingCompany ??
      entry.transaction?.costCenter?.project?.operatingCompany ??
      entry.transaction?.project?.operatingCompany ??
      entry.invoiceGroup?.project?.operatingCompany ??
      entry.paymentGroup?.project?.operatingCompany ??
      selectedCompany;

    const fallbackProject =
      entry.project ??
      entry.transaction?.costCenter?.project ??
      entry.transaction?.project ??
      entry.invoiceGroup?.project ??
      entry.paymentGroup?.project ??
      null;
    const fallbackCostCenter =
      entry.transaction?.costCenter ??
      (fallbackProject ? costCenterByProjectId.get(fallbackProject.id) ?? null : null);

    for (const line of entry.lines) {
      if (!isPlAccountCategory(line.account.category)) continue;

      const allocations =
        line.plAllocations.length > 0
          ? line.plAllocations
          : [
              {
                allocationMode: fallbackProject ? "direct" : "unclassified",
                amountExcludingTax: line.amount,
                taxAmount: line.taxAmount ?? 0,
                amountIncludingTax: line.amount + (line.taxAmount ?? 0),
                operatingCompany: fallbackCompany,
                project: fallbackProject,
                costCenter: fallbackCostCenter,
              },
            ];

      for (const allocation of allocations) {
        const amountForBasis = getAmountByBasis({
          amountExcludingTax: allocation.amountExcludingTax,
          taxAmount: allocation.taxAmount,
          amountIncludingTax: allocation.amountIncludingTax,
          amountBasis,
        });
        const signedAmount = calculatePlSignedAmount({
          accountCategory: line.account.category,
          side: line.side,
          amount: amountForBasis,
        });

        const company = allocation.operatingCompany ?? fallbackCompany;
        const allocationCostCenterProject =
          allocation.costCenter && "project" in allocation.costCenter
            ? allocation.costCenter.project
            : null;
        const project =
          allocationView === "before" &&
          ["template", "common"].includes(allocation.allocationMode)
            ? null
            : allocation.project ?? allocationCostCenterProject ?? fallbackProject;
        const costCenter =
          allocationView === "before" &&
          ["template", "common"].includes(allocation.allocationMode)
            ? null
            : allocation.costCenter ??
              (project ? costCenterByProjectId.get(project.id) ?? null : null) ??
              fallbackCostCenter;

        if (
          aggregationUnit === "project" &&
          selectedProject &&
          costCenter?.id !== selectedProject.id
        ) {
          continue;
        }

        const entity =
          aggregationUnit === "company"
            ? company
              ? { id: company.id, name: company.companyName }
              : { id: null, name: "未分類" }
            : costCenter
              ? { id: costCenter.id, name: costCenter.name }
              : { id: null, name: allocation.allocationMode === "unclassified" ? "未分類" : "法人共通" };

        const key = [
          entity.id ?? "none",
          entity.name,
          line.account.category,
          line.account.id,
        ].join(":");
        const existing = rowMap.get(key);
        if (existing) {
          existing.amount += signedAmount;
        } else {
          rowMap.set(key, {
            entityId: entity.id,
            entityName: entity.name,
            category: line.account.category,
            categoryLabel: PL_CATEGORY_LABELS[line.account.category],
            accountId: line.account.id,
            accountCode: line.account.code,
            accountName: line.account.name,
            amount: signedAmount,
          });
        }
      }
    }
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    if (a.entityName !== b.entityName) return a.entityName.localeCompare(b.entityName, "en");
    const categoryDiff =
      PL_CATEGORY_ORDER[a.category as keyof typeof PL_CATEGORY_ORDER] -
      PL_CATEGORY_ORDER[b.category as keyof typeof PL_CATEGORY_ORDER];
    if (categoryDiff !== 0) return categoryDiff;
    return a.accountCode.localeCompare(b.accountCode, "en");
  });

  return {
    companies,
    projects: accountingProjects,
    selectedCompanyId: selectedCompany?.id ?? null,
    selectedProjectId: selectedProject?.id ?? null,
    periodLabel: period.label,
    isClosed: selectedCompany ? await isMonthClosed(period.startDate, selectedCompany.id) : false,
    rows,
    totals: buildTotals(rows),
  };
}

export async function closePlMonth(input: {
  operatingCompanyId: number;
  year: number;
  month: number;
}): Promise<ActionResult> {
  try {
    const staff = await getSession();
    await requireStaffForAccounting("manager");
    await closeMonth(
      new Date(input.year, input.month - 1, 1),
      staff.id,
      undefined,
      input.operatingCompanyId
    );
    revalidatePath("/accounting/pl");
    return ok();
  } catch (e) {
    console.error("[closePlMonth] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reopenPlMonth(input: {
  operatingCompanyId: number;
  year: number;
  month: number;
  reason: string;
}): Promise<ActionResult> {
  try {
    const staff = await getSession();
    await requireStaffForAccounting("manager");
    await reopenMonth(
      new Date(input.year, input.month - 1, 1),
      staff.id,
      input.reason,
      input.operatingCompanyId
    );
    revalidatePath("/accounting/pl");
    return ok();
  } catch (e) {
    console.error("[reopenPlMonth] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
