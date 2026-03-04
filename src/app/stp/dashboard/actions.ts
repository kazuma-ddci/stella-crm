"use server";

import { prisma } from "@/lib/prisma";
import { KPI_KEYS, DEFAULT_FIXED_COST } from "@/lib/kpi/constants";

// ============================================
// 型定義
// ============================================

export type KgiCardData = {
  revenue: {
    actual: number;
    target: number;
    forecast: number; // scheduled含む
    prevMonth: number;
    achievementRate: number;
  };
  grossProfit: {
    actual: number;
    target: number;
    fixedCost: number;
    prevMonth: number;
  };
  customerCount: {
    actual: number;
    prevMonth: number;
    forecast: number; // scheduled含む
  };
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

// ============================================
// 売上計算ロジック
// ============================================

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

// ============================================
// メインデータ取得
// ============================================

export async function getDashboardData(
  yearMonth: string
): Promise<KgiCardData> {
  const { monthStart, monthEnd, daysInMonth } = parseMonth(yearMonth);
  const prevMonth = prevYearMonth(yearMonth);
  const {
    monthStart: prevMonthStart,
    monthEnd: prevMonthEnd,
    daysInMonth: prevDaysInMonth,
  } = parseMonth(prevMonth);

  // 並列でデータ取得
  const [contracts, candidates, targets] = await Promise.all([
    // 全契約（scheduled含む）- 対象月と前月の両方をカバー
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        contractStartDate: { lte: monthEnd },
        OR: [
          { contractEndDate: null },
          { contractEndDate: { gte: prevMonthStart } },
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

    // 候補者（joinDateあり）
    prisma.stpCandidate.findMany({
      where: {
        deletedAt: null,
        joinDate: { gte: prevMonthStart, lte: monthEnd },
      },
      select: {
        joinDate: true,
        stpCompany: { select: { companyId: true } },
      },
    }),

    // KPI目標値
    prisma.kpiMonthlyTarget.findMany({
      where: { yearMonth },
    }),
  ]);

  // 目標値をMap化
  const targetMap = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));
  const revenueTarget = targetMap.get(KPI_KEYS.MONTHLY_REVENUE) ?? 0;
  const grossProfitTarget =
    targetMap.get(KPI_KEYS.MONTHLY_GROSS_PROFIT) ?? 0;
  const newContractsTarget = targetMap.get(KPI_KEYS.NEW_CONTRACTS) ?? 0;
  const fixedCost =
    targetMap.get(KPI_KEYS.FIXED_COST) ?? DEFAULT_FIXED_COST;

  // ========================================
  // 1. 月次売上
  // ========================================
  const revenueActual = calculateRevenue(
    contracts,
    candidates,
    monthStart,
    monthEnd,
    daysInMonth,
    false
  );
  const revenueForecast = calculateRevenue(
    contracts,
    candidates,
    monthStart,
    monthEnd,
    daysInMonth,
    true
  );
  const revenuePrevMonth = calculateRevenue(
    contracts,
    candidates,
    prevMonthStart,
    prevMonthEnd,
    prevDaysInMonth,
    false
  );

  // ========================================
  // 2. 月次粗利
  // ========================================
  const grossProfitActual = revenueActual - fixedCost;
  const grossProfitPrevMonth = revenuePrevMonth - fixedCost;

  // ========================================
  // 3. 累計顧客数
  // ========================================
  // scheduled以外の契約がある企業（月末まで）
  const activeContractCompanies = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "cancelled", "dormant"] },
      contractStartDate: { lte: monthEnd },
    },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  const customerCountActual = activeContractCompanies.length;

  // 前月
  const prevContractCompanies = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "cancelled", "dormant"] },
      contractStartDate: { lte: prevMonthEnd },
    },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  const customerCountPrevMonth = prevContractCompanies.length;

  // 見込み（scheduled含む）
  const forecastContractCompanies =
    await prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        contractStartDate: { lte: monthEnd },
      },
      select: { companyId: true },
      distinct: ["companyId"],
    });
  const customerCountForecast = forecastContractCompanies.length;

  // ========================================
  // 4. 新規契約
  // ========================================
  // 対象月に contractStartDate がある企業（scheduled以外）
  const newContractCompanies = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "cancelled", "dormant"] },
      contractStartDate: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  const newContractsActual = newContractCompanies.length;

  // 前月
  const prevNewContractCompanies = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "cancelled", "dormant"] },
      contractStartDate: { gte: prevMonthStart, lte: prevMonthEnd },
    },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  const newContractsPrevMonth = prevNewContractCompanies.length;

  return {
    revenue: {
      actual: revenueActual,
      target: revenueTarget,
      forecast: revenueForecast,
      prevMonth: revenuePrevMonth,
      achievementRate:
        revenueTarget > 0
          ? Math.round((revenueActual / revenueTarget) * 1000) / 10
          : 0,
    },
    grossProfit: {
      actual: grossProfitActual,
      target: grossProfitTarget,
      fixedCost: fixedCost,
      prevMonth: grossProfitPrevMonth,
    },
    customerCount: {
      actual: customerCountActual,
      prevMonth: customerCountPrevMonth,
      forecast: customerCountForecast,
    },
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
// 月次売上推移（計画 vs 実績）
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

  const targetMap = new Map(targets.map((t) => [t.yearMonth, t.targetValue]));
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
// セールスファネル
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
  const passedCounts = stageDisplayOrders.map((targetOrder) => {
    let count = 0;
    for (const maxOrder of companyMaxOrder.values()) {
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
// リード獲得 予実管理
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
// 利用可能な月のリスト
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
