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
import { createHash } from "crypto";
import { z } from "zod";
import {
  recordChangeLog,
  extractChanges,
  pickRecordData,
  type ChangeLogEntry,
} from "@/app/accounting/changelog/actions";
import { CANDIDATE_DECISION_LOG_FIELDS } from "@/app/accounting/changelog/log-fields";
import { getSystemProjectContext } from "@/lib/project-context";
import { toLocalDateString } from "@/lib/utils";

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
  /** プロジェクト */
  projectId: number | null;
  /** ソースデータ変更アラート */
  sourceDataChanged: boolean;
  previousAmount: number | null;
  latestCalculatedAmount: number | null;
  /** 既に同月に取引レコードが存在するか */
  alreadyGenerated: boolean;
  /** 既存TransactionのID（変更検出時の更新用） */
  existingTransactionId: number | null;
  /** Phase 2: 候補判定 */
  decisionStatus: "pending" | "converted" | "held" | "dismissed" | null;
  decisionReasonType: string | null;
  decisionMemo: string | null;
  decisionNeedsReview: boolean;
  currentFingerprint: string | null;
  /** Phase 3: 変動金額オーバーライド */
  overrideAmount: number | null;
  overrideTaxAmount: number | null;
  overrideTaxRate: number | null;
  overrideMemo: string | null;
  overrideScheduledPaymentDate: string | null;
};

// ============================================
// ユーティリティ
// ============================================

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const formatDate = (date: Date): string => toLocalDateString(date);

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
// フィンガープリント計算
// ============================================

function computeFingerprint(candidate: {
  amount: number | null;
  counterpartyId: number;
  expenseCategoryId: number;
  taxRate: number;
}): string {
  const data = JSON.stringify({
    a: candidate.amount,
    c: candidate.counterpartyId,
    e: candidate.expenseCategoryId,
    t: candidate.taxRate,
  });
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

// ============================================
// バリデーション
// ============================================

const targetMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const candidateKeySchema = z.string().min(1).max(200);

function isSTPCandidateKey(key: string): boolean {
  return key.startsWith("crm-") || key.startsWith("recurring-");
}

export type ActionResult = {
  success: boolean;
  error?: string;
};

// ============================================
// ChangeLog ヘルパー
// ============================================

type DecisionRecord = {
  id: number;
  [key: string]: unknown;
};

async function recordDecisionChangeLog(
  existing: DecisionRecord | null,
  updated: DecisionRecord,
  staffId: number
) {
  const fields = [...CANDIDATE_DECISION_LOG_FIELDS];
  if (existing) {
    const oldData = await pickRecordData(
      existing as unknown as Record<string, unknown>,
      fields
    );
    const newData = await pickRecordData(
      updated as unknown as Record<string, unknown>,
      fields
    );
    const changes = await extractChanges(oldData, newData, fields);
    if (changes) {
      await recordChangeLog(
        {
          tableName: "TransactionCandidateDecision",
          recordId: updated.id,
          changeType: "update",
          oldData: changes.oldData,
          newData: changes.newData,
        },
        staffId
      );
    }
  } else {
    await recordChangeLog(
      {
        tableName: "TransactionCandidateDecision",
        recordId: updated.id,
        changeType: "create",
        newData: await pickRecordData(
          updated as unknown as Record<string, unknown>,
          fields
        ),
      },
      staffId
    );
  }
}

const overrideValuesSchema = z.object({
  amount: z.number().int().min(1).optional(),
  taxAmount: z.number().int().min(0).optional(),
  taxRate: z.number().int().min(0).max(100).optional(),
  memo: z.string().max(500).optional(),
  scheduledPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

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

  // --- Phase 2: Decision テーブルとの統合 ---
  const targetMonthKey = targetMonth; // "YYYY-MM"
  const decisions = await prisma.transactionCandidateDecision.findMany({
    where: { targetMonth: targetMonthKey },
  });
  const decisionMap = new Map(
    decisions.map((d) => [d.candidateKey, d])
  );

  for (const c of candidates) {
    const fp = computeFingerprint(c);
    c.currentFingerprint = fp;

    const decision = decisionMap.get(c.key);
    if (!decision) continue;

    c.decisionStatus = decision.status as typeof c.decisionStatus;
    c.decisionReasonType = decision.reasonType;
    c.decisionMemo = decision.memo;
    c.decisionNeedsReview = decision.needsReview;

    // フィンガープリント変更 → needsReview
    if (
      decision.sourceFingerprint &&
      decision.sourceFingerprint !== fp &&
      decision.status !== "converted"
    ) {
      c.decisionNeedsReview = true;
    }

    // Override 値のマージ
    c.overrideAmount = decision.overrideAmount;
    c.overrideTaxAmount = decision.overrideTaxAmount;
    c.overrideTaxRate = decision.overrideTaxRate;
    c.overrideMemo = decision.overrideMemo;
    c.overrideScheduledPaymentDate = decision.overrideScheduledPaymentDate
      ? toLocalDateString(decision.overrideScheduledPaymentDate)
      : null;
  }

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

  // 既存のTransactionレコードを取得（重複チェック + ソースデータ変更検出用）
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

  // STPプロジェクト & CostCenter（SystemProjectBinding経由）
  const stpCtx = await getSystemProjectContext("stp");
  const stpProjectId = stpCtx?.projectId ?? null;
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

  // --- minor-1: N+1クエリ解消のための一括取得 ---

  // StpCompany（companyId → StpCompany）
  const stpCompanies = await prisma.stpCompany.findMany({
    where: { companyId: { in: companyIds } },
  });
  const stpCompanyByCompanyId = new Map(
    stpCompanies.map((s) => [s.companyId, s])
  );

  // 代理店IDの収集
  const agentIds = [
    ...new Set(
      stpCompanies.filter((s) => s.agentId != null).map((s) => s.agentId!)
    ),
  ];

  // AgentContractHistory（全代理店分を一括取得）
  const allAgentContractHistories =
    agentIds.length > 0
      ? await prisma.stpAgentContractHistory.findMany({
          where: {
            agentId: { in: agentIds },
            deletedAt: null,
          },
          orderBy: { contractStartDate: "desc" },
          include: { agent: { include: { company: true } } },
        })
      : [];

  // 代理店の取引先を一括取得（メインのcounterpartyByCompanyIdに未登録のもの）
  const agentCompanyIds = [
    ...new Set(
      allAgentContractHistories
        .map((h) => h.agent.companyId)
        .filter((id): id is number => id != null)
    ),
  ];
  const missingAgentCompanyIds = agentCompanyIds.filter(
    (id) => !counterpartyByCompanyId.has(id)
  );
  if (missingAgentCompanyIds.length > 0) {
    const agentCounterparties = await prisma.counterparty.findMany({
      where: {
        companyId: { in: missingAgentCompanyIds },
        deletedAt: null,
      },
    });
    for (const cp of agentCounterparties) {
      if (cp.companyId != null && !counterpartyByCompanyId.has(cp.companyId)) {
        counterpartyByCompanyId.set(cp.companyId, cp);
      }
    }
  }

  // CommissionOverride（全組み合わせを一括取得）
  const agentContractHistoryIds = allAgentContractHistories.map((h) => h.id);
  const stpCompanyIds = stpCompanies.map((s) => s.id);
  const allCommissionOverrides =
    agentContractHistoryIds.length > 0 && stpCompanyIds.length > 0
      ? await prisma.stpAgentCommissionOverride.findMany({
          where: {
            agentContractHistoryId: { in: agentContractHistoryIds },
            stpCompanyId: { in: stpCompanyIds },
          },
        })
      : [];
  const overrideMap = new Map(
    allCommissionOverrides.map((o) => [
      `${o.agentContractHistoryId}-${o.stpCompanyId}`,
      o,
    ])
  );

  // ソースデータ変更検出用ヘルパー
  const detectSourceChange = (
    existing: (typeof existingTransactions)[number] | undefined,
    currentAmount: number
  ) => {
    if (existing && existing.amount !== currentAmount) {
      return {
        sourceDataChanged: true,
        previousAmount: existing.amount,
        latestCalculatedAmount: currentAmount,
        existingTransactionId: existing.id,
      };
    }
    return {
      sourceDataChanged: false,
      previousAmount: null as number | null,
      latestCalculatedAmount: null as number | null,
      existingTransactionId: existing?.id ?? null,
    };
  };

  // --- メインループ ---

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
        const changeInfo = detectSourceChange(existing, contract.initialFee);

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
          projectId: stpProjectId,
          ...changeInfo,
          alreadyGenerated: !!existing,
          decisionStatus: null,
          decisionReasonType: null,
          decisionMemo: null,
          decisionNeedsReview: false,
          currentFingerprint: null,
          overrideAmount: null,
          overrideTaxAmount: null,
          overrideTaxRate: null,
          overrideMemo: null,
          overrideScheduledPaymentDate: null,
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
        const changeInfo = detectSourceChange(existing, contract.monthlyFee);

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
          projectId: stpProjectId,
          ...changeInfo,
          alreadyGenerated: !!existing,
          decisionStatus: null,
          decisionReasonType: null,
          decisionMemo: null,
          decisionNeedsReview: false,
          currentFingerprint: null,
          overrideAmount: null,
          overrideTaxAmount: null,
          overrideTaxRate: null,
          overrideMemo: null,
          overrideScheduledPaymentDate: null,
        });
      }
    }

    // === 経費: 代理店報酬 ===
    const stpCompany = stpCompanyByCompanyId.get(contract.companyId);

    if (stpCompany?.agentId) {
      // 契約開始日時点でアクティブな代理店契約を検索（一括取得済みデータから）
      const agentContractHistory = allAgentContractHistories.find(
        (h) =>
          h.agentId === stpCompany.agentId &&
          h.contractStartDate <= contract.contractStartDate &&
          (h.contractEndDate == null ||
            h.contractEndDate >= contract.contractStartDate)
      );

      if (agentContractHistory) {
        const agent = agentContractHistory.agent;
        const agentCounterparty = agent.companyId
          ? counterpartyByCompanyId.get(agent.companyId) ?? null
          : null;

        const agentCpId = agentCounterparty?.id;
        const agentCpName = agentCounterparty?.name ?? agent.company?.name ?? "不明な代理店";
        const expCategory = expenseCategoryOutsourcing ?? defaultExpenseCategory;

        if (expCategory && agentCpId) {
          const override =
            overrideMap.get(
              `${agentContractHistory.id}-${stpCompany.id}`
            ) ?? null;

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
            const changeInfo = detectSourceChange(existing, amt);

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
              projectId: stpProjectId,
              ...changeInfo,
              alreadyGenerated: !!existing,
              decisionStatus: null,
              decisionReasonType: null,
              decisionMemo: null,
              decisionNeedsReview: false,
              currentFingerprint: null,
              overrideAmount: null,
              overrideTaxAmount: null,
              overrideTaxRate: null,
              overrideMemo: null,
              overrideScheduledPaymentDate: null,
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
            const changeInfo = detectSourceChange(existing, amt);

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
              projectId: stpProjectId,
              ...changeInfo,
              alreadyGenerated: !!existing,
              decisionStatus: null,
              decisionReasonType: null,
              decisionMemo: null,
              decisionNeedsReview: false,
              currentFingerprint: null,
              overrideAmount: null,
              overrideTaxAmount: null,
              overrideTaxRate: null,
              overrideMemo: null,
              overrideScheduledPaymentDate: null,
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
              const changeInfo = detectSourceChange(existing, amt);

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
                projectId: stpProjectId,
                ...changeInfo,
                alreadyGenerated: !!existing,
                decisionStatus: null,
                decisionReasonType: null,
                decisionMemo: null,
                decisionNeedsReview: false,
                currentFingerprint: null,
                overrideAmount: null,
                overrideTaxAmount: null,
                overrideTaxRate: null,
                overrideMemo: null,
                overrideScheduledPaymentDate: null,
              });
            }
          }

          // 月額紹介報酬
          if (
            contract.monthlyFee > 0 &&
            contract.contractPlan !== "performance"
          ) {
            const duration = commissionConfig.monthlyDuration ?? 12;
            // minor-2: 正確な月数差分計算
            const monthsFromStart =
              (monthStart.getUTCFullYear() - contractStart.getUTCFullYear()) * 12 +
              (monthStart.getUTCMonth() - contractStart.getUTCMonth());
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
                const changeInfo = detectSourceChange(existing, monthlyCommission);

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
                  projectId: stpProjectId,
                  ...changeInfo,
                  alreadyGenerated: !!existing,
                  decisionStatus: null,
                  decisionReasonType: null,
                  decisionMemo: null,
                  decisionNeedsReview: false,
                  currentFingerprint: null,
                  overrideAmount: null,
                  overrideTaxAmount: null,
                  overrideTaxRate: null,
                  overrideMemo: null,
                  overrideScheduledPaymentDate: null,
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

    const stpCompanyForCandidate = candidate.stpCompany;
    const company = await prisma.masterStellaCompany.findUnique({
      where: { id: stpCompanyForCandidate.companyId },
    });
    if (!company) continue;

    const counterparty = counterpartyByCompanyId.get(stpCompanyForCandidate.companyId);
    if (!counterparty) continue;

    // 入社日時点でアクティブな契約
    const matchingContracts = await prisma.stpContractHistory.findMany({
      where: {
        companyId: stpCompanyForCandidate.companyId,
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
    const perfChangeInfo = detectSourceChange(
      existingPerf,
      contractHistory.performanceFee
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
      projectId: stpProjectId,
      ...perfChangeInfo,
      alreadyGenerated: !!existingPerf,
      decisionStatus: null,
      decisionReasonType: null,
      decisionMemo: null,
      decisionNeedsReview: false,
      currentFingerprint: null,
      overrideAmount: null,
      overrideTaxAmount: null,
      overrideTaxRate: null,
      overrideMemo: null,
      overrideScheduledPaymentDate: null,
    });

    // minor-3: 成果報酬に対応する代理店紹介報酬（commission_performance）
    if (stpCompanyForCandidate.agentId) {
      const agentContractHistory = allAgentContractHistories.find(
        (h) =>
          h.agentId === stpCompanyForCandidate.agentId &&
          h.contractStartDate <= contractHistory.contractStartDate &&
          (h.contractEndDate == null ||
            h.contractEndDate >= contractHistory.contractStartDate)
      );

      if (agentContractHistory) {
        const agent = agentContractHistory.agent;
        const agentCounterparty = agent.companyId
          ? counterpartyByCompanyId.get(agent.companyId) ?? null
          : null;
        const agentCpId = agentCounterparty?.id;
        const agentCpName =
          agentCounterparty?.name ?? agent.company?.name ?? "不明な代理店";
        const expCategory = expenseCategoryOutsourcing ?? defaultExpenseCategory;

        if (expCategory && agentCpId) {
          const override =
            overrideMap.get(
              `${agentContractHistory.id}-${stpCompanyForCandidate.id}`
            ) ?? null;

          const commissionConfig = buildCommissionConfig(
            contractHistory.contractPlan,
            agentContractHistory,
            override
          );

          const perfCommission = calcByType(
            contractHistory.performanceFee,
            commissionConfig.perfType,
            commissionConfig.perfRate,
            commissionConfig.perfFixed
          );

          if (perfCommission > 0) {
            const needsWithholding = agent && isWithholdingTarget(agent);
            const whData = (() => {
              if (!needsWithholding || perfCommission <= 0)
                return {
                  isWithholdingTarget: false,
                  withholdingTaxRate: null as number | null,
                  withholdingTaxAmount: null as number | null,
                  netPaymentAmount: null as number | null,
                };
              const whTax = calcWithholdingTax(perfCommission);
              return {
                isWithholdingTarget: true,
                withholdingTaxRate:
                  perfCommission <= 1_000_000 ? 10.21 : 20.42,
                withholdingTaxAmount: whTax,
                netPaymentAmount: perfCommission - whTax,
              };
            })();

            const commKey = `crm-expense-commission_performance-${contractHistory.id}-${candidate.id}-${stpCompanyForCandidate.agentId}`;
            const existingComm = existingTransactions.find(
              (t) =>
                t.stpContractHistoryId === contractHistory.id &&
                t.stpExpenseType === "commission_performance" &&
                t.stpCandidateId === candidate.id &&
                t.type === "expense"
            );
            const commChangeInfo = detectSourceChange(
              existingComm,
              perfCommission
            );

            candidates.push({
              key: commKey,
              source: "crm",
              type: "expense",
              counterpartyId: agentCpId,
              counterpartyName: agentCpName,
              expenseCategoryId: expCategory.id,
              expenseCategoryName: expCategory.name,
              amount: perfCommission,
              taxAmount: calcTaxAmount(
                perfCommission,
                DEFAULT_TAX_TYPE,
                DEFAULT_TAX_RATE
              ),
              taxRate: DEFAULT_TAX_RATE,
              taxType: DEFAULT_TAX_TYPE,
              periodFrom: periodStr,
              periodTo: periodStr,
              note: `${company.name} 成果紹介報酬 (${candidate.lastName}${candidate.firstName}) (${agentCpName})`,
              contractId: null,
              contractTitle: null,
              stpContractHistoryId: contractHistory.id,
              stpRevenueType: null,
              stpExpenseType: "commission_performance",
              stpCandidateId: candidate.id,
              stpAgentId: stpCompanyForCandidate.agentId,
              recurringTransactionId: null,
              costCenterId: stpCostCenter?.id ?? null,
              costCenterName: stpCostCenter?.name ?? null,
              allocationTemplateId: null,
              allocationTemplateName: null,
              paymentMethodId: null,
              ...whData,
              projectId: stpProjectId,
              ...commChangeInfo,
              alreadyGenerated: !!existingComm,
              decisionStatus: null,
              decisionReasonType: null,
              decisionMemo: null,
              decisionNeedsReview: false,
              currentFingerprint: null,
              overrideAmount: null,
              overrideTaxAmount: null,
              overrideTaxRate: null,
              overrideMemo: null,
              overrideScheduledPaymentDate: null,
            });
          }
        }
      }
    }
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

    // 定期取引の変更検出: 固定金額の場合のみ比較
    const sourceDataChanged =
      existing != null && amount != null && existing.amount !== amount;

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
      projectId: null,
      sourceDataChanged,
      previousAmount: sourceDataChanged ? existing!.amount : null,
      latestCalculatedAmount: sourceDataChanged ? amount : null,
      alreadyGenerated: !!existing,
      existingTransactionId: existing?.id ?? null,
      decisionStatus: null,
      decisionReasonType: null,
      decisionMemo: null,
      decisionNeedsReview: false,
      currentFingerprint: null,
      overrideAmount: null,
      overrideTaxAmount: null,
      overrideTaxRate: null,
      overrideMemo: null,
      overrideScheduledPaymentDate: null,
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
): Promise<{ created: number; skipped: number; updated: number; skippedNoAmount: number }> {
  const session = await getSession();
  const staffId = session.id;

  const UPDATABLE_STATUSES = ["unconfirmed", "confirmed"];

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let skippedNoAmount = 0;

  for (const candidate of selectedCandidates) {
    // overrideAmount があれば優先、なければ候補の自動計算値
    const effectiveAmount =
      candidate.overrideAmount ?? candidate.amount ?? null;
    if (effectiveAmount === null) {
      skippedNoAmount++;
      continue;
    }
    const effectiveTaxAmount =
      candidate.taxAmount ??
      (candidate.overrideTaxAmount != null
        ? candidate.overrideTaxAmount
        : calcTaxAmount(effectiveAmount, candidate.taxType, candidate.taxRate));

    // ソースデータ変更あり → 既存Transactionを更新
    if (
      candidate.alreadyGenerated &&
      candidate.sourceDataChanged &&
      candidate.existingTransactionId
    ) {
      const existing = await prisma.transaction.findUnique({
        where: { id: candidate.existingTransactionId },
        select: { status: true },
      });
      if (!existing || !UPDATABLE_STATUSES.includes(existing.status)) {
        skipped++;
        continue;
      }

      await prisma.transaction.update({
        where: { id: candidate.existingTransactionId },
        data: {
          amount: effectiveAmount,
          taxAmount: effectiveTaxAmount,
          ...(candidate.isWithholdingTarget
            ? {
                withholdingTaxAmount: candidate.withholdingTaxAmount,
                netPaymentAmount: candidate.netPaymentAmount,
              }
            : {}),
          sourceDataChangedAt: new Date(),
          latestCalculatedAmount: effectiveAmount,
          updatedBy: staffId,
        },
      });
      updated++;
      continue;
    }

    // 既に生成済み（変更なし）→ スキップ
    if (candidate.alreadyGenerated) {
      skipped++;
      continue;
    }

    // 新規生成
    const scheduledPaymentDate = candidate.overrideScheduledPaymentDate
      ? new Date(candidate.overrideScheduledPaymentDate)
      : null;

    await prisma.transaction.create({
      data: {
        type: candidate.type,
        counterpartyId: candidate.counterpartyId,
        expenseCategoryId: candidate.expenseCategoryId,
        amount: effectiveAmount,
        taxAmount: effectiveTaxAmount,
        taxRate: candidate.overrideTaxRate ?? candidate.taxRate,
        taxType: candidate.taxType,
        periodFrom: new Date(candidate.periodFrom),
        periodTo: new Date(candidate.periodTo),
        note: candidate.overrideMemo ?? candidate.note,
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
        projectId: candidate.projectId,
        isAutoGenerated: true,
        sourceType: candidate.source === "crm" ? "crm" : "recurring",
        isWithholdingTarget: candidate.isWithholdingTarget,
        withholdingTaxRate: candidate.withholdingTaxRate
          ? Number(candidate.withholdingTaxRate)
          : null,
        withholdingTaxAmount: candidate.withholdingTaxAmount,
        netPaymentAmount: candidate.netPaymentAmount,
        scheduledPaymentDate,
        status: "unconfirmed",
        createdBy: staffId,
      },
    });

    // Decision を converted に更新
    const targetMonth = candidate.periodFrom.slice(0, 7);
    const existingDecision = await prisma.transactionCandidateDecision.findUnique({
      where: {
        candidateKey_targetMonth: {
          candidateKey: candidate.key,
          targetMonth,
        },
      },
    });
    const decisionResult = await prisma.transactionCandidateDecision.upsert({
      where: {
        candidateKey_targetMonth: {
          candidateKey: candidate.key,
          targetMonth,
        },
      },
      create: {
        candidateKey: candidate.key,
        targetMonth,
        status: "converted",
        sourceFingerprint: candidate.currentFingerprint,
        decidedBy: staffId,
        decidedAt: new Date(),
      },
      update: {
        status: "converted",
        sourceFingerprint: candidate.currentFingerprint,
        decidedBy: staffId,
        decidedAt: new Date(),
      },
    });
    await recordDecisionChangeLog(existingDecision, decisionResult, staffId);

    created++;
  }

  revalidatePath("/stp/finance/generate");
  revalidatePath("/stp/finance/transactions");

  return { created, skipped, updated, skippedNoAmount };
}

// ============================================
// 3. 候補判定アクション（Phase 2）
// ============================================

export async function decideCandidateAction(
  candidateKey: string,
  targetMonth: string,
  status: "held" | "dismissed",
  reasonType?: string,
  memo?: string
): Promise<ActionResult> {
  const session = await getSession();

  const keyResult = candidateKeySchema.safeParse(candidateKey);
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!keyResult.success || !monthResult.success) {
    return { success: false, error: "無効な入力値です" };
  }
  if (!isSTPCandidateKey(candidateKey)) {
    return { success: false, error: "無効な候補キーです" };
  }

  const existing = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });

  const result = await prisma.transactionCandidateDecision.upsert({
    where: {
      candidateKey_targetMonth: { candidateKey, targetMonth },
    },
    create: {
      candidateKey,
      targetMonth,
      status,
      reasonType: reasonType ?? null,
      memo: memo ?? null,
      decidedBy: session.id,
      decidedAt: new Date(),
    },
    update: {
      status,
      reasonType: reasonType ?? null,
      memo: memo ?? null,
      needsReview: false,
      decidedBy: session.id,
      decidedAt: new Date(),
    },
  });

  await recordDecisionChangeLog(existing, result, session.id);

  revalidatePath("/stp/finance/generate");
  return { success: true };
}

export async function convertHeldCandidate(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult> {
  const session = await getSession();

  const keyResult = candidateKeySchema.safeParse(candidateKey);
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!keyResult.success || !monthResult.success) {
    return { success: false, error: "無効な入力値です" };
  }

  const decision = await prisma.transactionCandidateDecision.findUnique({
    where: {
      candidateKey_targetMonth: { candidateKey, targetMonth },
    },
  });

  if (!decision || decision.status !== "held") {
    return { success: false, error: "保留状態の候補が見つかりません" };
  }

  // 変動金額候補の場合、overrideAmount が必要
  const isVariableAmount = candidateKey.includes("recurring-");
  if (isVariableAmount && !decision.overrideAmount) {
    return { success: false, error: "変動金額候補は金額を入力してから取引化してください" };
  }

  const result = await prisma.transactionCandidateDecision.update({
    where: { id: decision.id },
    data: {
      status: "pending",
      needsReview: false,
      decidedBy: session.id,
      decidedAt: new Date(),
    },
  });

  await recordDecisionChangeLog(decision, result, session.id);

  revalidatePath("/stp/finance/generate");
  return { success: true };
}

export async function reviveDismissedCandidate(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult> {
  const session = await getSession();

  const keyResult = candidateKeySchema.safeParse(candidateKey);
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!keyResult.success || !monthResult.success) {
    return { success: false, error: "無効な入力値です" };
  }

  const decision = await prisma.transactionCandidateDecision.findUnique({
    where: {
      candidateKey_targetMonth: { candidateKey, targetMonth },
    },
  });

  if (!decision || decision.status !== "dismissed") {
    return { success: false, error: "不要状態の候補が見つかりません" };
  }

  const result = await prisma.transactionCandidateDecision.update({
    where: { id: decision.id },
    data: {
      status: "held",
      needsReview: false,
      decidedBy: session.id,
      decidedAt: new Date(),
    },
  });

  await recordDecisionChangeLog(decision, result, session.id);

  revalidatePath("/stp/finance/generate");
  return { success: true };
}

export async function acknowledgeReview(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult> {
  const session = await getSession();

  const keyResult = candidateKeySchema.safeParse(candidateKey);
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!keyResult.success || !monthResult.success) {
    return { success: false, error: "無効な入力値です" };
  }

  const existing = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });

  if (existing && existing.needsReview) {
    const result = await prisma.transactionCandidateDecision.update({
      where: { id: existing.id },
      data: { needsReview: false },
    });
    await recordDecisionChangeLog(existing, result, session.id);
  }

  revalidatePath("/stp/finance/generate");
  return { success: true };
}

// ============================================
// 4. 変動金額オーバーライド保存（Phase 3）
// ============================================

export async function saveOverrideValues(
  candidateKey: string,
  targetMonth: string,
  values: {
    amount?: number;
    taxAmount?: number;
    taxRate?: number;
    memo?: string;
    scheduledPaymentDate?: string;
  }
): Promise<ActionResult> {
  const session = await getSession();

  const keyResult = candidateKeySchema.safeParse(candidateKey);
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!keyResult.success || !monthResult.success) {
    return { success: false, error: "無効な入力値です" };
  }

  const parsed = overrideValuesSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "入力値が不正です: " + parsed.error.message };
  }

  const v = parsed.data;

  const existing = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });

  const result = await prisma.transactionCandidateDecision.upsert({
    where: {
      candidateKey_targetMonth: { candidateKey, targetMonth },
    },
    create: {
      candidateKey,
      targetMonth,
      status: "pending",
      overrideAmount: v.amount ?? null,
      overrideTaxAmount: v.taxAmount ?? null,
      overrideTaxRate: v.taxRate ?? null,
      overrideMemo: v.memo ?? null,
      overrideScheduledPaymentDate: v.scheduledPaymentDate
        ? new Date(v.scheduledPaymentDate)
        : null,
      decidedBy: session.id,
      decidedAt: new Date(),
    },
    update: {
      ...(v.amount !== undefined ? { overrideAmount: v.amount } : {}),
      overrideTaxAmount: v.taxAmount ?? null,
      overrideTaxRate: v.taxRate ?? null,
      overrideMemo: v.memo ?? null,
      overrideScheduledPaymentDate: v.scheduledPaymentDate
        ? new Date(v.scheduledPaymentDate)
        : null,
      decidedBy: session.id,
      decidedAt: new Date(),
    },
  });

  await recordDecisionChangeLog(existing, result, session.id);

  revalidatePath("/stp/finance/generate");
  return { success: true };
}

// ============================================
// 5. 候補判定の変更履歴取得
// ============================================

export type CandidateDecisionLog = {
  id: number;
  changeType: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedBy: number;
  changedAt: string;
  changerName: string;
};

export async function getCandidateDecisionLogs(
  candidateKey: string,
  targetMonth: string
): Promise<CandidateDecisionLog[]> {
  await getSession();

  const decision = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });
  if (!decision) return [];

  const logs = await prisma.changeLog.findMany({
    where: {
      tableName: "TransactionCandidateDecision",
      recordId: decision.id,
    },
    include: {
      changer: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    changeType: log.changeType,
    oldData: log.oldData as Record<string, unknown> | null,
    newData: log.newData as Record<string, unknown> | null,
    changedBy: log.changedBy,
    changedAt: log.changedAt.toISOString(),
    changerName: log.changer.name,
  }));
}
