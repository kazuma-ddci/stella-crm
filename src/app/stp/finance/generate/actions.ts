"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  calcTaxAmount,
} from "@/lib/finance/auto-generate";
import { getSystemProjectContext } from "@/lib/project-context";
import {
  calcWithholdingTax,
  isWithholdingTarget,
} from "@/lib/finance/withholding-tax";
import { createHash } from "crypto";
import { z } from "zod";

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
  /** 候補判定情報（TransactionCandidateDecision から取得） */
  decisionStatus: "pending" | "converted" | "held" | "dismissed" | null;
  decisionReasonType: string | null;
  decisionMemo: string | null;
  decisionNeedsReview: boolean;
  /** フィンガープリント（ソース変更検知用） */
  currentFingerprint: string | null;
  /** override値（TransactionCandidateDecision から取得、Phase 3） */
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

// ============================================
// バリデーション
// ============================================

const targetMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
  message: "対象月は YYYY-MM 形式で指定してください",
});

const candidateKeySchema = z.string().min(1).max(200);

// STP候補キーのフォーマット検証
function isSTPCandidateKey(key: string): boolean {
  return (
    key.startsWith("crm-revenue-") ||
    key.startsWith("crm-expense-") ||
    key.startsWith("recurring-")
  );
}

// ============================================
// フィンガープリント
// ============================================

/**
 * 候補のソースデータからフィンガープリント（SHA-256ハッシュ）を計算する。
 * ソース変更検知（needsReview）に使用。
 */
function computeFingerprint(candidate: TransactionCandidate): string {
  const parts: Record<string, unknown> = {};

  if (candidate.source === "crm") {
    parts.stpContractHistoryId = candidate.stpContractHistoryId;
    parts.counterpartyId = candidate.counterpartyId;
    parts.amount = candidate.amount;
    parts.taxType = candidate.taxType;
    parts.taxRate = candidate.taxRate;
    parts.periodFrom = candidate.periodFrom;
    parts.periodTo = candidate.periodTo;
    parts.stpRevenueType = candidate.stpRevenueType;
    parts.stpExpenseType = candidate.stpExpenseType;
    parts.stpCandidateId = candidate.stpCandidateId;
    parts.stpAgentId = candidate.stpAgentId;
  } else {
    // recurring
    parts.recurringTransactionId = candidate.recurringTransactionId;
    parts.counterpartyId = candidate.counterpartyId;
    parts.amount = candidate.amount;
    parts.taxType = candidate.taxType;
    parts.taxRate = candidate.taxRate;
    parts.periodFrom = candidate.periodFrom;
    parts.periodTo = candidate.periodTo;
  }

  const json = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(json).digest("hex");
}

// ============================================
// ActionResult 型
// ============================================

type ActionResult = {
  success: boolean;
  error?: string;
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

  // --- 判定結果の統合（N+1防止: 一括取得 → Map合流） ---
  if (candidates.length > 0) {
    const decisions = await prisma.transactionCandidateDecision.findMany({
      where: {
        candidateKey: { in: candidates.map((c) => c.key) },
        targetMonth,
      },
    });
    const decisionMap = new Map(
      decisions.map((d) => [`${d.candidateKey}::${d.targetMonth}`, d])
    );

    for (const candidate of candidates) {
      const decision = decisionMap.get(`${candidate.key}::${targetMonth}`);
      const fp = computeFingerprint(candidate);
      candidate.currentFingerprint = fp;

      if (decision) {
        candidate.decisionStatus = decision.status as typeof candidate.decisionStatus;
        candidate.decisionReasonType = decision.reasonType;
        candidate.decisionMemo = decision.memo;
        // override値の統合
        candidate.overrideAmount = decision.overrideAmount;
        candidate.overrideTaxAmount = decision.overrideTaxAmount;
        candidate.overrideTaxRate = decision.overrideTaxRate;
        candidate.overrideMemo = decision.overrideMemo;
        candidate.overrideScheduledPaymentDate = decision.overrideScheduledPaymentDate
          ? decision.overrideScheduledPaymentDate.toISOString().split("T")[0]
          : null;
        // ソース変更検知: フィンガープリント比較
        if (
          decision.sourceFingerprint &&
          decision.sourceFingerprint !== fp &&
          decision.status !== "converted"
        ) {
          candidate.decisionNeedsReview = true;
          // needsReview を DB にもセット（非同期、結果は待たない）
          prisma.transactionCandidateDecision
            .update({
              where: { id: decision.id },
              data: { needsReview: true },
            })
            .catch(() => {});
        } else {
          candidate.decisionNeedsReview = decision.needsReview;
        }
      } else {
        candidate.decisionStatus = null;
        candidate.decisionReasonType = null;
        candidate.decisionMemo = null;
        candidate.decisionNeedsReview = false;
      }
    }
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

  // STPプロジェクト & CostCenter
  const stpCtx = await getSystemProjectContext("stp");
  const stpProjectId = stpCtx.projectId;
  const stpCostCenterRecord = stpCtx.costCenterIds[0]
    ? await prisma.costCenter.findUnique({
        where: { id: stpCtx.costCenterIds[0] },
        select: { id: true, name: true },
      })
    : null;
  const stpCostCenter = stpCostCenterRecord;

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
 * 変動金額候補（amount=null）は overrideAmount が必須。未入力はスキップ。
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
    // ソースデータ変更あり → 既存Transactionを更新
    if (
      candidate.alreadyGenerated &&
      candidate.sourceDataChanged &&
      candidate.existingTransactionId
    ) {
      // ステータスチェック: 仕訳済み以降は更新不可
      const existing = await prisma.transaction.findUnique({
        where: { id: candidate.existingTransactionId },
        select: { status: true },
      });
      if (!existing || !UPDATABLE_STATUSES.includes(existing.status)) {
        skipped++;
        continue;
      }

      const amount = candidate.amount ?? candidate.overrideAmount;
      if (amount == null || amount <= 0) {
        skippedNoAmount++;
        continue;
      }
      const taxAmount = candidate.taxAmount ?? candidate.overrideTaxAmount ?? 0;
      await prisma.transaction.update({
        where: { id: candidate.existingTransactionId },
        data: {
          amount,
          taxAmount,
          ...(candidate.isWithholdingTarget
            ? {
                withholdingTaxAmount: candidate.withholdingTaxAmount,
                netPaymentAmount: candidate.netPaymentAmount,
              }
            : {}),
          sourceDataChangedAt: new Date(),
          latestCalculatedAmount: amount,
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

    // 変動金額候補: override値を適用、未入力ならスキップ
    let amount: number;
    let taxAmount: number;
    let note = candidate.note;
    let scheduledPaymentDate: Date | null = null;

    if (candidate.amount === null) {
      // 変動金額: overrideAmount 必須
      if (candidate.overrideAmount == null || candidate.overrideAmount <= 0) {
        skippedNoAmount++;
        continue;
      }
      amount = candidate.overrideAmount;
      taxAmount = candidate.overrideTaxAmount ??
        calcTaxAmount(amount, candidate.taxType, candidate.overrideTaxRate ?? candidate.taxRate);
      if (candidate.overrideMemo) {
        note = note ? `${note} / ${candidate.overrideMemo}` : candidate.overrideMemo;
      }
      if (candidate.overrideScheduledPaymentDate) {
        scheduledPaymentDate = new Date(candidate.overrideScheduledPaymentDate);
      }
    } else {
      amount = candidate.amount;
      taxAmount = candidate.taxAmount ?? 0;
    }

    await prisma.transaction.create({
      data: {
        type: candidate.type,
        counterpartyId: candidate.counterpartyId,
        expenseCategoryId: candidate.expenseCategoryId,
        amount,
        taxAmount,
        taxRate: candidate.overrideTaxRate ?? candidate.taxRate,
        taxType: candidate.taxType,
        periodFrom: new Date(candidate.periodFrom),
        periodTo: new Date(candidate.periodTo),
        note,
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

    // 取引化成功: decision を converted に更新
    await prisma.transactionCandidateDecision.upsert({
      where: {
        candidateKey_targetMonth: {
          candidateKey: candidate.key,
          targetMonth: candidate.periodFrom.slice(0, 7),
        },
      },
      create: {
        candidateKey: candidate.key,
        targetMonth: candidate.periodFrom.slice(0, 7),
        status: "converted",
        decidedBy: staffId,
        decidedAt: new Date(),
        sourceFingerprint: candidate.currentFingerprint,
      },
      update: {
        status: "converted",
        decidedBy: staffId,
        decidedAt: new Date(),
        sourceFingerprint: candidate.currentFingerprint,
      },
    });

    created++;
  }

  revalidatePath("/stp/finance/generate");
  revalidatePath("/stp/finance/transactions");

  return { created, skipped, updated, skippedNoAmount };
}

// ============================================
// 3. 候補判定アクション（Phase 2）
// ============================================

/**
 * 候補判定を保存（保留 / 不要）
 * ステータス・理由の変更のみ。override値には触れない。
 */
export async function decideCandidateAction(
  candidateKey: string,
  targetMonth: string,
  status: "held" | "dismissed",
  reasonType?: string,
  memo?: string
): Promise<ActionResult> {
  const session = await getSession();

  // バリデーション
  const keyResult = candidateKeySchema.safeParse(candidateKey);
  if (!keyResult.success) return { success: false, error: "候補キーが不正です" };
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!monthResult.success) return { success: false, error: monthResult.error.issues[0].message };
  if (!isSTPCandidateKey(candidateKey)) return { success: false, error: "STP候補キーの形式ではありません" };

  try {
    await prisma.transactionCandidateDecision.upsert({
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
        decidedBy: session.id,
        decidedAt: new Date(),
      },
    });

    revalidatePath("/stp/finance/generate");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "判定の保存に失敗しました" };
  }
}

/**
 * 保留→取引化（判定を converted に更新してから取引作成）
 * 既存の generateTransactions() 内の STP固定化ロジックを通す
 */
export async function convertHeldCandidate(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult> {
  await getSession();

  // バリデーション
  const keyResult = candidateKeySchema.safeParse(candidateKey);
  if (!keyResult.success) return { success: false, error: "候補キーが不正です" };
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!monthResult.success) return { success: false, error: monthResult.error.issues[0].message };
  if (!isSTPCandidateKey(candidateKey)) return { success: false, error: "STP候補キーの形式ではありません" };

  // 既存 decision を確認
  const decision = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });

  if (!decision) return { success: false, error: "判定レコードが見つかりません" };
  if (decision.status === "converted") return { success: false, error: "既に取引化済みです" };
  if (decision.status !== "held") return { success: false, error: "保留状態の候補のみ取引化できます" };

  // 候補を再検出して該当キーの候補を取得
  const candidates = await detectTransactionCandidates(targetMonth);
  const candidate = candidates.find((c) => c.key === candidateKey);
  if (!candidate) return { success: false, error: "候補が見つかりませんでした" };
  if (candidate.alreadyGenerated) return { success: false, error: "既に取引が存在します" };

  // 変動金額候補のoverride未入力チェック
  if (candidate.amount === null && (candidate.overrideAmount == null || candidate.overrideAmount <= 0)) {
    return { success: false, error: "変動金額候補は金額を入力してから取引化してください" };
  }

  // generateTransactions で取引化（STP固定化ロジックを通す）
  const result = await generateTransactions([candidate]);

  if (result.created > 0) {
    // decision を converted に更新
    await prisma.transactionCandidateDecision.update({
      where: { id: decision.id },
      data: {
        status: "converted",
        decidedAt: new Date(),
        sourceFingerprint: candidate.currentFingerprint,
      },
    });
    revalidatePath("/stp/finance/generate");
    return { success: true };
  }

  return { success: false, error: "取引化に失敗しました" };
}

/**
 * 不要→保留に戻す
 */
export async function reviveDismissedCandidate(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult> {
  const session = await getSession();

  // バリデーション
  const keyResult = candidateKeySchema.safeParse(candidateKey);
  if (!keyResult.success) return { success: false, error: "候補キーが不正です" };
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!monthResult.success) return { success: false, error: monthResult.error.issues[0].message };
  if (!isSTPCandidateKey(candidateKey)) return { success: false, error: "STP候補キーの形式ではありません" };

  const decision = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });

  if (!decision) return { success: false, error: "判定レコードが見つかりません" };
  if (decision.status !== "dismissed") return { success: false, error: "不要状態の候補のみ復帰できます" };

  try {
    await prisma.transactionCandidateDecision.update({
      where: { id: decision.id },
      data: {
        status: "held",
        reasonType: null,
        memo: null,
        decidedBy: session.id,
        decidedAt: new Date(),
      },
    });

    revalidatePath("/stp/finance/generate");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "復帰に失敗しました" };
  }
}

/**
 * needsReview を確認済みにする
 * フィンガープリントはサーバー側で現行ソースから再計算して保存
 */
export async function acknowledgeReview(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult> {
  await getSession();

  // バリデーション
  const keyResult = candidateKeySchema.safeParse(candidateKey);
  if (!keyResult.success) return { success: false, error: "候補キーが不正です" };
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!monthResult.success) return { success: false, error: monthResult.error.issues[0].message };
  if (!isSTPCandidateKey(candidateKey)) return { success: false, error: "STP候補キーの形式ではありません" };

  const decision = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });

  if (!decision) return { success: false, error: "判定レコードが見つかりません" };

  // 候補を再検出してフィンガープリントをサーバー側で再計算
  const candidates = await detectTransactionCandidates(targetMonth);
  const candidate = candidates.find((c) => c.key === candidateKey);
  const newFingerprint = candidate ? computeFingerprint(candidate) : null;

  try {
    await prisma.transactionCandidateDecision.update({
      where: { id: decision.id },
      data: {
        needsReview: false,
        sourceFingerprint: newFingerprint,
      },
    });

    revalidatePath("/stp/finance/generate");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "確認に失敗しました" };
  }
}

// ============================================
// 4. override値の永続化（Phase 3）
// ============================================

const overrideValuesSchema = z.object({
  amount: z.number().int().min(1, "金額は1円以上で入力してください"),
  taxAmount: z.number().int().min(0).optional(),
  taxRate: z.union([z.literal(10), z.literal(8), z.literal(0)]).optional(),
  scheduledPaymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください")
    .optional()
    .nullable(),
  memo: z.string().max(1000).optional().nullable(),
});

/**
 * override値の保存（金額・税額・税率・予定日・メモ）
 * status が pending/held の場合のみ実行可能。converted/dismissed は拒否。
 */
export async function saveOverrideValues(
  candidateKey: string,
  targetMonth: string,
  values: {
    amount: number;
    taxAmount?: number;
    taxRate?: number;
    scheduledPaymentDate?: string | null;
    memo?: string | null;
  }
): Promise<ActionResult> {
  await getSession();

  // バリデーション
  const keyResult = candidateKeySchema.safeParse(candidateKey);
  if (!keyResult.success) return { success: false, error: "候補キーが不正です" };
  const monthResult = targetMonthSchema.safeParse(targetMonth);
  if (!monthResult.success)
    return { success: false, error: monthResult.error.issues[0].message };
  if (!isSTPCandidateKey(candidateKey))
    return { success: false, error: "STP候補キーの形式ではありません" };

  const valuesResult = overrideValuesSchema.safeParse(values);
  if (!valuesResult.success)
    return {
      success: false,
      error: valuesResult.error.issues[0].message,
    };

  // 既存 decision を確認（ステータスチェック）
  const decision = await prisma.transactionCandidateDecision.findUnique({
    where: { candidateKey_targetMonth: { candidateKey, targetMonth } },
  });

  if (decision) {
    if (decision.status === "converted")
      return {
        success: false,
        error:
          "取引化済みの候補の金額は変更できません。取引管理画面で編集してください。",
      };
    if (decision.status === "dismissed")
      return {
        success: false,
        error: "不要判定された候補に金額を設定することはできません。",
      };
  }

  // 税額の計算: 税額が明示的に指定されていなければ tax_included ベースで自動計算
  const taxRate = values.taxRate ?? 10;
  const taxAmount =
    values.taxAmount ?? calcTaxAmount(values.amount, "tax_included", taxRate);

  try {
    await prisma.transactionCandidateDecision.upsert({
      where: {
        candidateKey_targetMonth: { candidateKey, targetMonth },
      },
      create: {
        candidateKey,
        targetMonth,
        status: "pending",
        overrideAmount: values.amount,
        overrideTaxAmount: taxAmount,
        overrideTaxRate: taxRate,
        overrideMemo: values.memo ?? null,
        overrideScheduledPaymentDate: values.scheduledPaymentDate
          ? new Date(values.scheduledPaymentDate)
          : null,
      },
      update: {
        overrideAmount: values.amount,
        overrideTaxAmount: taxAmount,
        overrideTaxRate: taxRate,
        overrideMemo: values.memo ?? null,
        overrideScheduledPaymentDate: values.scheduledPaymentDate
          ? new Date(values.scheduledPaymentDate)
          : null,
      },
    });

    revalidatePath("/stp/finance/generate");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "保存に失敗しました",
    };
  }
}
