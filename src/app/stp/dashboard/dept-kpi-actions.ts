"use server";

import { prisma } from "@/lib/prisma";
import {
  DEPT_KPI_KEYS,
  DEPT_KPI_GROUPS,
  KPI_LABELS,
  DEPT_KPI_UNITS,
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

export type DeptTabData = {
  tabKey: string;
  departmentName: string;
  managerName: string;
  kpis: DeptKpiItem[];
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

// ============================================
// 部門KPIデータ取得
// ============================================

export async function getDeptKpiData(yearMonth: string): Promise<DeptTabData[]> {
  const { monthStart, monthEnd } = parseMonth(yearMonth);

  // KPI目標値を一括取得
  const allDeptKpiKeys = Object.values(DEPT_KPI_KEYS);
  const targets = await prisma.kpiMonthlyTarget.findMany({
    where: {
      yearMonth,
      kpiKey: { in: allDeptKpiKeys },
    },
  });
  const targetMap = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  // STP企業の companyId(=MasterStellaCompanyのID) マッピングを取得
  // ContactHistoryは companyId(MasterStellaCompany) で紐付いているため
  const stpCompanies = await prisma.stpCompany.findMany({
    select: { id: true, companyId: true },
  });
  // stpCompanyId → masterCompanyId
  const stpToMasterMap = new Map(stpCompanies.map((c) => [c.id, c.companyId]));
  // masterCompanyId → stpCompanyId
  const masterToStpMap = new Map(stpCompanies.map((c) => [c.companyId, c.id]));
  const allMasterCompanyIds = stpCompanies.map((c) => c.companyId);

  // ============================================
  // Alliance部の計算
  // ============================================

  // 該当月にリード獲得した全企業
  const leadCompanies = await prisma.stpCompany.findMany({
    where: {
      leadAcquiredDate: { gte: monthStart, lte: monthEnd },
    },
    select: {
      id: true,
      leadValidity: true,
    },
  });

  // 有効リード数
  const validLeadCount = leadCompanies.filter(
    (c) => c.leadValidity === "有効"
  ).length;
  const totalLeadCount = leadCompanies.length;

  // 商談数: 接触種別「商談」かつcontactDateが該当月で、その企業における最初の商談
  const meetingCategory = await prisma.contactCategory.findFirst({
    where: { name: "商談", projectId: 1 },
    select: { id: true },
  });

  let meetingCount = 0;
  if (meetingCategory) {
    // STP企業に紐づくContactHistoryで「商談」カテゴリの最初のcontactDateをgroupByで取得
    const firstMeetings = await prisma.contactHistory.groupBy({
      by: ["companyId"],
      where: {
        companyId: { in: allMasterCompanyIds },
        contactCategoryId: meetingCategory.id,
        deletedAt: null,
      },
      _min: {
        contactDate: true,
      },
    });

    // その最初の商談日が該当月内の企業数をカウント
    meetingCount = firstMeetings.filter((fm) => {
      if (!fm._min.contactDate) return false;
      const d = new Date(fm._min.contactDate);
      return d >= monthStart && d <= monthEnd;
    }).length;
  }

  // SQL化率: 有効リード数 / 全リード数 × 100
  const sqlRate = totalLeadCount > 0
    ? Math.round((validLeadCount / totalLeadCount) * 1000) / 10
    : null;

  // ============================================
  // Sales部の計算
  // ============================================

  // 新規契約数: MasterContract（基本契約）で signedDate が該当月の企業で初回契約
  // MasterContractはcompanyId(=MasterStellaCompanyのID)で紐付いている
  const allContracts = await prisma.masterContract.findMany({
    where: {
      projectId: 1, // STP
      contractType: "基本契約",
      signedDate: { not: null },
    },
    select: {
      companyId: true,
      signedDate: true,
    },
  });

  // companyId(masterCompanyId)ごとの最初のsignedDateを計算
  const firstContractByMasterCompany = new Map<number, Date>();
  for (const c of allContracts) {
    if (!c.signedDate) continue;
    const existing = firstContractByMasterCompany.get(c.companyId);
    if (!existing || c.signedDate < existing) {
      firstContractByMasterCompany.set(c.companyId, c.signedDate);
    }
  }

  // 該当月に初めて契約したstpCompanyIdをカウント（masterCompanyId→stpCompanyIdに変換）
  const newContractStpCompanyIds = new Set<number>();
  for (const [masterCompanyId, firstDate] of firstContractByMasterCompany) {
    if (firstDate >= monthStart && firstDate <= monthEnd) {
      const stpCompanyId = masterToStpMap.get(masterCompanyId);
      if (stpCompanyId !== undefined) {
        newContractStpCompanyIds.add(stpCompanyId);
      }
    }
  }
  const salesNewContracts = newContractStpCompanyIds.size;

  // 成約率: 新規契約数 / Alliance商談数 × 100
  const closeRate = meetingCount > 0
    ? Math.round((salesNewContracts / meetingCount) * 1000) / 10
    : null;

  // 商談→契約LT: 該当月に初契約した企業の「signedDate - 初回商談contactDate」の平均日数
  let meetingToContractLt: number | null = null;
  if (meetingCategory && newContractStpCompanyIds.size > 0) {
    // 初契約した企業のmasterCompanyIdを取得
    const masterCompanyIdsForContracts = Array.from(newContractStpCompanyIds)
      .map((stpId) => stpToMasterMap.get(stpId))
      .filter((id): id is number => id !== undefined);

    // 各企業の最初の商談日を取得（ContactHistoryはmasterCompanyIdで検索）
    const firstMeetingsForContracts = await prisma.contactHistory.groupBy({
      by: ["companyId"],
      where: {
        companyId: { in: masterCompanyIdsForContracts },
        contactCategoryId: meetingCategory.id,
        deletedAt: null,
      },
      _min: {
        contactDate: true,
      },
    });

    // masterCompanyId → 初回商談日
    const firstMeetingByMasterMap = new Map(
      firstMeetingsForContracts.map((fm) => [fm.companyId, fm._min.contactDate])
    );

    let totalDays = 0;
    let validCount = 0;
    for (const stpCompanyId of newContractStpCompanyIds) {
      const masterCompanyId = stpToMasterMap.get(stpCompanyId);
      if (!masterCompanyId) continue;
      const firstMeetingDate = firstMeetingByMasterMap.get(masterCompanyId);
      const firstContractDate = firstContractByMasterCompany.get(masterCompanyId);
      if (firstMeetingDate && firstContractDate) {
        const days = Math.floor(
          (firstContractDate.getTime() - new Date(firstMeetingDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (days >= 0) {
          totalDays += days;
          validCount++;
        }
      }
    }
    meetingToContractLt = validCount > 0 ? Math.round(totalDays / validCount) : null;
  }

  // ============================================
  // バックオフィス部の計算
  // ============================================

  // 運用開始LT: 該当月に「運用中」へ遷移した企業の「遷移日 - 初回キックオフ日」の平均
  const operationStage = await prisma.stpStage.findFirst({
    where: { name: "運用中", isActive: true },
    select: { id: true },
  });

  let operationStartLt: number | null = null;
  if (operationStage) {
    // 該当月に運用中へ遷移した履歴
    const opTransitions = await prisma.stpStageHistory.findMany({
      where: {
        toStageId: operationStage.id,
        isVoided: false,
        recordedAt: { gte: monthStart, lte: monthEnd },
      },
      select: {
        stpCompanyId: true,
        recordedAt: true,
      },
    });

    if (opTransitions.length > 0) {
      const koCategory = await prisma.contactCategory.findFirst({
        where: { name: "キックオフ", projectId: 1 },
        select: { id: true },
      });

      if (koCategory) {
        // stpCompanyId → masterCompanyId に変換
        const stpCompanyIds = [...new Set(opTransitions.map((t) => t.stpCompanyId))];
        const masterCompanyIdsForKo = stpCompanyIds
          .map((stpId) => stpToMasterMap.get(stpId))
          .filter((id): id is number => id !== undefined);

        const firstKickoffs = await prisma.contactHistory.groupBy({
          by: ["companyId"],
          where: {
            companyId: { in: masterCompanyIdsForKo },
            contactCategoryId: koCategory.id,
            deletedAt: null,
          },
          _min: {
            contactDate: true,
          },
        });

        // masterCompanyId → 初回KO日
        const koByMasterMap = new Map(
          firstKickoffs.map((fk) => [fk.companyId, fk._min.contactDate])
        );

        let totalDays = 0;
        let validCount = 0;
        for (const t of opTransitions) {
          const masterCompanyId = stpToMasterMap.get(t.stpCompanyId);
          if (!masterCompanyId) continue;
          const firstKoDate = koByMasterMap.get(masterCompanyId);
          if (firstKoDate) {
            const days = Math.floor(
              (t.recordedAt.getTime() - new Date(firstKoDate).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            if (days >= 0) {
              totalDays += days;
              validCount++;
            }
          }
        }
        operationStartLt = validCount > 0 ? Math.round(totalDays / validCount) : null;
      }
    }
  }

  // ============================================
  // ヘルパー: KPIアイテム生成
  // ============================================

  function makeKpiItem(
    key: DeptKpiKey,
    actual: number | null,
    preparingMessage?: string
  ): DeptKpiItem {
    const target = targetMap.get(key) ?? 0;
    const unit = DEPT_KPI_UNITS[key];
    let achievementRate = 0;

    if (actual !== null && target > 0) {
      if (unit === "日") {
        // LT系は目標以下が達成（目標日数以内で完了）
        achievementRate = actual <= target
          ? 100
          : Math.round((target / actual) * 1000) / 10;
      } else {
        achievementRate = Math.round((actual / target) * 1000) / 10;
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
    ...DEPT_KPI_GROUPS.alliance,
    kpis: [
      makeKpiItem(DEPT_KPI_KEYS.ALLIANCE_VALID_LEADS, validLeadCount),
      makeKpiItem(DEPT_KPI_KEYS.ALLIANCE_MEETINGS, meetingCount),
      makeKpiItem(DEPT_KPI_KEYS.ALLIANCE_SQL_RATE, sqlRate),
    ],
  };

  const salesTab: DeptTabData = {
    ...DEPT_KPI_GROUPS.sales,
    kpis: [
      makeKpiItem(DEPT_KPI_KEYS.SALES_CLOSE_RATE, closeRate),
      makeKpiItem(DEPT_KPI_KEYS.SALES_NEW_CONTRACTS, salesNewContracts),
      makeKpiItem(DEPT_KPI_KEYS.SALES_MEETING_TO_CONTRACT_LT, meetingToContractLt),
    ],
  };

  const backofficeTab: DeptTabData = {
    ...DEPT_KPI_GROUPS.backoffice,
    kpis: [
      makeKpiItem(DEPT_KPI_KEYS.BO_OPERATION_START_LT, operationStartLt),
      makeKpiItem(
        DEPT_KPI_KEYS.BO_COLLECTION_DELAY_RATE,
        null,
        "経理側準備中"
      ),
      makeKpiItem(DEPT_KPI_KEYS.BO_PAYMENT_LT, null, "経理側準備中"),
    ],
  };

  return [allianceTab, salesTab, backofficeTab];
}
