"use server";

import { prisma } from "@/lib/prisma";
import { KPI_KEYS, DEFAULT_FIXED_COST } from "@/lib/kpi/constants";
import type { InsightResult } from "./types";

// ============================================
// ヘルパー
// ============================================

function parseMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  const daysInMonth = monthEnd.getDate();
  return { monthStart, monthEnd, daysInMonth, year: y, month: m };
}

function prevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(n: number): string {
  return `¥${n.toLocaleString()}`;
}

type ContractRow = {
  companyId: number;
  contractStartDate: Date;
  contractEndDate: Date | null;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
  status: string;
};

type CandidateRow = {
  joinDate: Date | null;
  stpCompany: { companyId: number };
};

function calculateRevenue(
  contracts: ContractRow[],
  candidates: CandidateRow[],
  monthStart: Date,
  monthEnd: Date,
  daysInMonth: number,
  includeScheduled: boolean
) {
  let total = 0;
  const validStatuses = includeScheduled
    ? ["active", "cancelled", "dormant", "scheduled"]
    : ["active", "cancelled", "dormant"];
  const filtered = contracts.filter((c) => validStatuses.includes(c.status));

  for (const c of filtered) {
    const contractStart = new Date(c.contractStartDate);
    const contractEnd = c.contractEndDate ? new Date(c.contractEndDate) : null;
    if (contractStart > monthEnd) continue;
    if (contractEnd && contractEnd < monthStart) continue;

    if (contractStart >= monthStart && contractStart <= monthEnd) {
      total += c.initialFee;
    }

    const effectiveStart = contractStart > monthStart ? contractStart : monthStart;
    const effectiveEnd = contractEnd
      ? contractEnd < monthEnd ? contractEnd : monthEnd
      : monthEnd;

    if (effectiveStart <= effectiveEnd) {
      const activeDays = Math.floor(
        (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      total += Math.round((c.monthlyFee * activeDays) / daysInMonth);
    }

    if (c.performanceFee > 0) {
      const matchingCandidates = candidates.filter(
        (cand) =>
          cand.stpCompany.companyId === c.companyId &&
          cand.joinDate &&
          new Date(cand.joinDate) >= monthStart &&
          new Date(cand.joinDate) <= monthEnd
      );
      total += matchingCandidates.length * c.performanceFee;
    }
  }
  return total;
}

/** 売上を初期/月額/成果に分けて計算 */
function calculateRevenueByType(
  contracts: ContractRow[],
  candidates: CandidateRow[],
  monthStart: Date,
  monthEnd: Date,
  daysInMonth: number,
  includeScheduled: boolean
) {
  let initial = 0;
  let monthly = 0;
  let performance = 0;
  const validStatuses = includeScheduled
    ? ["active", "cancelled", "dormant", "scheduled"]
    : ["active", "cancelled", "dormant"];
  const filtered = contracts.filter((c) => validStatuses.includes(c.status));

  for (const c of filtered) {
    const contractStart = new Date(c.contractStartDate);
    const contractEnd = c.contractEndDate ? new Date(c.contractEndDate) : null;
    if (contractStart > monthEnd) continue;
    if (contractEnd && contractEnd < monthStart) continue;

    if (contractStart >= monthStart && contractStart <= monthEnd) {
      initial += c.initialFee;
    }

    const effectiveStart = contractStart > monthStart ? contractStart : monthStart;
    const effectiveEnd = contractEnd
      ? contractEnd < monthEnd ? contractEnd : monthEnd
      : monthEnd;

    if (effectiveStart <= effectiveEnd) {
      const activeDays = Math.floor(
        (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      monthly += Math.round((c.monthlyFee * activeDays) / daysInMonth);
    }

    if (c.performanceFee > 0) {
      const matchingCandidates = candidates.filter(
        (cand) =>
          cand.stpCompany.companyId === c.companyId &&
          cand.joinDate &&
          new Date(cand.joinDate) >= monthStart &&
          new Date(cand.joinDate) <= monthEnd
      );
      performance += matchingCandidates.length * c.performanceFee;
    }
  }
  return { initial, monthly, performance, total: initial + monthly + performance };
}

async function getContractsAndCandidates(startDate: Date, endDate: Date) {
  const [contracts, candidates] = await Promise.all([
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        contractStartDate: { lte: endDate },
        OR: [{ contractEndDate: null }, { contractEndDate: { gte: startDate } }],
      },
      select: {
        companyId: true,
        contractStartDate: true,
        contractEndDate: true,
        initialFee: true,
        monthlyFee: true,
        performanceFee: true,
        status: true,
      },
    }),
    prisma.stpCandidate.findMany({
      where: {
        deletedAt: null,
        joinDate: { gte: startDate, lte: endDate },
      },
      select: {
        joinDate: true,
        stpCompany: { select: { companyId: true } },
      },
    }),
  ]);
  return { contracts, candidates };
}

// STP projectId
const STP_PROJECT_ID = 1;

// ============================================
// メインディスパッチャ
// ============================================

export async function getInsightData(
  insightId: string,
  params?: Record<string, string | number>
): Promise<InsightResult> {
  const yearMonth =
    (params?.yearMonth as string) || getCurrentYearMonth();

  switch (insightId) {
    // === 売上・収益 ===
    case "revenue_actual":
      return getRevenueActual(yearMonth);
    case "revenue_forecast":
      return getRevenueForecast(yearMonth);
    case "revenue_breakdown":
      return getRevenueBreakdown(yearMonth);
    case "revenue_trend":
      return getRevenueTrend(yearMonth);
    case "revenue_target_rate":
      return getRevenueTargetRate(yearMonth);
    case "gross_profit":
      return getGrossProfit(yearMonth);
    case "receivables":
      return getReceivables(yearMonth);
    case "overdue_invoices":
      return getOverdueInvoices();

    // === 営業パイプライン ===
    case "sales_funnel":
      return getSalesFunnel();
    case "new_leads":
      return getNewLeads(yearMonth);
    case "conversion_rate":
      return getConversionRate();
    case "pipeline_by_staff":
      return getPipelineByStaff();
    case "avg_deal_days":
      return getAvgDealDays();
    case "won_this_month":
      return getWonThisMonth(yearMonth);
    case "progressed_this_month":
      return getProgressedThisMonth(yearMonth);
    case "stale_deals":
      return getStaleDeals();

    // === 失注分析 ===
    case "lost_count":
      return getLostCount(yearMonth);
    case "lost_rate":
      return getLostRate();
    case "top_lost_reasons":
      return getTopLostReasons();
    case "lost_stage_distribution":
      return getLostStageDistribution();
    case "pending_deals":
      return getPendingDeals();
    case "revived_deals":
      return getRevivedDeals(yearMonth);

    // === 顧客・企業 ===
    case "active_customers":
      return getActiveCustomers(yearMonth);
    case "customer_revenue_ranking":
      return getCustomerRevenueRanking(yearMonth);
    case "expiring_contracts":
      return getExpiringContracts();
    case "contract_plan_distribution":
      return getContractPlanDistribution();
    case "avg_contract_value":
      return getAvgContractValue();
    case "industry_distribution":
      return getIndustryDistribution();

    // === 代理店 ===
    case "agent_lead_ranking":
      return getAgentLeadRanking(yearMonth);
    case "agent_won_ranking":
      return getAgentWonRanking();
    case "agent_payment_total":
      return getAgentPaymentTotal(yearMonth);
    case "active_agents":
      return getActiveAgents();
    case "agent_category_distribution":
      return getAgentCategoryDistribution();

    // === 契約書 ===
    case "unsigned_contracts":
      return getUnsignedContracts();
    case "cloudsign_pending":
      return getCloudsignPending();
    case "avg_signing_days":
      return getAvgSigningDays();
    case "signed_this_month":
      return getSignedThisMonth(yearMonth);

    // === 経費・支払 ===
    case "monthly_expenses":
      return getMonthlyExpenses(yearMonth);
    case "expense_type_breakdown":
      return getExpenseTypeBreakdown(yearMonth);
    case "unpaid_expenses":
      return getUnpaidExpenses();

    // === 活動・接触 ===
    case "contact_count":
      return getContactCount(yearMonth);
    case "contact_ranking_by_staff":
      return getContactRankingByStaff(yearMonth);
    case "inactive_customers":
      return getInactiveCustomers();
    case "contact_method_distribution":
      return getContactMethodDistribution(yearMonth);

    // === KPI・採用 ===
    case "kpi_achievement":
      return getKpiAchievement(yearMonth);
    case "candidate_join_count":
      return getCandidateJoinCount(yearMonth);
    case "candidate_media_breakdown":
      return getCandidateMediaBreakdown();

    default:
      return {
        type: "summary",
        title: "エラー",
        cards: [],
        details: [{ label: "メッセージ", value: `未実装の項目です: ${insightId}` }],
      };
  }
}

// ============================================
// 売上・収益
// ============================================

async function getRevenueActual(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart, monthEnd: prevEnd, daysInMonth: prevDays } = parseMonth(prev);

  const { contracts, candidates } = await getContractsAndCandidates(prevStart, monthEnd);

  const actual = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, false);
  const prevActual = calculateRevenue(contracts, candidates, prevStart, prevEnd, prevDays, false);
  const changePercent = prevActual > 0 ? Math.round(((actual - prevActual) / prevActual) * 1000) / 10 : 0;

  return {
    type: "number",
    title: `${yearMonth} 売上実績`,
    value: actual,
    format: "currency",
    comparison: {
      label: "前月",
      value: prevActual,
      changePercent,
    },
  };
}

async function getRevenueForecast(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);
  const { contracts, candidates } = await getContractsAndCandidates(monthStart, monthEnd);

  const actual = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, false);
  const forecast = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, true);
  const scheduledOnly = forecast - actual;

  return {
    type: "number",
    title: `${yearMonth} 売上見込み`,
    value: forecast,
    format: "currency",
    subItems: [
      { label: "確定分", value: actual, format: "currency" },
      { label: "未確定（scheduled）", value: scheduledOnly, format: "currency" },
    ],
  };
}

async function getRevenueBreakdown(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);
  const { contracts, candidates } = await getContractsAndCandidates(monthStart, monthEnd);
  const breakdown = calculateRevenueByType(contracts, candidates, monthStart, monthEnd, daysInMonth, false);

  const total = breakdown.total || 1;
  return {
    type: "breakdown",
    title: `${yearMonth} 売上内訳`,
    total: breakdown.total,
    format: "currency",
    items: [
      { label: "初期費用", value: breakdown.initial, percent: Math.round((breakdown.initial / total) * 1000) / 10, color: "#3B82F6" },
      { label: "月額費用", value: breakdown.monthly, percent: Math.round((breakdown.monthly / total) * 1000) / 10, color: "#10B981" },
      { label: "成果報酬", value: breakdown.performance, percent: Math.round((breakdown.performance / total) * 1000) / 10, color: "#F59E0B" },
    ],
  };
}

async function getRevenueTrend(yearMonth: string): Promise<InsightResult> {
  // 直近12ヶ月の推移
  const months: string[] = [];
  const [y, m] = yearMonth.split("-").map(Number);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const firstParsed = parseMonth(months[0]);
  const lastParsed = parseMonth(months[months.length - 1]);

  const [{ contracts, candidates }, targets] = await Promise.all([
    getContractsAndCandidates(firstParsed.monthStart, lastParsed.monthEnd),
    prisma.kpiMonthlyTarget.findMany({
      where: { yearMonth: { in: months }, kpiKey: KPI_KEYS.MONTHLY_REVENUE },
    }),
  ]);

  const targetMap = new Map(targets.map((t) => [t.yearMonth, t.targetValue]));

  const trendMonths = months.map((ym) => {
    const { monthStart, monthEnd, daysInMonth } = parseMonth(ym);
    const value = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, false);
    const target = targetMap.get(ym) ?? null;
    const monthNum = parseInt(ym.split("-")[1], 10);
    return { label: `${monthNum}月`, value, target };
  });

  return {
    type: "trend",
    title: "月別売上推移（直近12ヶ月）",
    format: "currency",
    months: trendMonths,
  };
}

async function getRevenueTargetRate(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);
  const [{ contracts, candidates }, targets] = await Promise.all([
    getContractsAndCandidates(monthStart, monthEnd),
    prisma.kpiMonthlyTarget.findMany({ where: { yearMonth } }),
  ]);

  const targetMap = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));
  const revenueTarget = targetMap.get(KPI_KEYS.MONTHLY_REVENUE) ?? 0;
  const actual = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, false);
  const forecast = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, true);
  const rate = revenueTarget > 0 ? Math.round((actual / revenueTarget) * 1000) / 10 : 0;

  return {
    type: "summary",
    title: `${yearMonth} 売上目標達成率`,
    cards: [
      { label: "達成率", value: rate, format: "percent" },
      { label: "実績", value: actual, format: "currency" },
      { label: "目標", value: revenueTarget, format: "currency" },
      { label: "見込み", value: forecast, format: "currency" },
    ],
  };
}

async function getGrossProfit(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart, monthEnd: prevEnd, daysInMonth: prevDays } = parseMonth(prev);

  const [{ contracts, candidates }, targets] = await Promise.all([
    getContractsAndCandidates(prevStart, monthEnd),
    prisma.kpiMonthlyTarget.findMany({ where: { yearMonth } }),
  ]);

  const targetMap = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));
  const fixedCost = targetMap.get(KPI_KEYS.FIXED_COST) ?? DEFAULT_FIXED_COST;

  const actual = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, false);
  const prevActual = calculateRevenue(contracts, candidates, prevStart, prevEnd, prevDays, false);

  const grossProfit = actual - fixedCost;
  const prevGrossProfit = prevActual - fixedCost;
  const changePercent = prevGrossProfit !== 0
    ? Math.round(((grossProfit - prevGrossProfit) / Math.abs(prevGrossProfit)) * 1000) / 10
    : 0;

  return {
    type: "number",
    title: `${yearMonth} 粗利`,
    value: grossProfit,
    format: "currency",
    comparison: { label: "前月", value: prevGrossProfit, changePercent },
    subItems: [
      { label: "売上", value: actual, format: "currency" },
      { label: "固定費", value: fixedCost, format: "currency" },
    ],
  };
}

async function getReceivables(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const records = await prisma.stpRevenueRecord.findMany({
    where: {
      deletedAt: null,
      targetMonth: { gte: monthStart, lte: monthEnd },
      status: { in: ["pending", "approved", "invoiced", "overdue"] },
    },
    select: {
      expectedAmount: true,
      status: true,
      dueDate: true,
      stpCompany: {
        select: {
          company: { select: { name: true } },
        },
      },
      revenueType: true,
    },
    orderBy: { dueDate: "asc" },
  });

  const rows = records.map((r) => ({
    企業名: r.stpCompany.company.name,
    種別: r.revenueType === "initial" ? "初期費用" : r.revenueType === "monthly" ? "月額" : "成果報酬",
    金額: r.expectedAmount,
    ステータス: r.status,
    期限: r.dueDate ? r.dueDate.toISOString().split("T")[0] : "未設定",
  }));

  return {
    type: "table",
    title: `${yearMonth} 売掛金残高`,
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "種別", label: "種別", format: "text" },
      { key: "金額", label: "金額", format: "currency" },
      { key: "ステータス", label: "ステータス", format: "text" },
      { key: "期限", label: "支払期限", format: "text" },
    ],
    rows,
    emptyMessage: "未回収の売掛金はありません",
  };
}

async function getOverdueInvoices(): Promise<InsightResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const records = await prisma.stpRevenueRecord.findMany({
    where: {
      deletedAt: null,
      status: { in: ["invoiced", "overdue"] },
      dueDate: { lt: today },
      paidDate: null,
    },
    select: {
      expectedAmount: true,
      dueDate: true,
      revenueType: true,
      stpCompany: {
        select: { company: { select: { name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows = records.map((r) => {
    const overdueDays = Math.floor((today.getTime() - new Date(r.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
    return {
      企業名: r.stpCompany.company.name,
      金額: r.expectedAmount,
      期限: r.dueDate!.toISOString().split("T")[0],
      遅延日数: overdueDays,
    };
  });

  return {
    type: "table",
    title: "入金遅延リスト",
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "金額", label: "金額", format: "currency" },
      { key: "期限", label: "支払期限", format: "text" },
      { key: "遅延日数", label: "遅延日数", format: "count" },
    ],
    rows,
    emptyMessage: "入金遅延はありません",
  };
}

// ============================================
// 営業パイプライン
// ============================================

async function getSalesFunnel(): Promise<InsightResult> {
  const stages = await prisma.stpStage.findMany({
    where: { isActive: true, stageType: { in: ["progress", "closed_won"] } },
    orderBy: { displayOrder: { sort: "asc", nulls: "last" } },
    select: {
      id: true,
      name: true,
      stageType: true,
      _count: { select: { currentStageCompanies: true } },
    },
  });

  const rows = stages.map((s) => ({
    ステージ: s.name,
    企業数: s._count.currentStageCompanies,
    タイプ: s.stageType === "closed_won" ? "受注" : "進行中",
  }));

  return {
    type: "table",
    title: "セールスファネル",
    columns: [
      { key: "ステージ", label: "ステージ", format: "text" },
      { key: "企業数", label: "企業数", format: "count" },
      { key: "タイプ", label: "タイプ", format: "text" },
    ],
    rows,
    emptyMessage: "ステージが設定されていません",
  };
}

async function getNewLeads(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart, monthEnd: prevEnd } = parseMonth(prev);

  const [current, previous] = await Promise.all([
    prisma.stpCompany.count({
      where: { leadAcquiredDate: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.stpCompany.count({
      where: { leadAcquiredDate: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  const changePercent = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : 0;

  return {
    type: "number",
    title: `${yearMonth} 新規リード数`,
    value: current,
    format: "count",
    comparison: { label: "前月", value: previous, changePercent },
  };
}

async function getConversionRate(): Promise<InsightResult> {
  const [totalLeads, wonCompanies] = await Promise.all([
    prisma.stpCompany.count(),
    prisma.stpStageHistory.findMany({
      where: { eventType: "won", isVoided: false },
      select: { stpCompanyId: true },
      distinct: ["stpCompanyId"],
    }),
  ]);

  const rate = totalLeads > 0 ? Math.round((wonCompanies.length / totalLeads) * 1000) / 10 : 0;

  return {
    type: "number",
    title: "リード→受注 転換率",
    value: rate,
    format: "percent",
    subItems: [
      { label: "受注企業数", value: wonCompanies.length, format: "count" },
      { label: "全リード数", value: totalLeads, format: "count" },
    ],
  };
}

async function getPipelineByStaff(): Promise<InsightResult> {
  const companies = await prisma.stpCompany.findMany({
    where: {
      currentStage: { stageType: "progress" },
    },
    select: {
      salesStaff: { select: { name: true } },
      currentStage: { select: { name: true } },
    },
  });

  const staffMap = new Map<string, number>();
  for (const c of companies) {
    const name = c.salesStaff?.name ?? "未割当";
    staffMap.set(name, (staffMap.get(name) ?? 0) + 1);
  }

  const rows = Array.from(staffMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ 担当者: name, 案件数: count }));

  return {
    type: "table",
    title: "営業担当者別パイプライン",
    columns: [
      { key: "担当者", label: "担当者", format: "text" },
      { key: "案件数", label: "案件数", format: "count" },
    ],
    rows,
    emptyMessage: "進行中の案件はありません",
  };
}

async function getAvgDealDays(): Promise<InsightResult> {
  const wonHistories = await prisma.stpStageHistory.findMany({
    where: { eventType: "won", isVoided: false },
    select: {
      stpCompanyId: true,
      recordedAt: true,
      stpCompany: { select: { leadAcquiredDate: true } },
    },
  });

  const days: number[] = [];
  for (const h of wonHistories) {
    if (h.stpCompany.leadAcquiredDate) {
      const diff = Math.floor(
        (new Date(h.recordedAt).getTime() - new Date(h.stpCompany.leadAcquiredDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      if (diff >= 0) days.push(diff);
    }
  }

  const avg = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;

  return {
    type: "number",
    title: "平均商談期間（リード→受注）",
    value: avg,
    format: "days",
    subItems: [
      { label: "受注企業数", value: days.length, format: "count" },
    ],
  };
}

async function getWonThisMonth(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const wonHistories = await prisma.stpStageHistory.findMany({
    where: {
      eventType: "won",
      isVoided: false,
      recordedAt: { gte: monthStart, lte: monthEnd },
    },
    select: {
      stpCompany: {
        select: {
          company: { select: { name: true } },
          initialFee: true,
          monthlyFee: true,
        },
      },
    },
  });

  const totalInitial = wonHistories.reduce((sum, h) => sum + (h.stpCompany.initialFee ?? 0), 0);
  const totalMonthly = wonHistories.reduce((sum, h) => sum + (h.stpCompany.monthlyFee ?? 0), 0);

  return {
    type: "summary",
    title: `${yearMonth} 受注実績`,
    cards: [
      { label: "受注件数", value: wonHistories.length, format: "count" },
      { label: "初期費用合計", value: totalInitial, format: "currency" },
      { label: "月額合計", value: totalMonthly, format: "currency" },
    ],
    details: wonHistories.map((h) => ({
      label: h.stpCompany.company.name,
      value: `初期: ${formatCurrency(h.stpCompany.initialFee ?? 0)} / 月額: ${formatCurrency(h.stpCompany.monthlyFee ?? 0)}`,
    })),
  };
}

async function getProgressedThisMonth(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const histories = await prisma.stpStageHistory.findMany({
    where: {
      eventType: { in: ["progress", "achieved"] },
      isVoided: false,
      recordedAt: { gte: monthStart, lte: monthEnd },
    },
    select: {
      stpCompany: { select: { company: { select: { name: true } } } },
      fromStage: { select: { name: true } },
      toStage: { select: { name: true } },
      recordedAt: true,
    },
    orderBy: { recordedAt: "desc" },
  });

  const rows = histories.map((h) => ({
    企業名: h.stpCompany.company.name,
    移動元: h.fromStage?.name ?? "-",
    移動先: h.toStage?.name ?? "-",
    日時: h.recordedAt.toISOString().split("T")[0],
  }));

  return {
    type: "table",
    title: `${yearMonth} ステージ前進企業`,
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "移動元", label: "移動元", format: "text" },
      { key: "移動先", label: "移動先", format: "text" },
      { key: "日時", label: "日時", format: "text" },
    ],
    rows,
    emptyMessage: "該当する企業はありません",
  };
}

async function getStaleDeals(): Promise<InsightResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const companies = await prisma.stpCompany.findMany({
    where: {
      currentStage: { stageType: "progress" },
    },
    select: {
      id: true,
      company: { select: { name: true } },
      currentStage: { select: { name: true } },
      salesStaff: { select: { name: true } },
    },
  });

  // 各企業の最新ステージ変更日を取得
  const staleRows: { 企業名: string; ステージ: string; 担当者: string; 滞留日数: number }[] = [];

  for (const c of companies) {
    const latestHistory = await prisma.stpStageHistory.findFirst({
      where: { stpCompanyId: c.id, isVoided: false },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true },
    });

    if (latestHistory && latestHistory.recordedAt < thirtyDaysAgo) {
      const days = Math.floor(
        (new Date().getTime() - new Date(latestHistory.recordedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      staleRows.push({
        企業名: c.company.name,
        ステージ: c.currentStage?.name ?? "-",
        担当者: c.salesStaff?.name ?? "未割当",
        滞留日数: days,
      });
    }
  }

  staleRows.sort((a, b) => b.滞留日数 - a.滞留日数);

  return {
    type: "table",
    title: "滞留案件（30日以上停滞）",
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "ステージ", label: "ステージ", format: "text" },
      { key: "担当者", label: "担当者", format: "text" },
      { key: "滞留日数", label: "滞留日数", format: "count" },
    ],
    rows: staleRows,
    emptyMessage: "30日以上滞留している案件はありません",
  };
}

// ============================================
// 失注分析
// ============================================

async function getLostCount(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart, monthEnd: prevEnd } = parseMonth(prev);

  const [current, previous] = await Promise.all([
    prisma.stpStageHistory.count({
      where: { eventType: "lost", isVoided: false, recordedAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.stpStageHistory.count({
      where: { eventType: "lost", isVoided: false, recordedAt: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  const changePercent = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : 0;

  return {
    type: "number",
    title: `${yearMonth} 失注数`,
    value: current,
    format: "count",
    comparison: { label: "前月", value: previous, changePercent },
  };
}

async function getLostRate(): Promise<InsightResult> {
  const [lostCompanies, totalCompanies] = await Promise.all([
    prisma.stpStageHistory.findMany({
      where: { eventType: "lost", isVoided: false },
      select: { stpCompanyId: true },
      distinct: ["stpCompanyId"],
    }),
    prisma.stpCompany.count(),
  ]);

  const rate = totalCompanies > 0 ? Math.round((lostCompanies.length / totalCompanies) * 1000) / 10 : 0;

  return {
    type: "number",
    title: "全体失注率",
    value: rate,
    format: "percent",
    subItems: [
      { label: "失注企業数", value: lostCompanies.length, format: "count" },
      { label: "全企業数", value: totalCompanies, format: "count" },
    ],
  };
}

async function getTopLostReasons(): Promise<InsightResult> {
  const histories = await prisma.stpStageHistory.findMany({
    where: { eventType: "lost", isVoided: false, lostReason: { not: null } },
    select: { lostReason: true },
    orderBy: { recordedAt: "desc" },
  });

  const reasonMap = new Map<string, number>();
  for (const h of histories) {
    if (h.lostReason) {
      reasonMap.set(h.lostReason, (reasonMap.get(h.lostReason) ?? 0) + 1);
    }
  }

  const items = Array.from(reasonMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({ rank: i + 1, name, value }));

  return {
    type: "ranking",
    title: "失注理由TOP5",
    valueLabel: "件数",
    format: "count",
    items,
    emptyMessage: "失注理由の記録がありません",
  };
}

async function getLostStageDistribution(): Promise<InsightResult> {
  const histories = await prisma.stpStageHistory.findMany({
    where: { eventType: "lost", isVoided: false, fromStageId: { not: null } },
    select: { fromStage: { select: { name: true } } },
  });

  const stageMap = new Map<string, number>();
  for (const h of histories) {
    const name = h.fromStage?.name ?? "不明";
    stageMap.set(name, (stageMap.get(name) ?? 0) + 1);
  }

  const total = histories.length || 1;
  const colors = ["#EF4444", "#F97316", "#F59E0B", "#84CC16", "#06B6D4", "#8B5CF6"];
  const items = Array.from(stageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / total) * 1000) / 10,
      color: colors[i % colors.length],
    }));

  return {
    type: "breakdown",
    title: "失注ステージ分布",
    total: histories.length,
    format: "count",
    items,
  };
}

async function getPendingDeals(): Promise<InsightResult> {
  const pendingStages = await prisma.stpStage.findMany({
    where: { stageType: "pending", isActive: true },
    select: { id: true },
  });

  const companies = await prisma.stpCompany.findMany({
    where: { currentStageId: { in: pendingStages.map((s) => s.id) } },
    select: {
      company: { select: { name: true } },
      salesStaff: { select: { name: true } },
      pendingReason: true,
    },
  });

  const rows = companies.map((c) => ({
    企業名: c.company.name,
    担当者: c.salesStaff?.name ?? "未割当",
    検討理由: c.pendingReason ?? "未記入",
  }));

  return {
    type: "table",
    title: "検討中案件リスト",
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "担当者", label: "担当者", format: "text" },
      { key: "検討理由", label: "検討理由", format: "text" },
    ],
    rows,
    emptyMessage: "検討中の案件はありません",
  };
}

async function getRevivedDeals(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const histories = await prisma.stpStageHistory.findMany({
    where: {
      eventType: "revived",
      isVoided: false,
      recordedAt: { gte: monthStart, lte: monthEnd },
    },
    select: {
      stpCompany: { select: { company: { select: { name: true } } } },
      toStage: { select: { name: true } },
      recordedAt: true,
      note: true,
    },
    orderBy: { recordedAt: "desc" },
  });

  const rows = histories.map((h) => ({
    企業名: h.stpCompany.company.name,
    復活先ステージ: h.toStage?.name ?? "-",
    日時: h.recordedAt.toISOString().split("T")[0],
    備考: h.note ?? "-",
  }));

  return {
    type: "table",
    title: `${yearMonth} 復活案件`,
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "復活先ステージ", label: "復活先", format: "text" },
      { key: "日時", label: "日時", format: "text" },
      { key: "備考", label: "備考", format: "text" },
    ],
    rows,
    emptyMessage: "該当する復活案件はありません",
  };
}

// ============================================
// 顧客・企業
// ============================================

async function getActiveCustomers(yearMonth: string): Promise<InsightResult> {
  const { monthEnd } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthEnd: prevEnd } = parseMonth(prev);

  const [current, previous] = await Promise.all([
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        status: { in: ["active", "cancelled", "dormant"] },
        contractStartDate: { lte: monthEnd },
        OR: [{ contractEndDate: null }, { contractEndDate: { gte: monthEnd } }],
      },
      select: { companyId: true },
      distinct: ["companyId"],
    }),
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        status: { in: ["active", "cancelled", "dormant"] },
        contractStartDate: { lte: prevEnd },
        OR: [{ contractEndDate: null }, { contractEndDate: { gte: prevEnd } }],
      },
      select: { companyId: true },
      distinct: ["companyId"],
    }),
  ]);

  const changePercent = previous.length > 0
    ? Math.round(((current.length - previous.length) / previous.length) * 1000) / 10
    : 0;

  return {
    type: "number",
    title: `${yearMonth} アクティブ顧客数`,
    value: current.length,
    format: "count",
    comparison: { label: "前月", value: previous.length, changePercent },
  };
}

async function getCustomerRevenueRanking(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);

  const contracts = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "cancelled", "dormant"] },
      contractStartDate: { lte: monthEnd },
      OR: [{ contractEndDate: null }, { contractEndDate: { gte: monthStart } }],
    },
    select: {
      companyId: true,
      monthlyFee: true,
      contractStartDate: true,
      contractEndDate: true,
      company: { select: { name: true } },
    },
  });

  const revenueByCompany = new Map<number, { name: string; revenue: number }>();
  for (const c of contracts) {
    const contractStart = new Date(c.contractStartDate);
    const contractEnd = c.contractEndDate ? new Date(c.contractEndDate) : null;
    const effectiveStart = contractStart > monthStart ? contractStart : monthStart;
    const effectiveEnd = contractEnd ? (contractEnd < monthEnd ? contractEnd : monthEnd) : monthEnd;

    if (effectiveStart <= effectiveEnd) {
      const activeDays = Math.floor(
        (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      const revenue = Math.round((c.monthlyFee * activeDays) / daysInMonth);
      const existing = revenueByCompany.get(c.companyId);
      if (existing) {
        existing.revenue += revenue;
      } else {
        revenueByCompany.set(c.companyId, { name: c.company.name, revenue });
      }
    }
  }

  const items = Array.from(revenueByCompany.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((item, i) => ({ rank: i + 1, name: item.name, value: item.revenue }));

  return {
    type: "ranking",
    title: `${yearMonth} 顧客別月額売上TOP10`,
    valueLabel: "月額売上",
    format: "currency",
    items,
    emptyMessage: "アクティブな顧客がいません",
  };
}

async function getExpiringContracts(): Promise<InsightResult> {
  const today = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const contracts = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: "active",
      contractEndDate: { gte: today, lte: thirtyDaysLater },
    },
    select: {
      company: { select: { name: true } },
      contractEndDate: true,
      monthlyFee: true,
      contractPlan: true,
    },
    orderBy: { contractEndDate: "asc" },
  });

  const rows = contracts.map((c) => ({
    企業名: c.company.name,
    プラン: c.contractPlan === "monthly" ? "月額" : "成果報酬",
    月額: c.monthlyFee,
    終了日: c.contractEndDate!.toISOString().split("T")[0],
    残日数: Math.floor((new Date(c.contractEndDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return {
    type: "table",
    title: "契約終了間近の顧客（30日以内）",
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "プラン", label: "プラン", format: "text" },
      { key: "月額", label: "月額", format: "currency" },
      { key: "終了日", label: "終了日", format: "text" },
      { key: "残日数", label: "残日数", format: "count" },
    ],
    rows,
    emptyMessage: "30日以内に終了する契約はありません",
  };
}

async function getContractPlanDistribution(): Promise<InsightResult> {
  const contracts = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: "active",
    },
    select: { contractPlan: true },
  });

  const planMap = new Map<string, number>();
  for (const c of contracts) {
    const label = c.contractPlan === "monthly" ? "月額プラン" : c.contractPlan === "performance" ? "成果報酬プラン" : c.contractPlan;
    planMap.set(label, (planMap.get(label) ?? 0) + 1);
  }

  const total = contracts.length || 1;
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];
  const items = Array.from(planMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / total) * 1000) / 10,
      color: colors[i % colors.length],
    }));

  return {
    type: "breakdown",
    title: "契約プラン別分布",
    total: contracts.length,
    format: "count",
    items,
  };
}

async function getAvgContractValue(): Promise<InsightResult> {
  const contracts = await prisma.stpContractHistory.findMany({
    where: { deletedAt: null, status: { in: ["active", "cancelled", "dormant"] } },
    select: { initialFee: true, monthlyFee: true, performanceFee: true },
  });

  const count = contracts.length || 1;
  const avgInitial = Math.round(contracts.reduce((s, c) => s + c.initialFee, 0) / count);
  const avgMonthly = Math.round(contracts.reduce((s, c) => s + c.monthlyFee, 0) / count);
  const avgPerformance = Math.round(contracts.reduce((s, c) => s + c.performanceFee, 0) / count);

  return {
    type: "summary",
    title: "平均契約単価",
    cards: [
      { label: "平均初期費用", value: avgInitial, format: "currency" },
      { label: "平均月額", value: avgMonthly, format: "currency" },
      { label: "平均成果報酬", value: avgPerformance, format: "currency" },
      { label: "契約数", value: contracts.length, format: "count" },
    ],
  };
}

async function getIndustryDistribution(): Promise<InsightResult> {
  const contracts = await prisma.stpContractHistory.findMany({
    where: { deletedAt: null, status: "active" },
    select: { industryType: true },
  });

  const typeMap = new Map<string, number>();
  for (const c of contracts) {
    const label = c.industryType === "general" ? "一般" : c.industryType === "dispatch" ? "派遣" : c.industryType;
    typeMap.set(label, (typeMap.get(label) ?? 0) + 1);
  }

  const total = contracts.length || 1;
  const colors = ["#3B82F6", "#F59E0B"];
  const items = Array.from(typeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / total) * 1000) / 10,
      color: colors[i % colors.length],
    }));

  return {
    type: "breakdown",
    title: "業種区分別分布",
    total: contracts.length,
    format: "count",
    items,
  };
}

// ============================================
// 代理店
// ============================================

async function getAgentLeadRanking(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const companies = await prisma.stpCompany.findMany({
    where: {
      leadAcquiredDate: { gte: monthStart, lte: monthEnd },
      agentId: { not: null },
    },
    select: {
      agent: { select: { id: true, company: { select: { name: true } } } },
    },
  });

  const agentMap = new Map<number, { name: string; count: number }>();
  for (const c of companies) {
    if (c.agent) {
      const existing = agentMap.get(c.agent.id);
      if (existing) {
        existing.count++;
      } else {
        agentMap.set(c.agent.id, { name: c.agent.company.name, count: 1 });
      }
    }
  }

  const items = Array.from(agentMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((item, i) => ({ rank: i + 1, name: item.name, value: item.count }));

  return {
    type: "ranking",
    title: `${yearMonth} 代理店別リード獲得TOP10`,
    valueLabel: "リード数",
    format: "count",
    items,
    emptyMessage: "該当月のリード獲得記録がありません",
  };
}

async function getAgentWonRanking(): Promise<InsightResult> {
  const wonHistories = await prisma.stpStageHistory.findMany({
    where: { eventType: "won", isVoided: false },
    select: {
      stpCompany: {
        select: {
          agent: { select: { id: true, company: { select: { name: true } } } },
        },
      },
    },
  });

  const agentMap = new Map<number, { name: string; count: number }>();
  for (const h of wonHistories) {
    const agent = h.stpCompany.agent;
    if (agent) {
      const existing = agentMap.get(agent.id);
      if (existing) {
        existing.count++;
      } else {
        agentMap.set(agent.id, { name: agent.company.name, count: 1 });
      }
    }
  }

  const items = Array.from(agentMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((item, i) => ({ rank: i + 1, name: item.name, value: item.count }));

  return {
    type: "ranking",
    title: "代理店別受注件数ランキング",
    valueLabel: "受注数",
    format: "count",
    items,
    emptyMessage: "代理店経由の受注記録がありません",
  };
}

async function getAgentPaymentTotal(yearMonth: string): Promise<InsightResult> {
  const { monthStart } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart } = parseMonth(prev);

  const targetMonthDate = monthStart; // 月初日

  const [current, previous] = await Promise.all([
    prisma.stpExpenseRecord.aggregate({
      where: {
        deletedAt: null,
        targetMonth: targetMonthDate,
        status: { not: "cancelled" },
      },
      _sum: { expectedAmount: true },
    }),
    prisma.stpExpenseRecord.aggregate({
      where: {
        deletedAt: null,
        targetMonth: prevStart,
        status: { not: "cancelled" },
      },
      _sum: { expectedAmount: true },
    }),
  ]);

  const currentTotal = current._sum.expectedAmount ?? 0;
  const prevTotal = previous._sum.expectedAmount ?? 0;
  const changePercent = prevTotal > 0
    ? Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10
    : 0;

  return {
    type: "number",
    title: `${yearMonth} 代理店支払総額`,
    value: currentTotal,
    format: "currency",
    comparison: { label: "前月", value: prevTotal, changePercent },
  };
}

async function getActiveAgents(): Promise<InsightResult> {
  const agents = await prisma.stpAgent.findMany({
    select: { status: true, category1: true },
  });

  const active = agents.filter((a) => a.status === "アクティブ").length;
  const total = agents.length;
  const advisors = agents.filter((a) => a.category1 === "advisor").length;
  const partners = agents.filter((a) => a.category1 !== "advisor").length;

  return {
    type: "summary",
    title: "代理店サマリー",
    cards: [
      { label: "アクティブ", value: active, format: "count" },
      { label: "全代理店", value: total, format: "count" },
      { label: "代理店", value: partners, format: "count" },
      { label: "顧問", value: advisors, format: "count" },
    ],
  };
}

async function getAgentCategoryDistribution(): Promise<InsightResult> {
  const agents = await prisma.stpAgent.findMany({
    where: { status: "アクティブ" },
    select: { category1: true },
  });

  const categoryMap = new Map<string, number>();
  for (const a of agents) {
    const label = a.category1 === "advisor" ? "顧問" : "代理店";
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + 1);
  }

  const total = agents.length || 1;
  const items = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / total) * 1000) / 10,
      color: i === 0 ? "#3B82F6" : "#F59E0B",
    }));

  return {
    type: "breakdown",
    title: "代理店カテゴリ分布",
    total: agents.length,
    format: "count",
    items,
  };
}

// ============================================
// 契約書
// ============================================

async function getUnsignedContracts(): Promise<InsightResult> {
  const progressStatuses = await prisma.masterContractStatus.findMany({
    where: { statusType: "progress" },
    select: { id: true },
  });

  const contracts = await prisma.masterContract.findMany({
    where: {
      projectId: STP_PROJECT_ID,
      currentStatusId: { in: progressStatuses.map((s) => s.id) },
    },
    include: {
      company: { select: { name: true } },
      currentStatus: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = contracts.map((c) => ({
    契約番号: c.contractNumber ?? "-",
    タイトル: c.title ?? "-",
    企業名: c.company?.name ?? "-",
    ステータス: c.currentStatus?.name ?? "-",
    作成日: c.createdAt.toISOString().split("T")[0],
  }));

  return {
    type: "table",
    title: "未締結契約書リスト",
    columns: [
      { key: "契約番号", label: "契約番号", format: "text" },
      { key: "タイトル", label: "タイトル", format: "text" },
      { key: "企業名", label: "企業名", format: "text" },
      { key: "ステータス", label: "ステータス", format: "text" },
      { key: "作成日", label: "作成日", format: "text" },
    ],
    rows,
    emptyMessage: "未締結の契約書はありません",
  };
}

async function getCloudsignPending(): Promise<InsightResult> {
  const contracts = await prisma.masterContract.findMany({
    where: {
      projectId: STP_PROJECT_ID,
      cloudsignDocumentId: { not: null },
      cloudsignStatus: { not: null, notIn: ["completed", "cancelled"] },
    },
    include: {
      company: { select: { name: true } },
    },
    orderBy: { cloudsignSentAt: "asc" },
  });

  const rows = contracts.map((c) => ({
    契約番号: c.contractNumber ?? "-",
    タイトル: c.title ?? "-",
    企業名: c.company?.name ?? "-",
    CloudSignステータス: c.cloudsignStatus ?? "-",
    送付日: c.cloudsignSentAt?.toISOString().split("T")[0] ?? "-",
  }));

  return {
    type: "table",
    title: "CloudSign送付中の契約書",
    columns: [
      { key: "契約番号", label: "契約番号", format: "text" },
      { key: "タイトル", label: "タイトル", format: "text" },
      { key: "企業名", label: "企業名", format: "text" },
      { key: "CloudSignステータス", label: "CS状態", format: "text" },
      { key: "送付日", label: "送付日", format: "text" },
    ],
    rows,
    emptyMessage: "CloudSign送付中の契約書はありません",
  };
}

async function getAvgSigningDays(): Promise<InsightResult> {
  const signedStatuses = await prisma.masterContractStatus.findMany({
    where: { statusType: "signed" },
    select: { id: true },
  });

  const contracts = await prisma.masterContract.findMany({
    where: {
      projectId: STP_PROJECT_ID,
      currentStatusId: { in: signedStatuses.map((s) => s.id) },
      signedDate: { not: null },
    },
    select: { createdAt: true, signedDate: true },
  });

  const days: number[] = [];
  for (const c of contracts) {
    if (c.signedDate) {
      const diff = Math.floor(
        (new Date(c.signedDate).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diff >= 0) days.push(diff);
    }
  }

  const avg = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;

  return {
    type: "number",
    title: "平均締結日数",
    value: avg,
    format: "days",
    subItems: [
      { label: "締結済み契約数", value: days.length, format: "count" },
    ],
  };
}

async function getSignedThisMonth(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const contracts = await prisma.masterContract.findMany({
    where: {
      projectId: STP_PROJECT_ID,
      signedDate: { gte: monthStart, lte: monthEnd },
    },
    include: {
      company: { select: { name: true } },
    },
    orderBy: { signedDate: "desc" },
  });

  const rows = contracts.map((c) => ({
    契約番号: c.contractNumber ?? "-",
    タイトル: c.title ?? "-",
    企業名: c.company?.name ?? "-",
    締結日: c.signedDate!.toISOString().split("T")[0],
  }));

  return {
    type: "table",
    title: `${yearMonth} 締結された契約書`,
    columns: [
      { key: "契約番号", label: "契約番号", format: "text" },
      { key: "タイトル", label: "タイトル", format: "text" },
      { key: "企業名", label: "企業名", format: "text" },
      { key: "締結日", label: "締結日", format: "text" },
    ],
    rows,
    emptyMessage: "該当月に締結された契約書はありません",
  };
}

// ============================================
// 経費・支払
// ============================================

async function getMonthlyExpenses(yearMonth: string): Promise<InsightResult> {
  const { monthStart } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart } = parseMonth(prev);

  const [current, previous] = await Promise.all([
    prisma.stpExpenseRecord.aggregate({
      where: { deletedAt: null, targetMonth: monthStart, status: { not: "cancelled" } },
      _sum: { expectedAmount: true },
    }),
    prisma.stpExpenseRecord.aggregate({
      where: { deletedAt: null, targetMonth: prevStart, status: { not: "cancelled" } },
      _sum: { expectedAmount: true },
    }),
  ]);

  const currentTotal = current._sum.expectedAmount ?? 0;
  const prevTotal = previous._sum.expectedAmount ?? 0;
  const changePercent = prevTotal > 0
    ? Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10
    : 0;

  return {
    type: "number",
    title: `${yearMonth} 経費合計`,
    value: currentTotal,
    format: "currency",
    comparison: { label: "前月", value: prevTotal, changePercent },
  };
}

async function getExpenseTypeBreakdown(yearMonth: string): Promise<InsightResult> {
  const { monthStart } = parseMonth(yearMonth);

  const expenses = await prisma.stpExpenseRecord.findMany({
    where: { deletedAt: null, targetMonth: monthStart, status: { not: "cancelled" } },
    select: { expenseType: true, expectedAmount: true },
  });

  const typeLabels: Record<string, string> = {
    agent_initial: "代理店初期費用",
    agent_monthly: "代理店月額",
    commission_initial: "紹介報酬（初期）",
    commission_performance: "紹介報酬（成果）",
    commission_monthly: "紹介報酬（月額）",
  };

  const typeMap = new Map<string, number>();
  for (const e of expenses) {
    const label = typeLabels[e.expenseType] ?? e.expenseType;
    typeMap.set(label, (typeMap.get(label) ?? 0) + e.expectedAmount);
  }

  const total = expenses.reduce((s, e) => s + e.expectedAmount, 0) || 1;
  const colors = ["#EF4444", "#F97316", "#F59E0B", "#10B981", "#3B82F6"];
  const items = Array.from(typeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / total) * 1000) / 10,
      color: colors[i % colors.length],
    }));

  return {
    type: "breakdown",
    title: `${yearMonth} 経費種別内訳`,
    total: expenses.reduce((s, e) => s + e.expectedAmount, 0),
    format: "currency",
    items,
  };
}

async function getUnpaidExpenses(): Promise<InsightResult> {
  const expenses = await prisma.stpExpenseRecord.findMany({
    where: {
      deletedAt: null,
      status: { in: ["pending", "approved"] },
    },
    select: {
      expectedAmount: true,
      expenseType: true,
      targetMonth: true,
      agent: { select: { company: { select: { name: true } } } },
    },
    orderBy: { targetMonth: "asc" },
    take: 50,
  });

  const typeLabels: Record<string, string> = {
    agent_initial: "初期費用",
    agent_monthly: "月額",
    commission_initial: "報酬（初期）",
    commission_performance: "報酬（成果）",
    commission_monthly: "報酬（月額）",
  };

  const rows = expenses.map((e) => ({
    代理店: e.agent.company.name,
    種別: typeLabels[e.expenseType] ?? e.expenseType,
    金額: e.expectedAmount,
    対象月: e.targetMonth.toISOString().split("T")[0].slice(0, 7),
  }));

  return {
    type: "table",
    title: "未払い経費リスト",
    columns: [
      { key: "代理店", label: "代理店", format: "text" },
      { key: "種別", label: "種別", format: "text" },
      { key: "金額", label: "金額", format: "currency" },
      { key: "対象月", label: "対象月", format: "text" },
    ],
    rows,
    emptyMessage: "未払いの経費はありません",
  };
}

// ============================================
// 活動・接触
// ============================================

async function getContactCount(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart, monthEnd: prevEnd } = parseMonth(prev);

  const [contacts, prevContacts] = await Promise.all([
    prisma.contactHistory.findMany({
      where: {
        deletedAt: null,
        contactDate: { gte: monthStart, lte: monthEnd },
        roles: { some: { customerType: { projectId: STP_PROJECT_ID } } },
      },
      select: {
        contactMethod: { select: { name: true } },
      },
    }),
    prisma.contactHistory.count({
      where: {
        deletedAt: null,
        contactDate: { gte: prevStart, lte: prevEnd },
        roles: { some: { customerType: { projectId: STP_PROJECT_ID } } },
      },
    }),
    prisma.contactMethod.findMany({ select: { id: true, name: true } }),
  ]);

  const methodMap = new Map<string, number>();
  for (const c of contacts) {
    const name = c.contactMethod?.name ?? "不明";
    methodMap.set(name, (methodMap.get(name) ?? 0) + 1);
  }

  const changePercent = prevContacts > 0
    ? Math.round(((contacts.length - prevContacts) / prevContacts) * 1000) / 10
    : 0;

  const cards = [
    { label: "接触件数", value: contacts.length, format: "count" as const, changePercent },
    { label: "前月", value: prevContacts, format: "count" as const },
  ];

  const details = Array.from(methodMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: `${value}件` }));

  return {
    type: "summary",
    title: `${yearMonth} 接触件数`,
    cards,
    details,
  };
}

async function getContactRankingByStaff(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const contacts = await prisma.contactHistory.findMany({
    where: {
      deletedAt: null,
      contactDate: { gte: monthStart, lte: monthEnd },
      roles: { some: { customerType: { projectId: STP_PROJECT_ID } } },
    },
    select: {
      staff: { select: { name: true } },
    },
  });

  const staffMap = new Map<string, number>();
  for (const c of contacts) {
    const name = c.staff?.name ?? "不明";
    staffMap.set(name, (staffMap.get(name) ?? 0) + 1);
  }

  const items = Array.from(staffMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value], i) => ({ rank: i + 1, name, value }));

  return {
    type: "ranking",
    title: `${yearMonth} 担当者別接触件数TOP10`,
    valueLabel: "接触件数",
    format: "count",
    items,
    emptyMessage: "該当月の接触記録がありません",
  };
}

async function getInactiveCustomers(): Promise<InsightResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // アクティブ顧客を取得
  const activeContracts = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: "active",
      OR: [{ contractEndDate: null }, { contractEndDate: { gte: new Date() } }],
    },
    select: {
      companyId: true,
      company: { select: { name: true } },
    },
    distinct: ["companyId"],
  });

  const results: { 企業名: string; 最終接触日: string; 未接触日数: number }[] = [];

  for (const contract of activeContracts) {
    const latestContact = await prisma.contactHistory.findFirst({
      where: {
        companyId: contract.companyId,
        deletedAt: null,
      },
      orderBy: { contactDate: "desc" },
      select: { contactDate: true },
    });

    if (!latestContact || new Date(latestContact.contactDate) < thirtyDaysAgo) {
      const lastDate = latestContact ? new Date(latestContact.contactDate) : null;
      const daysSince = lastDate
        ? Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      results.push({
        企業名: contract.company.name,
        最終接触日: lastDate ? lastDate.toISOString().split("T")[0] : "記録なし",
        未接触日数: daysSince,
      });
    }
  }

  results.sort((a, b) => b.未接触日数 - a.未接触日数);

  return {
    type: "table",
    title: "最近接触がない顧客（30日以上）",
    columns: [
      { key: "企業名", label: "企業名", format: "text" },
      { key: "最終接触日", label: "最終接触日", format: "text" },
      { key: "未接触日数", label: "未接触日数", format: "count" },
    ],
    rows: results,
    emptyMessage: "全顧客に30日以内の接触記録があります",
  };
}

async function getContactMethodDistribution(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  const contacts = await prisma.contactHistory.findMany({
    where: {
      deletedAt: null,
      contactDate: { gte: monthStart, lte: monthEnd },
      roles: { some: { customerType: { projectId: STP_PROJECT_ID } } },
    },
    select: {
      contactMethod: { select: { name: true } },
    },
  });

  const methodMap = new Map<string, number>();
  for (const c of contacts) {
    const name = c.contactMethod?.name ?? "不明";
    methodMap.set(name, (methodMap.get(name) ?? 0) + 1);
  }

  const total = contacts.length || 1;
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];
  const items = Array.from(methodMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / total) * 1000) / 10,
      color: colors[i % colors.length],
    }));

  return {
    type: "breakdown",
    title: `${yearMonth} 接触方法別分布`,
    total: contacts.length,
    format: "count",
    items,
  };
}

// ============================================
// KPI・採用
// ============================================

async function getKpiAchievement(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);

  const [targets, { contracts, candidates }] = await Promise.all([
    prisma.kpiMonthlyTarget.findMany({ where: { yearMonth } }),
    getContractsAndCandidates(monthStart, monthEnd),
  ]);

  const targetMap = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  // 実績を計算
  const revenueActual = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, false);
  const fixedCost = targetMap.get(KPI_KEYS.FIXED_COST) ?? DEFAULT_FIXED_COST;
  const grossProfitActual = revenueActual - fixedCost;

  const newContractCompanies = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "cancelled", "dormant"] },
      contractStartDate: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  const leadsCount = await prisma.stpCompany.count({
    where: { leadAcquiredDate: { gte: monthStart, lte: monthEnd } },
  });

  const kpiItems: { 項目: string; 目標: number | string; 実績: number | string; 達成率: string }[] = [];

  const addRow = (key: string, label: string, actual: number, format: (n: number) => string) => {
    const target = targetMap.get(key);
    const rate = target && target > 0 ? Math.round((actual / target) * 1000) / 10 : "-";
    kpiItems.push({
      項目: label,
      目標: target ? format(target) : "未設定",
      実績: format(actual),
      達成率: typeof rate === "number" ? `${rate}%` : rate,
    });
  };

  addRow(KPI_KEYS.MONTHLY_REVENUE, "月次売上", revenueActual, (n) => formatCurrency(n));
  addRow(KPI_KEYS.MONTHLY_GROSS_PROFIT, "月次粗利", grossProfitActual, (n) => formatCurrency(n));
  addRow(KPI_KEYS.NEW_CONTRACTS, "新規契約", newContractCompanies.length, (n) => `${n}社`);
  addRow(KPI_KEYS.MONTHLY_LEADS, "月間リード", leadsCount, (n) => `${n}件`);

  return {
    type: "table",
    title: `${yearMonth} KPI達成状況`,
    columns: [
      { key: "項目", label: "項目", format: "text" },
      { key: "目標", label: "目標", format: "text" },
      { key: "実績", label: "実績", format: "text" },
      { key: "達成率", label: "達成率", format: "text" },
    ],
    rows: kpiItems,
  };
}

async function getCandidateJoinCount(yearMonth: string): Promise<InsightResult> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);
  const prev = prevYearMonth(yearMonth);
  const { monthStart: prevStart, monthEnd: prevEnd } = parseMonth(prev);

  const [current, previous] = await Promise.all([
    prisma.stpCandidate.count({
      where: { deletedAt: null, joinDate: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.stpCandidate.count({
      where: { deletedAt: null, joinDate: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  const changePercent = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : 0;

  return {
    type: "number",
    title: `${yearMonth} 入社実績`,
    value: current,
    format: "count",
    comparison: { label: "前月", value: previous, changePercent },
  };
}

async function getCandidateMediaBreakdown(): Promise<InsightResult> {
  const candidates = await prisma.stpCandidate.findMany({
    where: { deletedAt: null },
    select: { jobMedia: true },
  });

  const mediaMap = new Map<string, number>();
  for (const c of candidates) {
    const media = c.jobMedia ?? "不明";
    mediaMap.set(media, (mediaMap.get(media) ?? 0) + 1);
  }

  const total = candidates.length || 1;
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];
  const items = Array.from(mediaMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / total) * 1000) / 10,
      color: colors[i % colors.length],
    }));

  return {
    type: "breakdown",
    title: "メディア別応募実績",
    total: candidates.length,
    format: "count",
    items,
  };
}
