"use server";

import { prisma } from "@/lib/prisma";
import { KPI_KEYS, DEFAULT_FIXED_COST } from "@/lib/kpi/constants";

// ============================================
// 型定義
// ============================================

export type KgiData = {
  revenue: {
    actual: number;
    target: number;
    prevMonth: number;
    achievementRate: number;
  };
  grossProfit: {
    actual: number;
    target: number;
    expense: number;
    fixedCost: number;
    prevMonth: number;
  };
  adoptionRate: null; // 開発中
  applicationRate: null; // 開発中
  newContracts: {
    actual: number;
    target: number;
    prevMonth: number;
    achievementRate: number;
  };
};

// ============================================
// ヘルパー
// ============================================

/** "2026-03" → { monthStart, monthEnd, daysInMonth } */
function parseMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0); // 月末
  const daysInMonth = monthEnd.getDate();
  return { monthStart, monthEnd, daysInMonth, year: y, month: m };
}

/** 前月の yearMonth を返す */
function prevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Date → "YYYY-MM" */
function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 取引の税込金額を計算する */
function calcTotalWithTax(tx: {
  amount: number;
  taxAmount: number;
  taxType: string;
}): number {
  return tx.taxType === "tax_included"
    ? tx.amount
    : tx.amount + tx.taxAmount;
}

/** yearMonthが過去月かどうか判定 */
function isPastMonth(yearMonth: string): boolean {
  return yearMonth < toYearMonth(new Date());
}

// ============================================
// 1. KGI 5指標
// ============================================

// InvoiceGroupの確定済みステータス
const CONFIRMED_INVOICE_STATUSES = [
  "sent",
  "awaiting_accounting",
  "partially_paid",
  "paid",
];

// PaymentGroupの確定済みステータス
const CONFIRMED_PAYMENT_STATUSES = ["confirmed", "paid"];

export async function getDashboardKgiData(
  yearMonth: string
): Promise<KgiData> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);
  const prevMonth = prevYearMonth(yearMonth);
  const { monthStart: prevMonthStart, monthEnd: prevMonthEnd } =
    parseMonth(prevMonth);

  // 過去月は確定済み取引のみ、当月・未来月は全取引を集計
  const past = isPastMonth(yearMonth);
  const prevIsPast = isPastMonth(prevMonth);

  // periodFrom の範囲（当月＋前月をまとめて取得）
  const periodStart = prevMonthStart;
  const periodEnd = monthEnd;

  // --- 並列データ取得 ---
  const [
    revenueTransactions,
    expenseTransactions,
    targets,
    newContractsCurrent,
    newContractsPrev,
  ] = await Promise.all([
    // 売上取引（当月＋前月）
    prisma.transaction.findMany({
      where: {
        type: "revenue",
        periodFrom: { gte: periodStart, lte: periodEnd },
      },
      select: {
        amount: true,
        taxAmount: true,
        taxType: true,
        periodFrom: true,
        invoiceGroupId: true,
        invoiceGroup: {
          select: { status: true },
        },
      },
    }),

    // 支払取引（当月＋前月）
    prisma.transaction.findMany({
      where: {
        type: "expense",
        periodFrom: { gte: periodStart, lte: periodEnd },
      },
      select: {
        amount: true,
        taxAmount: true,
        taxType: true,
        periodFrom: true,
        paymentGroupId: true,
        paymentGroup: {
          select: { status: true },
        },
      },
    }),

    // KPI目標値（当月）
    prisma.kpiMonthlyTarget.findMany({
      where: { yearMonth },
    }),

    // 新規契約数（当月）: 基本契約 + signedDate が対象月内
    prisma.masterContract.findMany({
      where: {
        projectId: 1, // STP
        contractType: "基本契約",
        signedDate: { gte: monthStart, lte: monthEnd },
      },
      select: { companyId: true },
      distinct: ["companyId"],
    }),

    // 新規契約数（前月）
    prisma.masterContract.findMany({
      where: {
        projectId: 1, // STP
        contractType: "基本契約",
        signedDate: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      select: { companyId: true },
      distinct: ["companyId"],
    }),
  ]);

  // 目標値をMap化
  const targetMap = new Map<string, number>(
    targets.map((t) => [t.kpiKey, t.targetValue])
  );
  const revenueTarget = targetMap.get(KPI_KEYS.MONTHLY_REVENUE) ?? 0;
  const grossProfitTarget =
    targetMap.get(KPI_KEYS.MONTHLY_GROSS_PROFIT) ?? 0;
  const newContractsTarget = targetMap.get(KPI_KEYS.NEW_CONTRACTS) ?? 0;
  const fixedCost =
    targetMap.get(KPI_KEYS.FIXED_COST) ?? DEFAULT_FIXED_COST;

  // --- 売上計算ヘルパー ---
  function sumRevenue(
    targetYearMonth: string,
    isPast: boolean
  ): number {
    const { monthStart: ms, monthEnd: me } = parseMonth(targetYearMonth);
    let total = 0;
    for (const tx of revenueTransactions) {
      const pf = new Date(tx.periodFrom);
      if (pf < ms || pf > me) continue;

      if (isPast) {
        // 過去月: 確定済みInvoiceGroupのもの or invoiceGroupIdがnullのもの
        if (tx.invoiceGroupId !== null) {
          if (
            !tx.invoiceGroup ||
            !CONFIRMED_INVOICE_STATUSES.includes(tx.invoiceGroup.status)
          ) {
            continue;
          }
        }
      }
      // 当月・未来月: 全取引を合計（予定額ベース）

      total += calcTotalWithTax(tx);
    }
    return total;
  }

  // --- 支払計算ヘルパー ---
  function sumExpense(
    targetYearMonth: string,
    isPast: boolean
  ): number {
    const { monthStart: ms, monthEnd: me } = parseMonth(targetYearMonth);
    let total = 0;
    for (const tx of expenseTransactions) {
      const pf = new Date(tx.periodFrom);
      if (pf < ms || pf > me) continue;

      if (isPast) {
        // 過去月: 確定済みPaymentGroupのもの or paymentGroupIdがnullのもの
        if (tx.paymentGroupId !== null) {
          if (
            !tx.paymentGroup ||
            !CONFIRMED_PAYMENT_STATUSES.includes(tx.paymentGroup.status)
          ) {
            continue;
          }
        }
      }
      // 当月・未来月: 全取引を合計（予定額ベース）

      total += calcTotalWithTax(tx);
    }
    return total;
  }

  // ========================================
  // ① 月次売上
  // ========================================
  // 当月: 全取引を合計（予定額ベース） → isPast = false
  // 過去月: 確定済みのみ → isPast = true
  const revenueActual = sumRevenue(yearMonth, past);
  const revenuePrevMonth = sumRevenue(prevMonth, prevIsPast);

  // ========================================
  // ② 月次粗利 = 売上 − 支払額 − 固定費
  // ========================================
  const expenseActual = sumExpense(yearMonth, past);
  const expensePrevMonth = sumExpense(prevMonth, prevIsPast);

  const grossProfitActual = revenueActual - expenseActual - fixedCost;
  const grossProfitPrevMonth =
    revenuePrevMonth - expensePrevMonth - fixedCost;

  // ========================================
  // ⑤ 新規契約数
  // ========================================
  const newContractsActual = newContractsCurrent.length;
  const newContractsPrevMonth = newContractsPrev.length;

  return {
    revenue: {
      actual: revenueActual,
      target: revenueTarget,
      prevMonth: revenuePrevMonth,
      achievementRate:
        revenueTarget > 0
          ? Math.round((revenueActual / revenueTarget) * 1000) / 10
          : 0,
    },
    grossProfit: {
      actual: grossProfitActual,
      target: grossProfitTarget,
      expense: expenseActual,
      fixedCost,
      prevMonth: grossProfitPrevMonth,
    },
    adoptionRate: null,
    applicationRate: null,
    newContracts: {
      actual: newContractsActual,
      target: newContractsTarget,
      prevMonth: newContractsPrevMonth,
      achievementRate:
        newContractsTarget > 0
          ? Math.round((newContractsActual / newContractsTarget) * 1000) / 10
          : 0,
    },
  };
}

// ============================================
// 2. 月次売上推移（計画 vs 実績）
// ============================================

export type RevenueTrendMonth = {
  yearMonth: string;
  label: string;
  target: number | null;
  actual: number | null;
  forecast: number | null;
};

export type RevenueTrendData = {
  months: RevenueTrendMonth[];
};

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

  // 有効ステータスのフィルタ
  const validStatuses = includeScheduled
    ? ["active", "cancelled", "dormant", "scheduled"]
    : ["active", "cancelled", "dormant"];

  const filtered = contracts.filter((c) => validStatuses.includes(c.status));

  // 各契約に対して計算
  for (const c of filtered) {
    const contractStart = new Date(c.contractStartDate);
    const contractEnd = c.contractEndDate
      ? new Date(c.contractEndDate)
      : null;

    // 契約期間が対象月と重なるか確認
    if (contractStart > monthEnd) continue;
    if (contractEnd && contractEnd < monthStart) continue;

    // 1. 初期費用: contractStartDate が対象月内なら全額加算
    if (contractStart >= monthStart && contractStart <= monthEnd) {
      total += c.initialFee;
    }

    // 2. 月額費用（日割按分）
    const effectiveStart =
      contractStart > monthStart ? contractStart : monthStart;
    const effectiveEnd = contractEnd
      ? contractEnd < monthEnd
        ? contractEnd
        : monthEnd
      : monthEnd;

    if (effectiveStart <= effectiveEnd) {
      const activeDays =
        Math.floor(
          (effectiveEnd.getTime() - effectiveStart.getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;
      const proRatedFee = Math.round(
        (c.monthlyFee * activeDays) / daysInMonth
      );
      total += proRatedFee;
    }

    // 3. 成果報酬: joinDate が対象月内の候補者
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

export async function getRevenueTrendData(
  yearMonth: string
): Promise<RevenueTrendData> {
  // 決算期首月を取得
  const fiscalStartRecord = await prisma.kpiMonthlyTarget.findUnique({
    where: {
      yearMonth_kpiKey: {
        yearMonth: "0000-00",
        kpiKey: "fiscal_year_start",
      },
    },
  });
  const fiscalStartMonth = fiscalStartRecord?.targetValue ?? 4;

  // 選択月が含まれる年度の算出
  const [selYear, selMonth] = yearMonth.split("-").map(Number);
  let fiscalYearStartYear: number;
  if (selMonth >= fiscalStartMonth) {
    fiscalYearStartYear = selYear;
  } else {
    fiscalYearStartYear = selYear - 1;
  }

  // 年度の12ヶ月を算出
  const fiscalMonths: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(fiscalYearStartYear, fiscalStartMonth - 1 + i, 1);
    fiscalMonths.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  // 全月のデータを一括取得
  const firstMonth = fiscalMonths[0];
  const lastMonth = fiscalMonths[fiscalMonths.length - 1];
  const firstParsed = parseMonth(firstMonth);
  const lastParsed = parseMonth(lastMonth);

  const [contracts, candidates, targets] = await Promise.all([
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        contractStartDate: { lte: lastParsed.monthEnd },
        OR: [
          { contractEndDate: null },
          { contractEndDate: { gte: firstParsed.monthStart } },
        ],
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
        joinDate: { gte: firstParsed.monthStart, lte: lastParsed.monthEnd },
      },
      select: {
        joinDate: true,
        stpCompany: { select: { companyId: true } },
      },
    }),
    prisma.kpiMonthlyTarget.findMany({
      where: {
        yearMonth: { in: fiscalMonths },
        kpiKey: KPI_KEYS.MONTHLY_REVENUE,
      },
    }),
  ]);

  const targetMap = new Map<string, number>(
    targets.map((t) => [t.yearMonth, t.targetValue])
  );
  const now = new Date();
  const currentYearMonth = toYearMonth(now);

  const months: RevenueTrendMonth[] = fiscalMonths.map((ym) => {
    const { monthStart, monthEnd, daysInMonth } = parseMonth(ym);
    const monthNum = parseInt(ym.split("-")[1], 10);
    const target = targetMap.get(ym) ?? null;

    const isPast = ym < currentYearMonth;
    const isCurrent = ym === currentYearMonth;
    const isFuture = ym > currentYearMonth;

    let actual: number | null = null;
    let forecast: number | null = null;

    if (isPast || isCurrent) {
      actual = calculateRevenue(
        contracts,
        candidates,
        monthStart,
        monthEnd,
        daysInMonth,
        false
      );
    }

    if (isCurrent || isFuture) {
      forecast = calculateRevenue(
        contracts,
        candidates,
        monthStart,
        monthEnd,
        daysInMonth,
        true
      );
    }

    return {
      yearMonth: ym,
      label: `${monthNum}月`,
      target,
      actual,
      forecast,
    };
  });

  return { months };
}

// ============================================
// 3. セールスファネル
// ============================================

export type FunnelStage = {
  id: number;
  name: string;
  stageType: string;
  companyCount: number;
};

export type FunnelData = {
  stages: FunnelStage[];
  conversions: { from: string; to: string; rate: number | null }[];
};

export async function getFunnelData(): Promise<FunnelData> {
  // パイプライン設定の表示順で、進行(progress)とゴール(closed_won)のステージ取得
  const stages = await prisma.stpStage.findMany({
    where: {
      isActive: true,
      stageType: { in: ["progress", "closed_won"] },
    },
    orderBy: { displayOrder: { sort: "asc", nulls: "last" } },
    select: {
      id: true,
      name: true,
      stageType: true,
      displayOrder: true,
      _count: {
        select: {
          currentStageCompanies: true,
        },
      },
    },
  });

  const funnelStages: FunnelStage[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    stageType: s.stageType,
    companyCount: s._count.currentStageCompanies,
  }));

  // displayOrder ベースで「そのステージを通過した企業数」を算出
  // 企業の現在の currentStageId の displayOrder が N 以上なら、
  // displayOrder 1〜N のステージすべてを通過したとみなす
  //
  // 加えて StpStageHistory の最大到達 displayOrder も考慮
  // (closed_lost 等に移動して currentStageId が変わった企業も含む)

  // stageId → displayOrder のマッピング（全ステージ、closed_lost等も含む）
  const allStages = await prisma.stpStage.findMany({
    select: { id: true, displayOrder: true },
  });
  const stageOrderMap = new Map<number, number>();
  for (const s of allStages) {
    if (s.displayOrder !== null) {
      stageOrderMap.set(s.id, s.displayOrder);
    }
  }

  // 全企業の現在ステージ取得
  const companies = await prisma.stpCompany.findMany({
    select: {
      id: true,
      currentStageId: true,
    },
  });

  // 各企業の最大到達 displayOrder を計算
  // 1) currentStageId の displayOrder
  const companyMaxOrder = new Map<number, number>();
  for (const c of companies) {
    if (c.currentStageId !== null) {
      const order = stageOrderMap.get(c.currentStageId);
      if (order !== undefined) {
        companyMaxOrder.set(c.id, order);
      }
    }
  }

  // 2) StpStageHistory の toStageId から最大 displayOrder を更新
  //    (例: 契約締結まで進んだ後 closed_lost に移動した企業も契約締結を通過とみなす)
  const histories = await prisma.stpStageHistory.findMany({
    where: { isVoided: false, toStageId: { not: null } },
    select: { stpCompanyId: true, toStageId: true },
  });
  for (const h of histories) {
    if (h.toStageId === null) continue;
    const order = stageOrderMap.get(h.toStageId);
    if (order === undefined) continue;
    const current = companyMaxOrder.get(h.stpCompanyId) ?? 0;
    if (order > current) {
      companyMaxOrder.set(h.stpCompanyId, order);
    }
  }

  // 各ファネルステージの「通過企業数」を集計
  // displayOrder が N のステージ → maxOrder >= N の企業数
  const stageDisplayOrders = stages.map((s) => s.displayOrder ?? 0);
  const maxOrders = Array.from(companyMaxOrder.values());
  const passedCounts = stageDisplayOrders.map((targetOrder) => {
    let count = 0;
    for (const maxOrder of maxOrders) {
      if (maxOrder >= targetOrder) count++;
    }
    return count;
  });

  // 転換率: 次ステージ通過企業数 / 現ステージ通過企業数
  const conversions: FunnelData["conversions"] = [];
  for (let i = 0; i < funnelStages.length - 1; i++) {
    const fromPassed = passedCounts[i];
    const toPassed = passedCounts[i + 1];
    const rate =
      fromPassed > 0
        ? Math.round((toPassed / fromPassed) * 1000) / 10
        : null;
    conversions.push({
      from: funnelStages[i].name,
      to: funnelStages[i + 1].name,
      rate,
    });
  }

  return { stages: funnelStages, conversions };
}

// ============================================
// 4. リード獲得 予実管理
// ============================================

export type LeadSourceBreakdown = {
  sourceName: string;
  count: number;
};

export type AgentLeadBreakdown = {
  agentId: number;
  agentName: string;
  partnerName: string | null;
  count: number;
};

export type LeadAcquisitionData = {
  target: number;
  actual: number;
  achievementRate: number;
  sourceBreakdown: LeadSourceBreakdown[];
  agentBreakdown: AgentLeadBreakdown[];
};

export async function getLeadAcquisitionData(
  yearMonth: string
): Promise<LeadAcquisitionData> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  // KPI目標のリード数を取得
  const leadTarget = await prisma.kpiMonthlyTarget.findUnique({
    where: {
      yearMonth_kpiKey: { yearMonth, kpiKey: KPI_KEYS.MONTHLY_LEADS },
    },
  });
  const target = leadTarget?.targetValue ?? 0;

  // 対象月にリード獲得した企業を取得
  const companies = await prisma.stpCompany.findMany({
    where: {
      leadAcquiredDate: { gte: monthStart, lte: monthEnd },
    },
    select: {
      id: true,
      agentId: true,
      leadSource: {
        select: { id: true, name: true },
      },
      agent: {
        select: {
          id: true,
          company: { select: { name: true } },
          category1: true,
        },
      },
    },
  });

  const actual = companies.length;
  const achievementRate =
    target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;

  // 流入経路別集計
  const sourceMap = new Map<string, number>();
  for (const c of companies) {
    const sourceName = c.leadSource?.name ?? "不明";
    sourceMap.set(sourceName, (sourceMap.get(sourceName) ?? 0) + 1);
  }
  const sourceBreakdown: LeadSourceBreakdown[] = Array.from(
    sourceMap.entries()
  )
    .map(([sourceName, count]) => ({ sourceName, count }))
    .sort((a, b) => b.count - a.count);

  // 代理店別集計
  const agentMap = new Map<
    number,
    { agentName: string; partnerName: string | null; count: number }
  >();
  for (const c of companies) {
    if (c.agent) {
      const existing = agentMap.get(c.agent.id);
      if (existing) {
        existing.count++;
      } else {
        const partnerLabel =
          c.agent.category1 === "advisor" ? "アドバイザー" : "パートナー";
        agentMap.set(c.agent.id, {
          agentName: c.agent.company.name,
          partnerName: partnerLabel,
          count: 1,
        });
      }
    }
  }
  const agentBreakdown: AgentLeadBreakdown[] = Array.from(
    agentMap.entries()
  )
    .map(([agentId, data]) => ({ agentId, ...data }))
    .sort((a, b) => b.count - a.count);

  return {
    target,
    actual,
    achievementRate,
    sourceBreakdown,
    agentBreakdown,
  };
}

// ============================================
// 5. 利用可能な月のリスト
// ============================================

export async function getAvailableMonths(): Promise<string[]> {
  // 契約履歴から月のリストを生成
  const contracts = await prisma.stpContractHistory.findMany({
    where: { deletedAt: null },
    select: { contractStartDate: true, contractEndDate: true },
    orderBy: { contractStartDate: "asc" },
  });

  if (contracts.length === 0) {
    // データがなければ今月だけ返す
    return [toYearMonth(new Date())];
  }

  const months = new Set<string>();
  const now = new Date();
  const currentYearMonth = toYearMonth(now);

  // 最も古い契約開始月 〜 今月 まで
  let earliest = contracts[0].contractStartDate;
  for (const c of contracts) {
    if (c.contractStartDate < earliest) earliest = c.contractStartDate;
  }

  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  while (toYearMonth(cursor) <= currentYearMonth) {
    months.add(toYearMonth(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return Array.from(months).sort().reverse(); // 新しい月が先頭
}

// ============================================
// 6. 代理店ROI
// ============================================

export type AgentRoiItem = {
  agentId: number;
  agentName: string;
  cost: number;
  revenue: number;
  roi: number | null;
};

export type AgentRoiData = {
  agents: AgentRoiItem[];
};

export async function getAgentRoiData(
  yearMonth: string
): Promise<AgentRoiData> {
  const { monthStart } = parseMonth(yearMonth);
  const past = isPastMonth(yearMonth);

  // 代理店付きのSTP企業を取得
  const stpCompanies = await prisma.stpCompany.findMany({
    where: { agentId: { not: null } },
    select: { companyId: true, agentId: true },
  });

  // agentId → masterCompanyId[] のマッピング
  const agentCompanyMap = new Map<number, Set<number>>();
  for (const c of stpCompanies) {
    if (c.agentId === null) continue;
    if (!agentCompanyMap.has(c.agentId)) {
      agentCompanyMap.set(c.agentId, new Set());
    }
    agentCompanyMap.get(c.agentId)!.add(c.companyId);
  }

  // 代理店マスタ（名前取得）
  const agents = await prisma.stpAgent.findMany({
    where: { id: { in: Array.from(agentCompanyMap.keys()) } },
    select: { id: true, company: { select: { name: true } } },
  });
  const agentNameMap = new Map(agents.map((a) => [a.id, a.company.name]));

  // 当月の全取引を取得
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const transactions = await prisma.transaction.findMany({
    where: {
      periodFrom: { gte: monthStart, lt: nextMonth },
      deletedAt: null,
    },
    select: {
      type: true,
      amount: true,
      taxAmount: true,
      taxType: true,
      stpAgentId: true,
      stpContractHistoryId: true,
      invoiceGroupId: true,
      paymentGroupId: true,
      invoiceGroup: { select: { status: true } },
      paymentGroup: { select: { status: true } },
      stpContractHistory: { select: { companyId: true } },
    },
  });

  // 各代理店のコスト・売上を集計
  const result: AgentRoiItem[] = [];

  for (const [agentId, companyIds] of agentCompanyMap) {
    // 獲得コスト: この代理店に紐づく経費取引
    let cost = 0;
    for (const tx of transactions) {
      if (tx.type !== "expense" || tx.stpAgentId !== agentId) continue;
      if (past && tx.paymentGroupId !== null) {
        if (!tx.paymentGroup || !CONFIRMED_PAYMENT_STATUSES.includes(tx.paymentGroup.status)) continue;
      }
      cost += calcTotalWithTax(tx);
    }

    // 契約売上: この代理店経由の企業に紐づく売上取引
    let revenue = 0;
    for (const tx of transactions) {
      if (tx.type !== "revenue") continue;
      const txCompanyId = tx.stpContractHistory?.companyId;
      if (txCompanyId === undefined || txCompanyId === null) continue;
      if (!companyIds.has(txCompanyId)) continue;
      if (past && tx.invoiceGroupId !== null) {
        if (!tx.invoiceGroup || !CONFIRMED_INVOICE_STATUSES.includes(tx.invoiceGroup.status)) continue;
      }
      revenue += calcTotalWithTax(tx);
    }

    if (cost === 0 && revenue === 0) continue;

    result.push({
      agentId,
      agentName: agentNameMap.get(agentId) ?? "不明",
      cost,
      revenue,
      roi: cost > 0 ? Math.round((revenue / cost) * 10) / 10 : null,
    });
  }

  result.sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost));

  return { agents: result };
}

// ============================================
// 7. リードソース別予実
// ============================================

export type LeadSourceForecastItem = {
  sourceId: number;
  sourceName: string;
  target: number;
  actual: number;
  achievementRate: number;
};

export type LeadSourceForecastData = {
  sources: LeadSourceForecastItem[];
};

export async function getLeadSourceForecastData(
  yearMonth: string
): Promise<LeadSourceForecastData> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  // 流入経路マスタ
  const leadSources = await prisma.stpLeadSource.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { displayOrder: "asc" },
  });

  // 流入経路別の目標（KpiMonthlyTargetからlead_source_target_{id}形式で取得）
  const targetKeys = leadSources.map((s) => `lead_source_target_${s.id}`);
  const targets = await prisma.kpiMonthlyTarget.findMany({
    where: { yearMonth, kpiKey: { in: targetKeys } },
  });
  const targetMap = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  // 当月に基本契約を締結した企業（流入経路別）
  const contractedCompanies = await prisma.masterContract.findMany({
    where: {
      projectId: 1,
      contractType: "基本契約",
      signedDate: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  const contractedCompanyIds = new Set(
    contractedCompanies.map((c) => c.companyId).filter((id): id is number => id !== null)
  );

  // 契約企業のSTP企業情報（流入経路取得）
  const stpCompanies = await prisma.stpCompany.findMany({
    where: { companyId: { in: Array.from(contractedCompanyIds) } },
    select: { companyId: true, leadSourceId: true },
  });

  // 流入経路別に契約企業数を集計
  const sourceCountMap = new Map<number, number>();
  for (const c of stpCompanies) {
    if (c.leadSourceId === null) continue;
    sourceCountMap.set(c.leadSourceId, (sourceCountMap.get(c.leadSourceId) ?? 0) + 1);
  }

  const sources: LeadSourceForecastItem[] = leadSources.map((s) => {
    const target = targetMap.get(`lead_source_target_${s.id}`) ?? 0;
    const actual = sourceCountMap.get(s.id) ?? 0;
    return {
      sourceId: s.id,
      sourceName: s.name,
      target,
      actual,
      achievementRate: target > 0 ? Math.round((actual / target) * 1000) / 10 : 0,
    };
  });

  return { sources };
}

// ============================================
// 8. 売上推移（粗利エリア付き）
// ============================================

export type RevenueTrendWithProfitMonth = {
  yearMonth: string;
  label: string;
  target: number | null;
  actual: number | null;
  forecast: number | null;
  grossProfit: number | null;
};

export type RevenueTrendWithProfitData = {
  months: RevenueTrendWithProfitMonth[];
};

export async function getRevenueTrendWithProfitData(
  yearMonth: string
): Promise<RevenueTrendWithProfitData> {
  // 決算期首月を取得
  const fiscalStartRecord = await prisma.kpiMonthlyTarget.findUnique({
    where: {
      yearMonth_kpiKey: { yearMonth: "0000-00", kpiKey: "fiscal_year_start" },
    },
  });
  const fiscalStartMonth = fiscalStartRecord?.targetValue ?? 4;

  const [selYear, selMonth] = yearMonth.split("-").map(Number);
  const fiscalYearStartYear = selMonth >= fiscalStartMonth ? selYear : selYear - 1;

  const fiscalMonths: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(fiscalYearStartYear, fiscalStartMonth - 1 + i, 1);
    fiscalMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const firstParsed = parseMonth(fiscalMonths[0]);
  const lastParsed = parseMonth(fiscalMonths[fiscalMonths.length - 1]);

  // 一括データ取得
  const [contracts, candidates, allTargets, allTransactions] = await Promise.all([
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        contractStartDate: { lte: lastParsed.monthEnd },
        OR: [{ contractEndDate: null }, { contractEndDate: { gte: firstParsed.monthStart } }],
      },
      select: {
        companyId: true, contractStartDate: true, contractEndDate: true,
        initialFee: true, monthlyFee: true, performanceFee: true, status: true,
      },
    }),
    prisma.stpCandidate.findMany({
      where: {
        deletedAt: null,
        joinDate: { gte: firstParsed.monthStart, lte: lastParsed.monthEnd },
      },
      select: { joinDate: true, stpCompany: { select: { companyId: true } } },
    }),
    prisma.kpiMonthlyTarget.findMany({
      where: {
        yearMonth: { in: fiscalMonths },
        kpiKey: { in: [KPI_KEYS.MONTHLY_REVENUE, KPI_KEYS.FIXED_COST] },
      },
    }),
    prisma.transaction.findMany({
      where: {
        periodFrom: { gte: firstParsed.monthStart, lte: lastParsed.monthEnd },
        deletedAt: null,
      },
      select: {
        type: true, amount: true, taxAmount: true, taxType: true, periodFrom: true,
        invoiceGroupId: true, paymentGroupId: true,
        invoiceGroup: { select: { status: true } },
        paymentGroup: { select: { status: true } },
      },
    }),
  ]);

  // 目標マップ（yearMonth_kpiKey → value）
  const targetMap = new Map(allTargets.map((t) => [`${t.yearMonth}_${t.kpiKey}`, t.targetValue]));

  const now = new Date();
  const currentYearMonth = toYearMonth(now);

  const months: RevenueTrendWithProfitMonth[] = fiscalMonths.map((ym) => {
    const { monthStart, monthEnd, daysInMonth } = parseMonth(ym);
    const monthNum = parseInt(ym.split("-")[1], 10);
    const revenueTarget = targetMap.get(`${ym}_${KPI_KEYS.MONTHLY_REVENUE}`) ?? null;
    const fixedCost = targetMap.get(`${ym}_${KPI_KEYS.FIXED_COST}`) ?? DEFAULT_FIXED_COST;

    const ymIsPast = ym < currentYearMonth;
    const isCurrent = ym === currentYearMonth;
    const isFuture = ym > currentYearMonth;

    let actual: number | null = null;
    let forecast: number | null = null;

    if (ymIsPast || isCurrent) {
      actual = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, false);
    }
    if (isCurrent || isFuture) {
      forecast = calculateRevenue(contracts, candidates, monthStart, monthEnd, daysInMonth, true);
    }

    // 粗利計算（Transactionベース）
    let grossProfit: number | null = null;
    if (ymIsPast || isCurrent) {
      const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      const monthTxns = allTransactions.filter(
        (tx) => tx.periodFrom >= monthStart && tx.periodFrom < nextMonth
      );

      let rev = 0;
      let exp = 0;
      for (const tx of monthTxns) {
        if (tx.type === "revenue") {
          if (ymIsPast && tx.invoiceGroupId !== null) {
            if (!tx.invoiceGroup || !CONFIRMED_INVOICE_STATUSES.includes(tx.invoiceGroup.status)) continue;
          }
          rev += calcTotalWithTax(tx);
        } else if (tx.type === "expense") {
          if (ymIsPast && tx.paymentGroupId !== null) {
            if (!tx.paymentGroup || !CONFIRMED_PAYMENT_STATUSES.includes(tx.paymentGroup.status)) continue;
          }
          exp += calcTotalWithTax(tx);
        }
      }
      grossProfit = rev - exp - fixedCost;
    }

    return {
      yearMonth: ym,
      label: `${monthNum}月`,
      target: revenueTarget,
      actual,
      forecast,
      grossProfit,
    };
  });

  return { months };
}
