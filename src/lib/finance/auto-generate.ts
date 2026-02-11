import { prisma } from "@/lib/prisma";
import {
  calcWithholdingTax,
  isWithholdingTarget,
} from "./withholding-tax";

const AUTO_GENERATE_MONTHS = 3;

type ContractPlan = "monthly" | "performance" | string;

type CommissionConfig = {
  initialRate?: number | null;
  initialDuration?: number | null;
  monthlyType?: string | null;
  monthlyRate?: number | null;
  monthlyFixed?: number | null;
  monthlyDuration?: number | null;
  perfType?: string | null;
  perfRate?: number | null;
  perfFixed?: number | null;
  perfDuration?: number | null;
};

// ============================================
// 税計算ユーティリティ
// ============================================

type TaxType = "tax_included" | "tax_excluded";

const DEFAULT_TAX_TYPE: TaxType = "tax_included";
const DEFAULT_TAX_RATE = 10;

/**
 * 税額を計算する
 * - 内税: amount * rate / (100 + rate)  → 100,000の内税10% = 9,091
 * - 外税: amount * rate / 100           → 100,000の外税10% = 10,000
 */
export function calcTaxAmount(
  amount: number,
  taxType: TaxType | string,
  taxRate: number
): number {
  if (taxType === "tax_excluded") {
    return Math.round((amount * taxRate) / 100);
  }
  // tax_included（内税）
  return Math.round((amount * taxRate) / (100 + taxRate));
}

/**
 * 税込合計金額を返す
 * - 内税: amount そのまま
 * - 外税: amount + taxAmount
 */
export function calcTotalWithTax(
  amount: number,
  taxType: TaxType | string,
  taxRate: number
): number {
  if (taxType === "tax_excluded") {
    return amount + Math.round((amount * taxRate) / 100);
  }
  return amount;
}

// ============================================
// 共通ユーティリティ
// ============================================

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

const enumerateMonths = (start: Date, end: Date | null) => {
  const from = startOfMonth(start);
  if (!end) {
    return Array.from({ length: AUTO_GENERATE_MONTHS }, (_, i) =>
      addMonths(from, i)
    );
  }

  const to = startOfMonth(end);
  if (to < from) return [];

  const months: Date[] = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    months.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
  }
  return months;
};

const toNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calcByType = (
  baseAmount: number,
  type: string | null | undefined,
  rate: number | null | undefined,
  fixed: number | null | undefined
) => {
  if (type === "fixed") return fixed ?? 0;
  if (type === "rate") return Math.round((baseAmount * (rate ?? 0)) / 100);
  return 0;
};

// ============================================
// 契約ベースの自動生成
// ============================================

export async function autoGenerateFinanceForContractHistory(
  contractHistoryId: number
) {
  const contractHistory = await prisma.stpContractHistory.findUnique({
    where: { id: contractHistoryId },
  });

  if (!contractHistory || contractHistory.deletedAt) return;

  const stpCompany = await prisma.stpCompany.findFirst({
    where: { companyId: contractHistory.companyId },
  });

  if (!stpCompany) return;

  const targetMonths = enumerateMonths(
    contractHistory.contractStartDate,
    contractHistory.contractEndDate
  );

  await generateRevenueRecords({
    contractHistoryId: contractHistory.id,
    stpCompanyId: stpCompany.id,
    contractStartDate: contractHistory.contractStartDate,
    initialFee: contractHistory.initialFee,
    monthlyFee: contractHistory.monthlyFee,
    targetMonths,
  });

  if (stpCompany.agentId) {
    await generateExpenseRecords({
      contractHistoryId: contractHistory.id,
      stpCompanyId: stpCompany.id,
      agentId: stpCompany.agentId,
      contractPlan: contractHistory.contractPlan,
      contractStartDate: contractHistory.contractStartDate,
      initialFee: contractHistory.initialFee,
      monthlyFee: contractHistory.monthlyFee,
      targetMonths,
    });
  }
}

type RevenueGenerateParams = {
  contractHistoryId: number;
  stpCompanyId: number;
  contractStartDate: Date;
  initialFee: number;
  monthlyFee: number;
  targetMonths: Date[];
};

async function generateRevenueRecords(params: RevenueGenerateParams) {
  const {
    contractHistoryId,
    stpCompanyId,
    initialFee,
    monthlyFee,
    targetMonths,
  } = params;

  const startMonth = startOfMonth(params.contractStartDate);

  if (initialFee > 0) {
    await ensureRevenueRecord({
      contractHistoryId,
      stpCompanyId,
      revenueType: "initial",
      targetMonth: startMonth,
      expectedAmount: initialFee,
    });
  }

  if (monthlyFee > 0) {
    for (const month of targetMonths) {
      await ensureRevenueRecord({
        contractHistoryId,
        stpCompanyId,
        revenueType: "monthly",
        targetMonth: month,
        expectedAmount: monthlyFee,
      });
    }
  }
}

type EnsureRevenueParams = {
  contractHistoryId: number;
  stpCompanyId: number;
  revenueType: string;
  targetMonth: Date;
  expectedAmount: number;
  candidateId?: number;
  taxType?: string;
  taxRate?: number;
};

async function ensureRevenueRecord(params: EnsureRevenueParams) {
  const taxType = params.taxType ?? DEFAULT_TAX_TYPE;
  const taxRate = params.taxRate ?? DEFAULT_TAX_RATE;
  const taxAmount = calcTaxAmount(params.expectedAmount, taxType, taxRate);

  const whereClause: Record<string, unknown> = {
    stpCompanyId: params.stpCompanyId,
    contractHistoryId: params.contractHistoryId,
    revenueType: params.revenueType,
    targetMonth: params.targetMonth,
    deletedAt: null,
  };
  // 成果報酬は求職者単位でユニーク
  if (params.candidateId) {
    whereClause.candidateId = params.candidateId;
  }

  const existing = await prisma.stpRevenueRecord.findFirst({
    where: whereClause,
  });

  if (!existing) {
    await prisma.stpRevenueRecord.create({
      data: {
        stpCompanyId: params.stpCompanyId,
        contractHistoryId: params.contractHistoryId,
        revenueType: params.revenueType,
        targetMonth: params.targetMonth,
        expectedAmount: params.expectedAmount,
        taxType,
        taxRate,
        taxAmount,
        candidateId: params.candidateId ?? null,
        status: "pending",
        isAutoGenerated: true,
      },
    });
    return;
  }

  // スナップショット方式: 既存レコードのexpectedAmountは変更しない
  // 差異がある場合はlatestCalculatedAmount/sourceDataChangedAtをマーク
  if (existing.expectedAmount !== params.expectedAmount) {
    await prisma.stpRevenueRecord.update({
      where: { id: existing.id },
      data: {
        latestCalculatedAmount: params.expectedAmount,
        sourceDataChangedAt: new Date(),
      },
    });
  } else if (existing.sourceDataChangedAt) {
    // 差異が解消された場合はクリア
    await prisma.stpRevenueRecord.update({
      where: { id: existing.id },
      data: {
        latestCalculatedAmount: null,
        sourceDataChangedAt: null,
      },
    });
  }
}

type ExpenseGenerateParams = {
  contractHistoryId: number;
  stpCompanyId: number;
  agentId: number;
  contractPlan: ContractPlan;
  contractStartDate: Date;
  initialFee: number;
  monthlyFee: number;
  targetMonths: Date[];
};

async function generateExpenseRecords(params: ExpenseGenerateParams) {
  const agentContractHistory = await prisma.stpAgentContractHistory.findFirst({
    where: {
      agentId: params.agentId,
      contractStartDate: { lte: params.contractStartDate },
      OR: [
        { contractEndDate: null },
        { contractEndDate: { gte: params.contractStartDate } },
      ],
      deletedAt: null,
    },
    orderBy: { contractStartDate: "desc" },
    include: {
      agent: true,
    },
  });

  if (!agentContractHistory) return;

  const override = await prisma.stpAgentCommissionOverride.findFirst({
    where: {
      agentContractHistoryId: agentContractHistory.id,
      stpCompanyId: params.stpCompanyId,
    },
  });

  const commissionConfig = buildCommissionConfig(
    params.contractPlan,
    agentContractHistory,
    override
  );

  // 源泉徴収対象かどうか判定
  const agent = agentContractHistory.agent;
  const needsWithholding = agent && isWithholdingTarget(agent);

  // 源泉徴収計算のヘルパー
  const buildWithholdingFields = (amount: number) => {
    if (!needsWithholding || amount <= 0) return {};
    const whTax = calcWithholdingTax(amount);
    return {
      withholdingTaxRate: amount <= 1_000_000 ? 10.21 : 20.42,
      withholdingTaxAmount: whTax,
      netPaymentAmount: amount - whTax,
    };
  };

  const startMonth = startOfMonth(params.contractStartDate);

  if ((agentContractHistory.initialFee ?? 0) > 0) {
    const amt = agentContractHistory.initialFee ?? 0;
    await ensureExpenseRecord({
      agentId: params.agentId,
      stpCompanyId: params.stpCompanyId,
      agentContractHistoryId: agentContractHistory.id,
      contractHistoryId: params.contractHistoryId,
      expenseType: "agent_initial",
      targetMonth: startMonth,
      expectedAmount: amt,
      ...buildWithholdingFields(amt),
    });
  }

  if ((agentContractHistory.monthlyFee ?? 0) > 0) {
    const amt = agentContractHistory.monthlyFee ?? 0;
    for (const month of params.targetMonths) {
      await ensureExpenseRecord({
        agentId: params.agentId,
        stpCompanyId: params.stpCompanyId,
        agentContractHistoryId: agentContractHistory.id,
        contractHistoryId: params.contractHistoryId,
        expenseType: "agent_monthly",
        targetMonth: month,
        expectedAmount: amt,
        ...buildWithholdingFields(amt),
      });
    }
  }

  if (params.initialFee > 0) {
    const initialRate = commissionConfig.initialRate ?? 0;
    const initialCommission = Math.round((params.initialFee * initialRate) / 100);

    if (initialCommission > 0) {
      await ensureExpenseRecord({
        agentId: params.agentId,
        stpCompanyId: params.stpCompanyId,
        agentContractHistoryId: agentContractHistory.id,
        contractHistoryId: params.contractHistoryId,
        expenseType: "commission_initial",
        targetMonth: startMonth,
        expectedAmount: initialCommission,
        appliedCommissionRate: initialRate,
        appliedCommissionType: "rate",
        ...buildWithholdingFields(initialCommission),
      });
    }
  }

  if (params.monthlyFee > 0 && params.contractPlan !== "performance") {
    const duration =
      commissionConfig.monthlyDuration ?? params.targetMonths.length;
    const months = params.targetMonths.slice(0, duration);

    for (const month of months) {
      const monthlyCommission = calcByType(
        params.monthlyFee,
        commissionConfig.monthlyType,
        commissionConfig.monthlyRate,
        commissionConfig.monthlyFixed
      );

      if (monthlyCommission <= 0) continue;

      await ensureExpenseRecord({
        agentId: params.agentId,
        stpCompanyId: params.stpCompanyId,
        agentContractHistoryId: agentContractHistory.id,
        contractHistoryId: params.contractHistoryId,
        expenseType: "commission_monthly",
        targetMonth: month,
        expectedAmount: monthlyCommission,
        appliedCommissionRate: commissionConfig.monthlyType === "rate" ? (commissionConfig.monthlyRate ?? undefined) : undefined,
        appliedCommissionType: commissionConfig.monthlyType ?? undefined,
        ...buildWithholdingFields(monthlyCommission),
      });
    }
  }
}

type EnsureExpenseParams = {
  agentId: number;
  stpCompanyId: number;
  agentContractHistoryId: number;
  contractHistoryId: number;
  expenseType: string;
  targetMonth: Date;
  expectedAmount: number;
  revenueRecordId?: number;
  taxType?: string;
  taxRate?: number;
  appliedCommissionRate?: number;
  appliedCommissionType?: string;
  withholdingTaxRate?: number;
  withholdingTaxAmount?: number;
  netPaymentAmount?: number;
};

async function ensureExpenseRecord(params: EnsureExpenseParams) {
  const taxType = params.taxType ?? DEFAULT_TAX_TYPE;
  const taxRate = params.taxRate ?? DEFAULT_TAX_RATE;
  const taxAmount = calcTaxAmount(params.expectedAmount, taxType, taxRate);

  const existing = await prisma.stpExpenseRecord.findFirst({
    where: {
      agentId: params.agentId,
      stpCompanyId: params.stpCompanyId,
      agentContractHistoryId: params.agentContractHistoryId,
      contractHistoryId: params.contractHistoryId,
      expenseType: params.expenseType,
      targetMonth: params.targetMonth,
      deletedAt: null,
    },
  });

  if (!existing) {
    await prisma.stpExpenseRecord.create({
      data: {
        agentId: params.agentId,
        stpCompanyId: params.stpCompanyId,
        agentContractHistoryId: params.agentContractHistoryId,
        contractHistoryId: params.contractHistoryId,
        expenseType: params.expenseType,
        targetMonth: params.targetMonth,
        expectedAmount: params.expectedAmount,
        taxType,
        taxRate,
        taxAmount,
        revenueRecordId: params.revenueRecordId ?? null,
        appliedCommissionRate: params.appliedCommissionRate ?? null,
        appliedCommissionType: params.appliedCommissionType ?? null,
        withholdingTaxRate: params.withholdingTaxRate ?? null,
        withholdingTaxAmount: params.withholdingTaxAmount ?? null,
        netPaymentAmount: params.netPaymentAmount ?? null,
        status: "pending",
        isAutoGenerated: true,
      },
    });
    return;
  }

  // スナップショット方式: 既存レコードのexpectedAmountは変更しない
  // 差異がある場合はlatestCalculatedAmount/sourceDataChangedAtをマーク
  if (existing.expectedAmount !== params.expectedAmount) {
    await prisma.stpExpenseRecord.update({
      where: { id: existing.id },
      data: {
        latestCalculatedAmount: params.expectedAmount,
        sourceDataChangedAt: new Date(),
      },
    });
  } else if (existing.sourceDataChangedAt) {
    // 差異が解消された場合はクリア
    await prisma.stpExpenseRecord.update({
      where: { id: existing.id },
      data: {
        latestCalculatedAmount: null,
        sourceDataChangedAt: null,
      },
    });
  }
}

// ============================================
// 月次一括生成
// ============================================

/**
 * 月次一括生成: 全アクティブ契約から指定月+2ヶ月先まで売上・経費レコードを一括生成
 */
export async function generateMonthlyRecordsForAllContracts(
  baseMonth?: Date
): Promise<{ revenueCreated: number; expenseCreated: number }> {
  const now = baseMonth ?? new Date();
  const from = startOfMonth(now);
  const targetMonths = Array.from({ length: AUTO_GENERATE_MONTHS }, (_, i) =>
    addMonths(from, i)
  );

  const activeContracts = await prisma.stpContractHistory.findMany({
    where: {
      status: "active",
      deletedAt: null,
    },
  });

  let revenueCreated = 0;
  let expenseCreated = 0;

  for (const contract of activeContracts) {
    const stpCompany = await prisma.stpCompany.findFirst({
      where: { companyId: contract.companyId },
    });
    if (!stpCompany) continue;

    // 契約開始月より前の月はスキップ
    const contractStart = startOfMonth(contract.contractStartDate);
    const validMonths = targetMonths.filter((m) => m >= contractStart);
    // 契約終了日があればそれ以降をスキップ
    const endMonth = contract.contractEndDate
      ? startOfMonth(contract.contractEndDate)
      : null;
    const filteredMonths = endMonth
      ? validMonths.filter((m) => m <= endMonth)
      : validMonths;

    if (filteredMonths.length === 0) continue;

    // 売上レコード生成前のカウント
    const revBefore = await prisma.stpRevenueRecord.count({
      where: {
        stpCompanyId: stpCompany.id,
        contractHistoryId: contract.id,
        deletedAt: null,
      },
    });

    await generateRevenueRecords({
      contractHistoryId: contract.id,
      stpCompanyId: stpCompany.id,
      contractStartDate: contract.contractStartDate,
      initialFee: contract.initialFee,
      monthlyFee: contract.monthlyFee,
      targetMonths: filteredMonths,
    });

    const revAfter = await prisma.stpRevenueRecord.count({
      where: {
        stpCompanyId: stpCompany.id,
        contractHistoryId: contract.id,
        deletedAt: null,
      },
    });
    revenueCreated += revAfter - revBefore;

    // 経費レコード生成
    if (stpCompany.agentId) {
      const expBefore = await prisma.stpExpenseRecord.count({
        where: {
          stpCompanyId: stpCompany.id,
          contractHistoryId: contract.id,
          deletedAt: null,
        },
      });

      await generateExpenseRecords({
        contractHistoryId: contract.id,
        stpCompanyId: stpCompany.id,
        agentId: stpCompany.agentId,
        contractPlan: contract.contractPlan,
        contractStartDate: contract.contractStartDate,
        initialFee: contract.initialFee,
        monthlyFee: contract.monthlyFee,
        targetMonths: filteredMonths,
      });

      const expAfter = await prisma.stpExpenseRecord.count({
        where: {
          stpCompanyId: stpCompany.id,
          contractHistoryId: contract.id,
          deletedAt: null,
        },
      });
      expenseCreated += expAfter - expBefore;
    }
  }

  // 成果報酬の一括生成（入社日のある求職者全員）
  const candidatesWithJoin = await prisma.stpCandidate.findMany({
    where: {
      joinDate: { not: null },
    },
  });

  const perfRevBefore = await prisma.stpRevenueRecord.count({
    where: { revenueType: "performance", deletedAt: null },
  });
  const perfExpBefore = await prisma.stpExpenseRecord.count({
    where: { expenseType: "commission_performance", deletedAt: null },
  });

  for (const candidate of candidatesWithJoin) {
    await autoGeneratePerformanceFeeForCandidate(candidate.id);
  }

  const perfRevAfter = await prisma.stpRevenueRecord.count({
    where: { revenueType: "performance", deletedAt: null },
  });
  const perfExpAfter = await prisma.stpExpenseRecord.count({
    where: { expenseType: "commission_performance", deletedAt: null },
  });
  revenueCreated += perfRevAfter - perfRevBefore;
  expenseCreated += perfExpAfter - perfExpBefore;

  return { revenueCreated, expenseCreated };
}

// ============================================
// 成果報酬自動生成（求職者の入社日トリガー）
// ============================================

/**
 * 求職者の入社日(joinDate)をトリガーに成果報酬の売上・経費を自動生成
 * - 売上: 入社先企業の入社日時点の契約から performanceFee を取得
 * - 経費: 代理店契約の成果報酬率/固定額から報酬を算出
 * 冪等: 同一(企業, 契約, "performance", 対象月, candidateId)で重複チェック
 */
export type PerformanceFeeResult = {
  revenueCreated: boolean;
  expenseCreated: boolean;
  error?: "no_contract" | "multiple_contracts" | "no_join_date" | "no_company";
  matchCount?: number;
};

export async function autoGeneratePerformanceFeeForCandidate(
  candidateId: number
): Promise<PerformanceFeeResult> {
  const candidate = await prisma.stpCandidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidate || !candidate.joinDate) {
    return { revenueCreated: false, expenseCreated: false, error: "no_join_date" };
  }

  if (!candidate.stpCompanyId) {
    return { revenueCreated: false, expenseCreated: false, error: "no_company" };
  }

  const stpCompany = await prisma.stpCompany.findUnique({
    where: { id: candidate.stpCompanyId },
  });

  if (!stpCompany) {
    return { revenueCreated: false, expenseCreated: false, error: "no_company" };
  }

  // 入社日時点でアクティブな契約を検索（条件にindustryType + jobMedia + performanceFee > 0を追加）
  const contractWhere: Record<string, unknown> = {
    companyId: stpCompany.companyId,
    contractStartDate: { lte: candidate.joinDate },
    OR: [
      { contractEndDate: null },
      { contractEndDate: { gte: candidate.joinDate } },
    ],
    performanceFee: { gt: 0 },
    status: "active",
    deletedAt: null,
  };

  // 求職者にindustryTypeが設定されていれば条件に追加
  if (candidate.industryType) {
    contractWhere.industryType = candidate.industryType;
  }
  // 求職者にjobMediaが設定されていれば条件に追加
  if (candidate.jobMedia) {
    contractWhere.jobMedia = candidate.jobMedia;
  }

  const matchingContracts = await prisma.stpContractHistory.findMany({
    where: contractWhere,
    orderBy: { contractStartDate: "desc" },
  });

  if (matchingContracts.length === 0) {
    return { revenueCreated: false, expenseCreated: false, error: "no_contract", matchCount: 0 };
  }

  if (matchingContracts.length > 1) {
    return { revenueCreated: false, expenseCreated: false, error: "multiple_contracts", matchCount: matchingContracts.length };
  }

  const contractHistory = matchingContracts[0];

  const targetMonth = startOfMonth(candidate.joinDate);
  let revenueCreated = false;
  let expenseCreated = false;

  // --- 売上レコード生成 ---
  const existingRevenue = await prisma.stpRevenueRecord.findFirst({
    where: {
      stpCompanyId: stpCompany.id,
      contractHistoryId: contractHistory.id,
      revenueType: "performance",
      candidateId: candidate.id,
      deletedAt: null,
    },
  });

  if (!existingRevenue) {
    const taxAmount = calcTaxAmount(
      contractHistory.performanceFee,
      DEFAULT_TAX_TYPE,
      DEFAULT_TAX_RATE
    );

    await prisma.stpRevenueRecord.create({
      data: {
        stpCompanyId: stpCompany.id,
        contractHistoryId: contractHistory.id,
        candidateId: candidate.id,
        revenueType: "performance",
        targetMonth,
        expectedAmount: contractHistory.performanceFee,
        taxType: DEFAULT_TAX_TYPE,
        taxRate: DEFAULT_TAX_RATE,
        taxAmount,
        status: "pending",
        isAutoGenerated: true,
      },
    });
    revenueCreated = true;
  } else if (existingRevenue.expectedAmount !== contractHistory.performanceFee) {
    // スナップショット方式: 差異をマーク
    await prisma.stpRevenueRecord.update({
      where: { id: existingRevenue.id },
      data: {
        latestCalculatedAmount: contractHistory.performanceFee,
        sourceDataChangedAt: new Date(),
      },
    });
  } else if (existingRevenue.sourceDataChangedAt) {
    // 差異が解消された場合はクリア
    await prisma.stpRevenueRecord.update({
      where: { id: existingRevenue.id },
      data: {
        latestCalculatedAmount: null,
        sourceDataChangedAt: null,
      },
    });
  }

  // --- 経費レコード生成（代理店がある場合のみ）---
  if (stpCompany.agentId) {
    // 入社日時点の代理店契約を取得
    const agentContractHistory = await prisma.stpAgentContractHistory.findFirst({
      where: {
        agentId: stpCompany.agentId,
        contractStartDate: { lte: candidate.joinDate },
        OR: [
          { contractEndDate: null },
          { contractEndDate: { gte: candidate.joinDate } },
        ],
        deletedAt: null,
      },
      orderBy: { contractStartDate: "desc" },
      include: { agent: true },
    });

    if (agentContractHistory) {
      const override = await prisma.stpAgentCommissionOverride.findFirst({
        where: {
          agentContractHistoryId: agentContractHistory.id,
          stpCompanyId: stpCompany.id,
        },
      });

      const commissionConfig = buildCommissionConfig(
        contractHistory.contractPlan,
        agentContractHistory,
        override
      );

      // 成果報酬の紹介報酬を計算
      const perfCommission = calcByType(
        contractHistory.performanceFee,
        commissionConfig.perfType,
        commissionConfig.perfRate,
        commissionConfig.perfFixed
      );

      // 源泉徴収対象判定
      const perfAgent = agentContractHistory.agent;
      const perfNeedsWithholding = perfAgent && isWithholdingTarget(perfAgent);

      if (perfCommission > 0) {
        // 売上レコードのIDを取得（リンク用）
        const revenueRecord = await prisma.stpRevenueRecord.findFirst({
          where: {
            stpCompanyId: stpCompany.id,
            contractHistoryId: contractHistory.id,
            revenueType: "performance",
            candidateId: candidate.id,
            deletedAt: null,
          },
        });

        const existingExpense = await prisma.stpExpenseRecord.findFirst({
          where: {
            agentId: stpCompany.agentId,
            stpCompanyId: stpCompany.id,
            contractHistoryId: contractHistory.id,
            expenseType: "commission_performance",
            targetMonth,
            revenueRecordId: revenueRecord?.id ?? null,
            deletedAt: null,
          },
        });

        if (!existingExpense) {
          const taxAmount = calcTaxAmount(
            perfCommission,
            DEFAULT_TAX_TYPE,
            DEFAULT_TAX_RATE
          );

          // 源泉徴収計算
          const whFields: Record<string, unknown> = {};
          if (perfNeedsWithholding) {
            const whTax = calcWithholdingTax(perfCommission);
            whFields.withholdingTaxRate = perfCommission <= 1_000_000 ? 10.21 : 20.42;
            whFields.withholdingTaxAmount = whTax;
            whFields.netPaymentAmount = perfCommission - whTax;
          }

          await prisma.stpExpenseRecord.create({
            data: {
              agentId: stpCompany.agentId,
              stpCompanyId: stpCompany.id,
              agentContractHistoryId: agentContractHistory.id,
              contractHistoryId: contractHistory.id,
              revenueRecordId: revenueRecord?.id ?? null,
              expenseType: "commission_performance",
              targetMonth,
              expectedAmount: perfCommission,
              taxType: DEFAULT_TAX_TYPE,
              taxRate: DEFAULT_TAX_RATE,
              taxAmount,
              appliedCommissionRate: commissionConfig.perfType === "rate" ? (commissionConfig.perfRate ?? null) : null,
              appliedCommissionType: commissionConfig.perfType ?? null,
              ...whFields,
              status: "pending",
              isAutoGenerated: true,
            },
          });
          expenseCreated = true;
        } else if (existingExpense.expectedAmount !== perfCommission) {
          // スナップショット方式: 差異をマーク
          await prisma.stpExpenseRecord.update({
            where: { id: existingExpense.id },
            data: {
              latestCalculatedAmount: perfCommission,
              sourceDataChangedAt: new Date(),
            },
          });
        } else if (existingExpense.sourceDataChangedAt) {
          // 差異が解消された場合はクリア
          await prisma.stpExpenseRecord.update({
            where: { id: existingExpense.id },
            data: {
              latestCalculatedAmount: null,
              sourceDataChangedAt: null,
            },
          });
        }
      }
    }
  }

  return { revenueCreated, expenseCreated };
}

// ============================================
// CommissionConfig構築
// ============================================

function buildCommissionConfig(
  contractPlan: ContractPlan,
  agentContractHistory: {
    defaultMpInitialRate: unknown;
    defaultMpInitialDuration: unknown;
    defaultMpMonthlyType: string | null;
    defaultMpMonthlyRate: unknown;
    defaultMpMonthlyFixed: unknown;
    defaultMpMonthlyDuration: unknown;
    defaultPpInitialRate: unknown;
    defaultPpInitialDuration: unknown;
    defaultPpPerfType: string | null;
    defaultPpPerfRate: unknown;
    defaultPpPerfFixed: unknown;
    defaultPpPerfDuration: unknown;
  },
  override: {
    mpInitialRate: unknown;
    mpInitialDuration: unknown;
    mpMonthlyType: string | null;
    mpMonthlyRate: unknown;
    mpMonthlyFixed: unknown;
    mpMonthlyDuration: unknown;
    ppInitialRate: unknown;
    ppInitialDuration: unknown;
    ppPerfType: string | null;
    ppPerfRate: unknown;
    ppPerfFixed: unknown;
    ppPerfDuration: unknown;
  } | null
): CommissionConfig {
  if (contractPlan === "performance") {
    return {
      initialRate: toNumber(
        override?.ppInitialRate ?? agentContractHistory.defaultPpInitialRate
      ),
      initialDuration: toNumber(
        override?.ppInitialDuration ??
          agentContractHistory.defaultPpInitialDuration
      ),
      monthlyType: null,
      monthlyRate: null,
      monthlyFixed: null,
      monthlyDuration: null,
      perfType: override?.ppPerfType ?? agentContractHistory.defaultPpPerfType,
      perfRate: toNumber(
        override?.ppPerfRate ?? agentContractHistory.defaultPpPerfRate
      ),
      perfFixed: toNumber(
        override?.ppPerfFixed ?? agentContractHistory.defaultPpPerfFixed
      ),
      perfDuration: toNumber(
        override?.ppPerfDuration ?? agentContractHistory.defaultPpPerfDuration
      ),
    };
  }

  return {
    initialRate: toNumber(
      override?.mpInitialRate ?? agentContractHistory.defaultMpInitialRate
    ),
    initialDuration: toNumber(
      override?.mpInitialDuration ?? agentContractHistory.defaultMpInitialDuration
    ),
    monthlyType: override?.mpMonthlyType ?? agentContractHistory.defaultMpMonthlyType,
    monthlyRate: toNumber(
      override?.mpMonthlyRate ?? agentContractHistory.defaultMpMonthlyRate
    ),
    monthlyFixed: toNumber(
      override?.mpMonthlyFixed ?? agentContractHistory.defaultMpMonthlyFixed
    ),
    monthlyDuration: toNumber(
      override?.mpMonthlyDuration ?? agentContractHistory.defaultMpMonthlyDuration
    ),
    perfType: null,
    perfRate: null,
    perfFixed: null,
    perfDuration: null,
  };
}

// ============================================
// 元データ変更時の差異マーキング
// ============================================

/**
 * 企業契約変更時: 該当する売上・経費レコードに差異をマーク
 * 契約保存時に呼ばれる（レコードの自動生成は行わない）
 */
export async function markFinanceRecordsForContractChange(
  contractHistoryId: number
): Promise<number> {
  const contractHistory = await prisma.stpContractHistory.findUnique({
    where: { id: contractHistoryId },
  });
  if (!contractHistory || contractHistory.deletedAt) return 0;

  const stpCompany = await prisma.stpCompany.findFirst({
    where: { companyId: contractHistory.companyId },
  });
  if (!stpCompany) return 0;

  let affectedCount = 0;

  // 売上レコードの差異チェック
  const revenueRecords = await prisma.stpRevenueRecord.findMany({
    where: {
      contractHistoryId,
      deletedAt: null,
    },
  });

  for (const record of revenueRecords) {
    let calculatedAmount: number | null = null;

    if (record.revenueType === "initial") {
      calculatedAmount = contractHistory.initialFee;
    } else if (record.revenueType === "monthly") {
      calculatedAmount = contractHistory.monthlyFee;
    } else if (record.revenueType === "performance") {
      calculatedAmount = contractHistory.performanceFee;
    }

    if (calculatedAmount == null) continue;

    if (record.expectedAmount !== calculatedAmount) {
      await prisma.stpRevenueRecord.update({
        where: { id: record.id },
        data: {
          latestCalculatedAmount: calculatedAmount,
          sourceDataChangedAt: new Date(),
        },
      });
      affectedCount++;
    } else if (record.sourceDataChangedAt) {
      await prisma.stpRevenueRecord.update({
        where: { id: record.id },
        data: {
          latestCalculatedAmount: null,
          sourceDataChangedAt: null,
        },
      });
    }
  }

  // 経費レコードの差異チェック（紹介報酬）
  const expenseRecords = await prisma.stpExpenseRecord.findMany({
    where: {
      contractHistoryId,
      deletedAt: null,
    },
  });

  for (const record of expenseRecords) {
    let calculatedAmount: number | null = null;

    if (record.expenseType === "commission_initial") {
      // 初期費用紹介報酬: 企業契約の初期費用 × 報酬率
      if (record.agentContractHistoryId) {
        const agentContract = await prisma.stpAgentContractHistory.findUnique({
          where: { id: record.agentContractHistoryId },
        });
        if (agentContract) {
          const override = record.stpCompanyId
            ? await prisma.stpAgentCommissionOverride.findFirst({
                where: {
                  agentContractHistoryId: agentContract.id,
                  stpCompanyId: record.stpCompanyId,
                },
              })
            : null;
          const commissionConfig = buildCommissionConfig(
            contractHistory.contractPlan,
            agentContract,
            override
          );
          const rate = commissionConfig.initialRate ?? 0;
          calculatedAmount = Math.round((contractHistory.initialFee * rate) / 100);
        }
      }
    } else if (record.expenseType === "commission_monthly") {
      // 月額紹介報酬
      if (record.agentContractHistoryId) {
        const agentContract = await prisma.stpAgentContractHistory.findUnique({
          where: { id: record.agentContractHistoryId },
        });
        if (agentContract) {
          const override = record.stpCompanyId
            ? await prisma.stpAgentCommissionOverride.findFirst({
                where: {
                  agentContractHistoryId: agentContract.id,
                  stpCompanyId: record.stpCompanyId,
                },
              })
            : null;
          const commissionConfig = buildCommissionConfig(
            contractHistory.contractPlan,
            agentContract,
            override
          );
          calculatedAmount = calcByType(
            contractHistory.monthlyFee,
            commissionConfig.monthlyType,
            commissionConfig.monthlyRate,
            commissionConfig.monthlyFixed
          );
        }
      }
    }

    if (calculatedAmount == null) continue;

    if (record.expectedAmount !== calculatedAmount) {
      await prisma.stpExpenseRecord.update({
        where: { id: record.id },
        data: {
          latestCalculatedAmount: calculatedAmount,
          sourceDataChangedAt: new Date(),
        },
      });
      affectedCount++;
    } else if (record.sourceDataChangedAt) {
      await prisma.stpExpenseRecord.update({
        where: { id: record.id },
        data: {
          latestCalculatedAmount: null,
          sourceDataChangedAt: null,
        },
      });
    }
  }

  return affectedCount;
}

/**
 * 代理店契約変更時: 該当する経費レコードに差異をマーク
 */
export async function markExpenseRecordsForAgentChange(
  agentContractHistoryId: number
): Promise<number> {
  const agentContract = await prisma.stpAgentContractHistory.findUnique({
    where: { id: agentContractHistoryId },
  });
  if (!agentContract || agentContract.deletedAt) return 0;

  const expenseRecords = await prisma.stpExpenseRecord.findMany({
    where: {
      agentContractHistoryId,
      deletedAt: null,
    },
    include: {
      contractHistory: true,
    },
  });

  let affectedCount = 0;

  for (const record of expenseRecords) {
    let calculatedAmount: number | null = null;

    if (record.expenseType === "agent_initial") {
      calculatedAmount = agentContract.initialFee ?? 0;
    } else if (record.expenseType === "agent_monthly") {
      calculatedAmount = agentContract.monthlyFee ?? 0;
    } else if (
      record.expenseType === "commission_initial" ||
      record.expenseType === "commission_monthly" ||
      record.expenseType === "commission_performance"
    ) {
      // 紹介報酬: 企業契約の金額 × 報酬率
      if (record.contractHistory) {
        const override = record.stpCompanyId
          ? await prisma.stpAgentCommissionOverride.findFirst({
              where: {
                agentContractHistoryId: agentContract.id,
                stpCompanyId: record.stpCompanyId,
              },
            })
          : null;
        const commissionConfig = buildCommissionConfig(
          record.contractHistory.contractPlan,
          agentContract,
          override
        );

        if (record.expenseType === "commission_initial") {
          const rate = commissionConfig.initialRate ?? 0;
          calculatedAmount = Math.round((record.contractHistory.initialFee * rate) / 100);
        } else if (record.expenseType === "commission_monthly") {
          calculatedAmount = calcByType(
            record.contractHistory.monthlyFee,
            commissionConfig.monthlyType,
            commissionConfig.monthlyRate,
            commissionConfig.monthlyFixed
          );
        } else if (record.expenseType === "commission_performance") {
          calculatedAmount = calcByType(
            record.contractHistory.performanceFee,
            commissionConfig.perfType,
            commissionConfig.perfRate,
            commissionConfig.perfFixed
          );
        }
      }
    }

    if (calculatedAmount == null) continue;

    if (record.expectedAmount !== calculatedAmount) {
      await prisma.stpExpenseRecord.update({
        where: { id: record.id },
        data: {
          latestCalculatedAmount: calculatedAmount,
          sourceDataChangedAt: new Date(),
        },
      });
      affectedCount++;
    } else if (record.sourceDataChangedAt) {
      await prisma.stpExpenseRecord.update({
        where: { id: record.id },
        data: {
          latestCalculatedAmount: null,
          sourceDataChangedAt: null,
        },
      });
    }
  }

  return affectedCount;
}
