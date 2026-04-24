"use server";

import { prisma } from "@/lib/prisma";
import {
  DEPT_KPI_KEYS,
  DEPT_KPI_GROUPS,
  KPI_LABELS,
  DEPT_KPI_UNITS,
  DEPT_KPI_INVERTED,
  DEPT_KPI_DEFAULT_TARGETS,
  OBSERVATION_LABELS,
  type DeptKpiKey,
} from "@/lib/kpi/constants";

// ============================================
// 型定義
// ============================================

export type DeptKpiValue = {
  actual: number | null;
  target: number;
  achievementRate: number;
  unit: string;
};

export type DeptKpiItem = {
  key: string;
  label: string;
  value: DeptKpiValue;
  preparingMessage?: string;
};

export type ObservationItem = {
  key: string;
  label: string;
  value: string;
  unit: string;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  sub?: string;
};

export type DeptTabData = {
  tabKey: string;
  departmentName: string;
  managerName: string;
  kpis: DeptKpiItem[];
  observations: ObservationItem[];
  isPreparing?: boolean;
};

// ============================================
// ヘルパー
// ============================================

function parseMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  return { monthStart, monthEnd, year: y, month: m };
}

function prevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ============================================
// 部門KPIデータ取得
// ============================================

export async function getDeptKpiData(
  yearMonth: string
): Promise<DeptTabData[]> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);
  const prevMonth = prevYearMonth(yearMonth);

  // KPI目標値を一括取得
  const allDeptKpiKeys = Object.values(DEPT_KPI_KEYS);
  const targets = await prisma.kpiMonthlyTarget.findMany({
    where: {
      yearMonth,
      kpiKey: { in: allDeptKpiKeys },
    },
  });
  const targetMap = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  // STP企業マッピング
  const stpCompanies = await prisma.stpCompany.findMany({
    select: {
      id: true,
      companyId: true,
      leadAcquiredDate: true,
      leadValidity: true,
      currentStageId: true,
      agentId: true,
      leadSourceId: true,
    },
  });
  const stpToMasterMap = new Map(
    stpCompanies.map((c) => [c.id, c.companyId])
  );
  const allMasterCompanyIds = stpCompanies.map((c) => c.companyId);

  // リードステージ（displayOrder=1、最初のステージ）
  const leadStage = await prisma.stpStage.findFirst({
    where: { isActive: true },
    orderBy: { displayOrder: { sort: "asc", nulls: "last" } },
    select: { id: true },
  });
  const leadStageId = leadStage?.id ?? 1;

  // 運用中ステージ
  const operationStage = await prisma.stpStage.findFirst({
    where: { stageType: "closed_won", isActive: true },
    select: { id: true },
  });

  // 接触種別の取得
  const [meetingCategory, koCategory] = await Promise.all([
    prisma.contactCategory.findFirst({
      where: { name: "商談", projectId: 1 },
      select: { id: true },
    }),
    prisma.contactCategory.findFirst({
      where: { name: "キックオフ", projectId: 1 },
      select: { id: true },
    }),
  ]);

  // リードソースで「代理店」系のIDを取得
  const agentLeadSources = await prisma.stpLeadSource.findMany({
    where: { name: { contains: "代理店" }, isActive: true },
    select: { id: true },
  });
  const agentLeadSourceIds = new Set(agentLeadSources.map((s) => s.id));

  // ============================================
  // Alliance部の計算
  // ============================================

  // 当月リード獲得 & 有効な企業
  const validLeads = stpCompanies.filter(
    (c) =>
      c.leadAcquiredDate &&
      c.leadAcquiredDate >= monthStart &&
      c.leadAcquiredDate <= monthEnd &&
      c.leadValidity === "有効"
  );
  const validLeadCount = validLeads.length;

  // SQL化率: 有効リードのうち、currentStageがリード以外に進んだ企業
  const sqlizedLeads = validLeads.filter(
    (c) => c.currentStageId !== null && c.currentStageId !== leadStageId
  );
  const sqlizedCount = sqlizedLeads.length;
  const sqlRate =
    validLeadCount > 0
      ? Math.round((sqlizedCount / validLeadCount) * 1000) / 10
      : null;

  // 商談数: 接触履歴(V2)で接触種別「商談」の当月ユニーク企業数
  let meetingCount = 0;
  if (meetingCategory) {
    const meetingParticipants = await prisma.contactCustomerParticipant.findMany({
      where: {
        targetType: "stp_company",
        targetId: { in: allMasterCompanyIds },
        contactHistory: {
          deletedAt: null,
          projectId: 1,
          status: "completed",
          contactCategoryId: meetingCategory.id,
          scheduledStartAt: { gte: monthStart, lte: monthEnd },
        },
      },
      select: { targetId: true },
    });
    const uniqueIds = new Set(
      meetingParticipants.map((p) => p.targetId).filter((id): id is number => id !== null)
    );
    meetingCount = uniqueIds.size;
  }

  // 代理店経由のSQL化率
  const agentLeads = validLeads.filter(
    (c) => c.agentId !== null || (c.leadSourceId !== null && agentLeadSourceIds.has(c.leadSourceId))
  );
  const agentLeadCount = agentLeads.length;
  const agentSqlizedCount = agentLeads.filter(
    (c) => c.currentStageId !== null && c.currentStageId !== leadStageId
  ).length;
  const partnerSqlRate =
    agentLeadCount > 0
      ? Math.round((agentSqlizedCount / agentLeadCount) * 1000) / 10
      : null;

  // 代理店社数
  const activeAgentCount = await prisma.stpAgent.count({
    where: { status: "アクティブ" },
  });

  // 前月のスナップショット
  const prevMonthSnapshot = await prisma.monthlySnapshot.findUnique({
    where: {
      yearMonth_snapshotKey: {
        yearMonth: prevMonth,
        snapshotKey: "active_agent_count",
      },
    },
  });
  const prevAgentCount = prevMonthSnapshot?.value ?? null;
  const agentDelta =
    prevAgentCount !== null ? activeAgentCount - prevAgentCount : null;

  // チャネル別CAC: 代理店への当月支払予定額 ÷ 代理店経由の基本契約書締結企業数
  const [agentExpenses, agentContracts] = await Promise.all([
    prisma.stpExpenseRecord.findMany({
      where: {
        deletedAt: null,
        targetMonth: monthStart,
        status: { not: "cancelled" },
      },
      select: { expectedAmount: true },
    }),
    prisma.masterContract.findMany({
      where: {
        projectId: 1,
        contractType: "基本契約",
        signedDate: { gte: monthStart, lte: monthEnd },
      },
      select: { companyId: true },
      distinct: ["companyId"],
    }),
  ]);

  const totalAgentExpense = agentExpenses.reduce(
    (sum, e) => sum + e.expectedAmount,
    0
  );
  // 代理店付きの企業のみフィルタ（companyId→stpCompany→agentIdがnot null）
  const stpCompanyWithAgent = new Set(
    stpCompanies.filter((c) => c.agentId !== null).map((c) => c.companyId)
  );
  const agentContractCount = agentContracts.filter(
    (c) => c.companyId !== null && stpCompanyWithAgent.has(c.companyId)
  ).length;
  const channelCac =
    agentContractCount > 0
      ? Math.round(totalAgentExpense / agentContractCount)
      : null;

  // ============================================
  // Sales部の計算
  // ============================================

  // 成約率: 基本契約書締結企業数 ÷ 商談接触企業数（当月）(V2)
  let salesMeetingCompanyCount = 0;
  if (meetingCategory) {
    const meetingParticipants = await prisma.contactCustomerParticipant.findMany({
      where: {
        targetType: "stp_company",
        targetId: { in: allMasterCompanyIds },
        contactHistory: {
          deletedAt: null,
          projectId: 1,
          status: "completed",
          contactCategoryId: meetingCategory.id,
          scheduledStartAt: { gte: monthStart, lte: monthEnd },
        },
      },
      select: { targetId: true },
    });
    const uniqueIds = new Set(
      meetingParticipants.map((p) => p.targetId).filter((id): id is number => id !== null)
    );
    salesMeetingCompanyCount = uniqueIds.size;
  }

  // 基本契約書の締結企業（当月）
  const allBasicContracts = await prisma.masterContract.findMany({
    where: {
      projectId: 1,
      contractType: "基本契約",
      signedDate: { not: null },
    },
    select: { companyId: true, signedDate: true },
  });

  // 当月の締結企業（重複除外）
  const contractedCompaniesThisMonth = new Set(
    allBasicContracts
      .filter(
        (c) =>
          c.signedDate! >= monthStart && c.signedDate! <= monthEnd
      )
      .map((c) => c.companyId)
      .filter((id): id is number => id !== null)
  );
  const salesContractCount = contractedCompaniesThisMonth.size;

  const closeRate =
    salesMeetingCompanyCount > 0
      ? Math.round(
          (salesContractCount / salesMeetingCompanyCount) * 1000
        ) / 10
      : null;

  // 新規契約数（初回のみ）
  const firstContractByCompany = new Map<number, Date>();
  for (const c of allBasicContracts) {
    if (!c.signedDate || c.companyId == null) continue;
    const existing = firstContractByCompany.get(c.companyId);
    if (!existing || c.signedDate < existing) {
      firstContractByCompany.set(c.companyId, c.signedDate);
    }
  }
  let salesNewContracts = 0;
  for (const [, firstDate] of firstContractByCompany) {
    if (firstDate >= monthStart && firstDate <= monthEnd) {
      salesNewContracts++;
    }
  }

  // 商談→契約LT
  let meetingToContractLt: number | null = null;
  if (meetingCategory && contractedCompaniesThisMonth.size > 0) {
    const masterCompanyIds = Array.from(contractedCompaniesThisMonth);

    // V2: customerParticipants 経由で企業ごとの最初の商談日を集計
    const meetingParticipants = await prisma.contactCustomerParticipant.findMany({
      where: {
        targetType: "stp_company",
        targetId: { in: masterCompanyIds },
        contactHistory: {
          deletedAt: null,
          projectId: 1,
          status: "completed",
          contactCategoryId: meetingCategory.id,
        },
      },
      select: {
        targetId: true,
        contactHistory: { select: { scheduledStartAt: true } },
      },
    });

    const firstMeetingMap = new Map<number, Date>();
    for (const p of meetingParticipants) {
      if (p.targetId == null) continue;
      const d = p.contactHistory.scheduledStartAt;
      const existing = firstMeetingMap.get(p.targetId);
      if (!existing || d < existing) firstMeetingMap.set(p.targetId, d);
    }

    let totalDays = 0;
    let validCount = 0;
    for (const masterCompanyId of contractedCompaniesThisMonth) {
      const firstMeetingDate = firstMeetingMap.get(masterCompanyId);
      // signedDateは当月のもの
      const contracts = allBasicContracts.filter(
        (c) =>
          c.companyId === masterCompanyId &&
          c.signedDate! >= monthStart &&
          c.signedDate! <= monthEnd
      );
      const signedDate = contracts[0]?.signedDate;
      if (firstMeetingDate && signedDate) {
        const days = Math.floor(
          (signedDate.getTime() - new Date(firstMeetingDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (days >= 0) {
          totalDays += days;
          validCount++;
        }
      }
    }
    meetingToContractLt =
      validCount > 0 ? Math.round(totalDays / validCount) : null;
  }

  // ============================================
  // バックオフィス部の計算
  // ============================================

  // 運用開始LT
  let operationStartLt: number | null = null;
  if (operationStage && koCategory) {
    const opTransitions = await prisma.stpStageHistory.findMany({
      where: {
        toStageId: operationStage.id,
        isVoided: false,
        recordedAt: { gte: monthStart, lte: monthEnd },
      },
      select: { stpCompanyId: true, recordedAt: true },
    });

    if (opTransitions.length > 0) {
      const stpCompanyIds = [
        ...new Set(opTransitions.map((t) => t.stpCompanyId)),
      ];
      const masterCompanyIdsForKo = stpCompanyIds
        .map((stpId) => stpToMasterMap.get(stpId))
        .filter((id): id is number => id !== undefined);

      // V2: customerParticipants 経由で企業ごとの最初のキックオフ日を集計
      const koParticipants = await prisma.contactCustomerParticipant.findMany({
        where: {
          targetType: "stp_company",
          targetId: { in: masterCompanyIdsForKo },
          contactHistory: {
            deletedAt: null,
            projectId: 1,
            status: "completed",
            contactCategoryId: koCategory.id,
          },
        },
        select: {
          targetId: true,
          contactHistory: { select: { scheduledStartAt: true } },
        },
      });

      const koMap = new Map<number, Date>();
      for (const p of koParticipants) {
        if (p.targetId == null) continue;
        const d = p.contactHistory.scheduledStartAt;
        const existing = koMap.get(p.targetId);
        if (!existing || d < existing) koMap.set(p.targetId, d);
      }

      let totalDays = 0;
      let validCount = 0;
      for (const t of opTransitions) {
        const masterCompanyId = stpToMasterMap.get(t.stpCompanyId);
        if (!masterCompanyId) continue;
        const firstKoDate = koMap.get(masterCompanyId);
        if (firstKoDate) {
          const days = Math.floor(
            (t.recordedAt.getTime() -
              new Date(firstKoDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          if (days >= 0) {
            totalDays += days;
            validCount++;
          }
        }
      }
      operationStartLt =
        validCount > 0 ? Math.round(totalDays / validCount) : null;
    }
  }

  // 回収遅延率: InvoiceGroupのpaymentDueDate超過 & actualPaymentDate未入力
  const invoiceGroupsForMonth = await prisma.invoiceGroup.findMany({
    where: {
      paymentDueDate: { gte: monthStart, lte: monthEnd },
      status: {
        in: [
          "sent",
          "awaiting_accounting",
          "partially_paid",
          "paid",
        ],
      },
    },
    select: {
      paymentDueDate: true,
      actualPaymentDate: true,
    },
  });

  const totalInvoicesForMonth = invoiceGroupsForMonth.length;
  const now = new Date();
  const overdueCount = invoiceGroupsForMonth.filter(
    (ig) =>
      ig.paymentDueDate &&
      ig.paymentDueDate < now &&
      ig.actualPaymentDate === null
  ).length;
  const collectionDelayRate =
    totalInvoicesForMonth > 0
      ? Math.round((overdueCount / totalInvoicesForMonth) * 1000) / 10
      : null;

  // ============================================
  // ヘルパー: KPIアイテム生成
  // ============================================

  function makeKpiItem(
    key: DeptKpiKey,
    actual: number | null,
    preparingMessage?: string
  ): DeptKpiItem {
    const target =
      targetMap.get(key) ?? DEPT_KPI_DEFAULT_TARGETS[key] ?? 0;
    const unit = DEPT_KPI_UNITS[key];
    const inverted = DEPT_KPI_INVERTED[key] ?? false;
    let achievementRate = 0;

    if (actual !== null && target > 0) {
      if (inverted) {
        // 低い方が良い指標（LT、遅延率）
        achievementRate =
          actual <= target
            ? 100
            : Math.round((target / actual) * 1000) / 10;
      } else {
        achievementRate =
          Math.round((actual / target) * 1000) / 10;
      }
    }

    return {
      key,
      label: KPI_LABELS[key],
      value: { actual, target, achievementRate, unit },
      preparingMessage,
    };
  }

  // ============================================
  // タブデータ構築
  // ============================================

  const allianceTab: DeptTabData = {
    tabKey: DEPT_KPI_GROUPS.alliance.tabKey,
    departmentName: DEPT_KPI_GROUPS.alliance.departmentName,
    managerName: DEPT_KPI_GROUPS.alliance.managerName,
    kpis: [
      makeKpiItem(DEPT_KPI_KEYS.ALLIANCE_VALID_LEADS, validLeadCount),
      makeKpiItem(DEPT_KPI_KEYS.ALLIANCE_SQL_RATE, sqlRate),
      makeKpiItem(DEPT_KPI_KEYS.ALLIANCE_MEETINGS, meetingCount),
    ],
    observations: [
      {
        key: "alliance_agent_count",
        label: OBSERVATION_LABELS.alliance_agent_count.name,
        value: `${activeAgentCount}`,
        unit: OBSERVATION_LABELS.alliance_agent_count.unit,
        delta:
          agentDelta !== null
            ? `${agentDelta >= 0 ? "+" : ""}${agentDelta}`
            : undefined,
        deltaDir:
          agentDelta !== null
            ? agentDelta > 0
              ? "up"
              : agentDelta < 0
                ? "down"
                : "flat"
            : undefined,
        sub: "前月比",
      },
      {
        key: "alliance_channel_cac",
        label: OBSERVATION_LABELS.alliance_channel_cac.name,
        value:
          channelCac !== null
            ? `¥${new Intl.NumberFormat("ja-JP").format(channelCac)}`
            : "—",
        unit: "",
        sub: "代理店経由 平均",
      },
      {
        key: "alliance_partner_sql_rate",
        label: OBSERVATION_LABELS.alliance_partner_sql_rate.name,
        value: partnerSqlRate !== null ? `${partnerSqlRate}%` : "—",
        unit: "",
        sub: "代理店経由のみ",
      },
    ],
  };

  const salesTab: DeptTabData = {
    tabKey: DEPT_KPI_GROUPS.sales.tabKey,
    departmentName: DEPT_KPI_GROUPS.sales.departmentName,
    managerName: DEPT_KPI_GROUPS.sales.managerName,
    kpis: [
      makeKpiItem(DEPT_KPI_KEYS.SALES_CLOSE_RATE, closeRate),
      makeKpiItem(DEPT_KPI_KEYS.SALES_NEW_CONTRACTS, salesNewContracts),
      makeKpiItem(
        DEPT_KPI_KEYS.SALES_MEETING_TO_CONTRACT_LT,
        meetingToContractLt
      ),
    ],
    observations: [],
  };

  const backofficeTab: DeptTabData = {
    tabKey: DEPT_KPI_GROUPS.backoffice.tabKey,
    departmentName: DEPT_KPI_GROUPS.backoffice.departmentName,
    managerName: DEPT_KPI_GROUPS.backoffice.managerName,
    kpis: [
      makeKpiItem(DEPT_KPI_KEYS.BO_OPERATION_START_LT, operationStartLt),
      makeKpiItem(
        DEPT_KPI_KEYS.BO_COLLECTION_DELAY_RATE,
        collectionDelayRate
      ),
      makeKpiItem(
        DEPT_KPI_KEYS.BO_MEETING_TO_CONTRACT_LT,
        meetingToContractLt
      ),
    ],
    observations: [],
  };

  const csTab: DeptTabData = {
    tabKey: DEPT_KPI_GROUPS.cs.tabKey,
    departmentName: DEPT_KPI_GROUPS.cs.departmentName,
    managerName: DEPT_KPI_GROUPS.cs.managerName,
    kpis: [],
    observations: [],
    isPreparing: true,
  };

  return [allianceTab, salesTab, backofficeTab, csTab];
}
