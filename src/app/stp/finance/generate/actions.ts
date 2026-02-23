"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  calcTaxAmount,
} from "@/lib/finance/auto-generate";
import {
  calcWithholdingTax,
  isWithholdingTarget,
} from "@/lib/finance/withholding-tax";

// ============================================
// 型定義
// ============================================

export type TransactionCandidate = {
  /** 候補のユニークキー（重複チェック用） */
  key: string;
  source: "crm" | "recurring";
  type: "revenue" | "expense";
  counterpartyId: number;
  counterpartyName: string;
  expenseCategoryId: number;
  expenseCategoryName: string;
  amount: number | null; // 変動金額の場合null
  taxAmount: number | null;
  taxRate: number;
  taxType: string;
  periodFrom: string;
  periodTo: string;
  note: string | null;
  /** CRM由来の場合 */
  contractId: number | null;
  contractTitle: string | null;
  stpContractHistoryId: number | null;
  stpRevenueType: string | null;
  stpExpenseType: string | null;
  stpCandidateId: number | null;
  stpAgentId: number | null;
  /** 定期取引由来の場合 */
  recurringTransactionId: number | null;
  /** 按分設定 */
  costCenterId: number | null;
  costCenterName: string | null;
  allocationTemplateId: number | null;
  allocationTemplateName: string | null;
  /** 決済手段 */
  paymentMethodId: number | null;
  /** 源泉徴収 */
  isWithholdingTarget: boolean;
  withholdingTaxRate: number | null;
  withholdingTaxAmount: number | null;
  netPaymentAmount: number | null;
  /** ソースデータ変更アラート */
  sourceDataChanged: boolean;
  previousAmount: number | null;
  latestCalculatedAmount: number | null;
  /** 既に同月に取引レコードが存在するか */
  alreadyGenerated: boolean;
};

// ============================================
// ユーティリティ
// ============================================

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const formatDate = (date: Date): string => date.toISOString().split("T")[0];

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
// 1. detectTransactionCandidates
// ============================================

/**
 * 対象月に発生するはずの取引候補を検出する
 * - CRM契約データ（STP）から売上・経費候補を検出
 * - 定期取引テーブルから候補を検出
 * - 既にTransactionテーブルに存在する場合はalreadyGenerated=true
 */
export async function detectTransactionCandidates(
  targetMonth: string
): Promise<TransactionCandidate[]> {
  await getSession();

  const targetDate = new Date(targetMonth + "-01");
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);

  const candidates: TransactionCandidate[] = [];

  // --- CRM契約ベースの候補検出 ---
  await detectCrmCandidates(candidates, monthStart, monthEnd);

  // --- 定期取引ベースの候補検出 ---
  await detectRecurringCandidates(candidates, monthStart, monthEnd);

  return candidates;
}

// ============================================
// CRM契約ベースの候補検出（STP固有ロジック）
// ============================================

async function detectCrmCandidates(
  candidates: TransactionCandidate[],
  monthStart: Date,
  monthEnd: Date
) {
  const DEFAULT_TAX_TYPE = "tax_included";
  const DEFAULT_TAX_RATE = 10;

  // 対象月に有効な契約を取得
  const activeContracts = await prisma.stpContractHistory.findMany({
    where: {
      contractStartDate: { lte: monthEnd },
      OR: [
        { contractEndDate: null },
        { contractEndDate: { gte: monthStart } },
      ],
      status: "active",
      deletedAt: null,
    },
    include: {
      company: true,
    },
  });

  // 既存のTransactionレコードを取得（重複チェック用）
  const existingTransactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      periodFrom: { gte: monthStart, lte: monthEnd },
      sourceType: "crm",
      stpContractHistoryId: {
        in: activeContracts.map((c) => c.id),
      },
    },
  });

  // Counterpartyマッピング（companyId → Counterparty）
  const companyIds = [...new Set(activeContracts.map((c) => c.companyId))];
  const counterparties = await prisma.counterparty.findMany({
    where: {
      companyId: { in: companyIds },
      deletedAt: null,
    },
  });
  const counterpartyByCompanyId = new Map(
    counterparties.map((c) => [c.companyId, c])
  );

  // STPプロジェクトのCostCenter
  const stpCostCenter = await prisma.costCenter.findFirst({
    where: {
      project: { code: "stp" },
      deletedAt: null,
      isActive: true,
    },
  });

  // 費目マスタ（売上用・経費用）
  const expenseCategories = await prisma.expenseCategory.findMany({
    where: { deletedAt: null, isActive: true },
  });
  const revenueCategoryInitial = expenseCategories.find(
    (c) => c.type !== "expense" && c.name.includes("初期")
  );
  const revenueCategoryMonthly = expenseCategories.find(
    (c) => c.type !== "expense" && c.name.includes("月額")
  );
  const revenueCategoryPerformance = expenseCategories.find(
    (c) => c.type !== "expense" && c.name.includes("成果")
  );
  const expenseCategoryOutsourcing = expenseCategories.find(
    (c) => c.type !== "revenue" && c.name.includes("外注")
  );
  // フォールバック: 見つからない場合は最初のものを使う
  const defaultRevenueCategory = expenseCategories.find(
    (c) => c.type === "revenue" || c.type === "both"
  );
  const defaultExpenseCategory = expenseCategories.find(
    (c) => c.type === "expense" || c.type === "both"
  );

  for (const contract of activeContracts) {
    const counterparty = counterpartyByCompanyId.get(contract.companyId);
    if (!counterparty) continue;

    const contractStart = startOfMonth(contract.contractStartDate);
    const periodFromStr = formatDate(monthStart);
    const periodToStr = formatDate(monthEnd);

    // === 売上: 初期費用 ===
    if (
      contract.initialFee > 0 &&
      contractStart.getTime() === monthStart.getTime()
    ) {
      const revCategory = revenueCategoryInitial ?? defaultRevenueCategory;
      if (revCategory) {
        const key = `crm-revenue-initial-${contract.id}`;
        const existing = existingTransactions.find(
          (t) =>
            t.stpContractHistoryId === contract.id &&
            t.stpRevenueType === "initial" &&
            t.type === "revenue"
        );

        candidates.push({
          key,
          source: "crm",
          type: "revenue",
          counterpartyId: counterparty.id,
          counterpartyName: counterparty.name,
          expenseCategoryId: revCategory.id,
          expenseCategoryName: revCategory.name,
          amount: contract.initialFee,
          taxAmount: calcTaxAmount(contract.initialFee, DEFAULT_TAX_TYPE, DEFAULT_TAX_RATE),
          taxRate: DEFAULT_TAX_RATE,
          taxType: DEFAULT_TAX_TYPE,
          periodFrom: periodFromStr,
          periodTo: periodFromStr,
          note: `${contract.company.name} 初期費用`,
          contractId: null,
          contractTitle: null,
          stpContractHistoryId: contract.id,
          stpRevenueType: "initial",
          stpExpenseType: null,
          stpCandidateId: null,
          stpAgentId: null,
          recurringTransactionId: null,
          costCenterId: stpCostCenter?.id ?? null,
          costCenterName: stpCostCenter?.name ?? null,
          allocationTemplateId: null,
          allocationTemplateName: null,
          paymentMethodId: null,
          isWithholdingTarget: false,
          withholdingTaxRate: null,
          withholdingTaxAmount: null,
          netPaymentAmount: null,
          sourceDataChanged: false,
          previousAmount: null,
          latestCalculatedAmount: null,
          alreadyGenerated: !!existing,
        });
      }
    }

    // === 売上: 月額費用 ===
    if (contract.monthlyFee > 0) {
      const revCategory = revenueCategoryMonthly ?? defaultRevenueCategory;
      if (revCategory) {
        const key = `crm-revenue-monthly-${contract.id}`;
        const existing = existingTransactions.find(
          (t) =>
            t.stpContractHistoryId === contract.id &&
            t.stpRevenueType === "monthly" &&
            t.type === "revenue"
        );

        candidates.push({
          key,
          source: "crm",
          type: "revenue",
          counterpartyId: counterparty.id,
          counterpartyName: counterparty.name,
          expenseCategoryId: revCategory.id,
          expenseCategoryName: revCategory.name,
          amount: contract.monthlyFee,
          taxAmount: calcTaxAmount(contract.monthlyFee, DEFAULT_TAX_TYPE, DEFAULT_TAX_RATE),
          taxRate: DEFAULT_TAX_RATE,
          taxType: DEFAULT_TAX_TYPE,
          periodFrom: periodFromStr,
          periodTo: periodToStr,
          note: `${contract.company.name} 月額費用`,
          contractId: null,
          contractTitle: null,
          stpContractHistoryId: contract.id,
          stpRevenueType: "monthly",
          stpExpenseType: null,
          stpCandidateId: null,
          stpAgentId: null,
          recurringTransactionId: null,
          costCenterId: stpCostCenter?.id ?? null,
          costCenterName: stpCostCenter?.name ?? null,
          allocationTemplateId: null,
          allocationTemplateName: null,
          paymentMethodId: null,
          isWithholdingTarget: false,
          withholdingTaxRate: null,
          withholdingTaxAmount: null,
          netPaymentAmount: null,
          sourceDataChanged: false,
          previousAmount: null,
          latestCalculatedAmount: null,
          alreadyGenerated: !!existing,
        });
      }
    }

    // === 経費: 代理店報酬 ===
    const stpCompany = await prisma.stpCompany.findFirst({
      where: { companyId: contract.companyId },
    });

    if (stpCompany?.agentId) {
      const agentContractHistory = await prisma.stpAgentContractHistory.findFirst({
        where: {
          agentId: stpCompany.agentId,
          contractStartDate: { lte: contract.contractStartDate },
          OR: [
            { contractEndDate: null },
            { contractEndDate: { gte: contract.contractStartDate } },
          ],
          deletedAt: null,
        },
        orderBy: { contractStartDate: "desc" },
        include: { agent: { include: { company: true } } },
      });

      if (agentContractHistory) {
        const agent = agentContractHistory.agent;
        const agentCounterparty = agent.companyId
          ? counterparties.find((c) => c.companyId === agent.companyId) ??
            (await prisma.counterparty.findFirst({
              where: { companyId: agent.companyId, deletedAt: null },
            }))
          : null;

        // 代理店取引先が無い場合は名前で作成/検索
        const agentCpId = agentCounterparty?.id;
        const agentCpName = agentCounterparty?.name ?? agent.company?.name ?? "不明な代理店";
        const expCategory = expenseCategoryOutsourcing ?? defaultExpenseCategory;

        if (expCategory && agentCpId) {
          const override = await prisma.stpAgentCommissionOverride.findFirst({
            where: {
              agentContractHistoryId: agentContractHistory.id,
              stpCompanyId: stpCompany.id,
            },
          });

          const commissionConfig = buildCommissionConfig(
            contract.contractPlan,
            agentContractHistory,
            override
          );

          const needsWithholding = agent && isWithholdingTarget(agent);

          const buildWh = (amount: number) => {
            if (!needsWithholding || amount <= 0)
              return {
                isWithholdingTarget: false,
                withholdingTaxRate: null as number | null,
                withholdingTaxAmount: null as number | null,
                netPaymentAmount: null as number | null,
              };
            const whTax = calcWithholdingTax(amount);
            return {
              isWithholdingTarget: true,
              withholdingTaxRate: amount <= 1_000_000 ? 10.21 : 20.42,
              withholdingTaxAmount: whTax,
              netPaymentAmount: amount - whTax,
            };
          };

          // 代理店初期費用
          if (
            (agentContractHistory.initialFee ?? 0) > 0 &&
            contractStart.getTime() === monthStart.getTime()
          ) {
            const amt = agentContractHistory.initialFee ?? 0;
            const key = `crm-expense-agent_initial-${contract.id}-${stpCompany.agentId}`;
            const existing = existingTransactions.find(
              (t) =>
                t.stpContractHistoryId === contract.id &&
                t.stpExpenseType === "agent_initial" &&
                t.type === "expense"
            );

            candidates.push({
              key,
              source: "crm",
              type: "expense",
              counterpartyId: agentCpId,
              counterpartyName: agentCpName,
              expenseCategoryId: expCategory.id,
              expenseCategoryName: expCategory.name,
              amount: amt,
              taxAmount: calcTaxAmount(amt, DEFAULT_TAX_TYPE, DEFAULT_TAX_RATE),
              taxRate: DEFAULT_TAX_RATE,
              taxType: DEFAULT_TAX_TYPE,
              periodFrom: periodFromStr,
              periodTo: periodFromStr,
              note: `${contract.company.name} 代理店初期費用 (${agentCpName})`,
              contractId: null,
              contractTitle: null,
              stpContractHistoryId: contract.id,
              stpRevenueType: null,
              stpExpenseType: "agent_initial",
              stpCandidateId: null,
              stpAgentId: stpCompany.agentId,
              recurringTransactionId: null,
              costCenterId: stpCostCenter?.id ?? null,
              costCenterName: stpCostCenter?.name ?? null,
              allocationTemplateId: null,
              allocationTemplateName: null,
              paymentMethodId: null,
              ...buildWh(amt),
              sourceDataChanged: false,
              previousAmount: null,
              latestCalculatedAmount: null,
              alreadyGenerated: !!existing,
            });
          }

          // 代理店月額費用
          if ((agentContractHistory.monthlyFee ?? 0) > 0) {
            const amt = agentContractHistory.monthlyFee ?? 0;
            const key = `crm-expense-agent_monthly-${contract.id}-${stpCompany.agentId}`;
            const existing = existingTransactions.find(
              (t) =>
                t.stpContractHistoryId === contract.id &&
                t.stpExpenseType === "agent_monthly" &&
                t.type === "expense"
            );

            candidates.push({
              key,
              source: "crm",
              type: "expense",
              counterpartyId: agentCpId,
              counterpartyName: agentCpName,
              expenseCategoryId: expCategory.id,
              expenseCategoryName: expCategory.name,
              amount: amt,
              taxAmount: calcTaxAmount(amt, DEFAULT_TAX_TYPE, DEFAULT_TAX_RATE),
              taxRate: DEFAULT_TAX_RATE,
              taxType: DEFAULT_TAX_TYPE,
              periodFrom: periodFromStr,
              periodTo: periodToStr,
              note: `${contract.company.name} 代理店月額費用 (${agentCpName})`,
              contractId: null,
              contractTitle: null,
              stpContractHistoryId: contract.id,
              stpRevenueType: null,
              stpExpenseType: "agent_monthly",
              stpCandidateId: null,
              stpAgentId: stpCompany.agentId,
              recurringTransactionId: null,
              costCenterId: stpCostCenter?.id ?? null,
              costCenterName: stpCostCenter?.name ?? null,
              allocationTemplateId: null,
              allocationTemplateName: null,
              paymentMethodId: null,
              ...buildWh(amt),
              sourceDataChanged: false,
              previousAmount: null,
              latestCalculatedAmount: null,
              alreadyGenerated: !!existing,
            });
          }

          // 初期費用紹介報酬
          if (
            contract.initialFee > 0 &&
            contractStart.getTime() === monthStart.getTime()
          ) {
            const rate = commissionConfig.initialRate ?? 0;
            const amt = Math.round((contract.initialFee * rate) / 100);
            if (amt > 0) {
              const key = `crm-expense-commission_initial-${contract.id}-${stpCompany.agentId}`;
              const existing = existingTransactions.find(
                (t) =>
                  t.stpContractHistoryId === contract.id &&
                  t.stpExpenseType === "commission_initial" &&
                  t.type === "expense"
              );

              candidates.push({
                key,
                source: "crm",
                type: "expense",
                counterpartyId: agentCpId,
                counterpartyName: agentCpName,
                expenseCategoryId: expCategory.id,
                expenseCategoryName: expCategory.name,
                amount: amt,
                taxAmount: calcTaxAmount(amt, DEFAULT_TAX_TYPE, DEFAULT_TAX_RATE),
                taxRate: DEFAULT_TAX_RATE,
                taxType: DEFAULT_TAX_TYPE,
                periodFrom: periodFromStr,
                periodTo: periodFromStr,
                note: `${contract.company.name} 初期紹介報酬 (${agentCpName})`,
                contractId: null,
                contractTitle: null,
                stpContractHistoryId: contract.id,
                stpRevenueType: null,
                stpExpenseType: "commission_initial",
                stpCandidateId: null,
                stpAgentId: stpCompany.agentId,
                recurringTransactionId: null,
                costCenterId: stpCostCenter?.id ?? null,
                costCenterName: stpCostCenter?.name ?? null,
                allocationTemplateId: null,
                allocationTemplateName: null,
                paymentMethodId: null,
                ...buildWh(amt),
                sourceDataChanged: false,
                previousAmount: null,
                latestCalculatedAmount: null,
                alreadyGenerated: !!existing,
              });
            }
          }

          // 月額紹介報酬
          if (
            contract.monthlyFee > 0 &&
            contract.contractPlan !== "performance"
          ) {
            const duration =
              commissionConfig.monthlyDuration ?? 12;
            const monthsFromStart = Math.floor(
              (monthStart.getTime() - contractStart.getTime()) /
                (1000 * 60 * 60 * 24 * 30)
            );
            if (monthsFromStart < duration) {
              const monthlyCommission = calcByType(
                contract.monthlyFee,
                commissionConfig.monthlyType,
                commissionConfig.monthlyRate,
                commissionConfig.monthlyFixed
              );

              if (monthlyCommission > 0) {
                const key = `crm-expense-commission_monthly-${contract.id}-${stpCompany.agentId}`;
                const existing = existingTransactions.find(
                  (t) =>
                    t.stpContractHistoryId === contract.id &&
                    t.stpExpenseType === "commission_monthly" &&
                    t.type === "expense"
                );

                candidates.push({
                  key,
                  source: "crm",
                  type: "expense",
                  counterpartyId: agentCpId,
                  counterpartyName: agentCpName,
                  expenseCategoryId: expCategory.id,
                  expenseCategoryName: expCategory.name,
                  amount: monthlyCommission,
                  taxAmount: calcTaxAmount(
                    monthlyCommission,
                    DEFAULT_TAX_TYPE,
                    DEFAULT_TAX_RATE
                  ),
                  taxRate: DEFAULT_TAX_RATE,
                  taxType: DEFAULT_TAX_TYPE,
                  periodFrom: periodFromStr,
                  periodTo: periodToStr,
                  note: `${contract.company.name} 月額紹介報酬 (${agentCpName})`,
                  contractId: null,
                  contractTitle: null,
                  stpContractHistoryId: contract.id,
                  stpRevenueType: null,
                  stpExpenseType: "commission_monthly",
                  stpCandidateId: null,
                  stpAgentId: stpCompany.agentId,
                  recurringTransactionId: null,
                  costCenterId: stpCostCenter?.id ?? null,
                  costCenterName: stpCostCenter?.name ?? null,
                  allocationTemplateId: null,
                  allocationTemplateName: null,
                  paymentMethodId: null,
                  ...buildWh(monthlyCommission),
                  sourceDataChanged: false,
                  previousAmount: null,
                  latestCalculatedAmount: null,
                  alreadyGenerated: !!existing,
                });
              }
            }
          }
        }
      }
    }
  }

  // === 成果報酬: 対象月に入社した求職者 ===
  const candidatesWithJoin = await prisma.stpCandidate.findMany({
    where: {
      joinDate: { gte: monthStart, lte: monthEnd },
    },
    include: {
      stpCompany: true,
    },
  });

  for (const candidate of candidatesWithJoin) {
    if (!candidate.stpCompanyId || !candidate.stpCompany) continue;

    const stpCompany = candidate.stpCompany;
    const company = await prisma.masterStellaCompany.findUnique({
      where: { id: stpCompany.companyId },
    });
    if (!company) continue;

    const counterparty = counterpartyByCompanyId.get(stpCompany.companyId);
    if (!counterparty) continue;

    // 入社日時点でアクティブな契約
    const matchingContracts = await prisma.stpContractHistory.findMany({
      where: {
        companyId: stpCompany.companyId,
        contractStartDate: { lte: candidate.joinDate! },
        OR: [
          { contractEndDate: null },
          { contractEndDate: { gte: candidate.joinDate! } },
        ],
        performanceFee: { gt: 0 },
        status: "active",
        deletedAt: null,
        ...(candidate.industryType ? { industryType: candidate.industryType } : {}),
        ...(candidate.jobMedia ? { jobMedia: candidate.jobMedia } : {}),
      },
      orderBy: { contractStartDate: "desc" },
    });

    if (matchingContracts.length !== 1) continue;
    const contractHistory = matchingContracts[0];

    const revCategory = revenueCategoryPerformance ?? defaultRevenueCategory;
    if (!revCategory) continue;

    const periodStr = formatDate(monthStart);

    // 売上: 成果報酬
    const key = `crm-revenue-performance-${contractHistory.id}-${candidate.id}`;
    const existingPerf = existingTransactions.find(
      (t) =>
        t.stpContractHistoryId === contractHistory.id &&
        t.stpRevenueType === "performance" &&
        t.stpCandidateId === candidate.id &&
        t.type === "revenue"
    );

    candidates.push({
      key,
      source: "crm",
      type: "revenue",
      counterpartyId: counterparty.id,
      counterpartyName: counterparty.name,
      expenseCategoryId: revCategory.id,
      expenseCategoryName: revCategory.name,
      amount: contractHistory.performanceFee,
      taxAmount: calcTaxAmount(
        contractHistory.performanceFee,
        "tax_included",
        10
      ),
      taxRate: 10,
      taxType: "tax_included",
      periodFrom: periodStr,
      periodTo: periodStr,
      note: `${company.name} 成果報酬 (${candidate.lastName}${candidate.firstName})`,
      contractId: null,
      contractTitle: null,
      stpContractHistoryId: contractHistory.id,
      stpRevenueType: "performance",
      stpExpenseType: null,
      stpCandidateId: candidate.id,
      stpAgentId: null,
      recurringTransactionId: null,
      costCenterId: stpCostCenter?.id ?? null,
      costCenterName: stpCostCenter?.name ?? null,
      allocationTemplateId: null,
      allocationTemplateName: null,
      paymentMethodId: null,
      isWithholdingTarget: false,
      withholdingTaxRate: null,
      withholdingTaxAmount: null,
      netPaymentAmount: null,
      sourceDataChanged: false,
      previousAmount: null,
      latestCalculatedAmount: null,
      alreadyGenerated: !!existingPerf,
    });
  }
}

// ============================================
// 定期取引ベースの候補検出
// ============================================

async function detectRecurringCandidates(
  candidates: TransactionCandidate[],
  monthStart: Date,
  monthEnd: Date
) {
  const periodFromStr = formatDate(monthStart);
  const periodToStr = formatDate(monthEnd);

  // 対象月に有効な定期取引を取得
  const recurringTxs = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
    },
    include: {
      counterparty: true,
      expenseCategory: true,
      costCenter: true,
      allocationTemplate: true,
    },
  });

  // 既存のTransactionレコード取得（重複チェック用）
  const recurringIds = recurringTxs.map((r) => r.id);
  const existingTransactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      periodFrom: { gte: monthStart, lte: monthEnd },
      recurringTransactionId: { in: recurringIds },
    },
  });

  for (const rt of recurringTxs) {
    // 頻度チェック
    if (!isRecurringActiveForMonth(rt, monthStart)) continue;

    const key = `recurring-${rt.type}-${rt.id}`;
    const existing = existingTransactions.find(
      (t) => t.recurringTransactionId === rt.id
    );

    const amount = rt.amountType === "fixed" ? rt.amount : null;
    const taxAmount =
      amount != null
        ? calcTaxAmount(amount, "tax_included", rt.taxRate)
        : null;

    candidates.push({
      key,
      source: "recurring",
      type: rt.type as "revenue" | "expense",
      counterpartyId: rt.counterpartyId,
      counterpartyName: rt.counterparty.name,
      expenseCategoryId: rt.expenseCategoryId,
      expenseCategoryName: rt.expenseCategory.name,
      amount,
      taxAmount,
      taxRate: rt.taxRate,
      taxType: "tax_included",
      periodFrom: periodFromStr,
      periodTo: periodToStr,
      note: rt.name + (rt.note ? ` - ${rt.note}` : ""),
      contractId: null,
      contractTitle: null,
      stpContractHistoryId: null,
      stpRevenueType: null,
      stpExpenseType: null,
      stpCandidateId: null,
      stpAgentId: null,
      recurringTransactionId: rt.id,
      costCenterId: rt.costCenterId,
      costCenterName: rt.costCenter?.name ?? null,
      allocationTemplateId: rt.allocationTemplateId,
      allocationTemplateName: rt.allocationTemplate?.name ?? null,
      paymentMethodId: rt.paymentMethodId,
      isWithholdingTarget: false,
      withholdingTaxRate: null,
      withholdingTaxAmount: null,
      netPaymentAmount: null,
      sourceDataChanged: false,
      previousAmount: null,
      latestCalculatedAmount: null,
      alreadyGenerated: !!existing,
    });
  }
}

/**
 * 定期取引が対象月にアクティブかどうかをチェック
 */
function isRecurringActiveForMonth(
  rt: { frequency: string; executionDay: number | null; startDate: Date; endDate: Date | null },
  monthStart: Date
): boolean {
  if (rt.frequency === "monthly") return true;

  if (rt.frequency === "yearly") {
    // startDate の月と対象月が一致するかチェック
    return rt.startDate.getUTCMonth() === monthStart.getUTCMonth();
  }

  if (rt.frequency === "weekly") {
    // 週次: 対象月に少なくとも1回は実行日がある
    return true;
  }

  return false;
}

// ============================================
// 2. generateTransactions
// ============================================

/**
 * 選択された候補から取引レコードを一括生成する
 */
export async function generateTransactions(
  selectedCandidates: TransactionCandidate[]
): Promise<{ created: number; skipped: number }> {
  const session = await getSession();
  const staffId = session.id;

  let created = 0;
  let skipped = 0;

  for (const candidate of selectedCandidates) {
    if (candidate.alreadyGenerated) {
      skipped++;
      continue;
    }

    // 金額がnullの場合（変動金額）は0で作成し、後で手動入力してもらう
    const amount = candidate.amount ?? 0;
    const taxAmount = candidate.taxAmount ?? 0;

    await prisma.transaction.create({
      data: {
        type: candidate.type,
        counterpartyId: candidate.counterpartyId,
        expenseCategoryId: candidate.expenseCategoryId,
        amount,
        taxAmount,
        taxRate: candidate.taxRate,
        taxType: candidate.taxType,
        periodFrom: new Date(candidate.periodFrom),
        periodTo: new Date(candidate.periodTo),
        note: candidate.note,
        costCenterId: candidate.costCenterId,
        allocationTemplateId: candidate.allocationTemplateId,
        paymentMethodId: candidate.paymentMethodId,
        contractId: candidate.contractId,
        recurringTransactionId: candidate.recurringTransactionId,
        stpContractHistoryId: candidate.stpContractHistoryId,
        stpRevenueType: candidate.stpRevenueType,
        stpExpenseType: candidate.stpExpenseType,
        stpCandidateId: candidate.stpCandidateId,
        stpAgentId: candidate.stpAgentId,
        isAutoGenerated: true,
        sourceType: candidate.source === "crm" ? "crm" : "recurring",
        isWithholdingTarget: candidate.isWithholdingTarget,
        withholdingTaxRate: candidate.withholdingTaxRate
          ? Number(candidate.withholdingTaxRate)
          : null,
        withholdingTaxAmount: candidate.withholdingTaxAmount,
        netPaymentAmount: candidate.netPaymentAmount,
        status: "unconfirmed",
        createdBy: staffId,
      },
    });

    created++;
  }

  revalidatePath("/stp/finance/generate");
  revalidatePath("/stp/finance/transactions");

  return { created, skipped };
}
