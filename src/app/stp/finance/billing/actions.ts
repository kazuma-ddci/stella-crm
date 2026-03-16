"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getSystemProjectContext } from "@/lib/project-context";
import {
  addBusinessDays,
  calculateProratedFee,
  getDaysInMonth,
} from "@/lib/business-days";

// ============================================
// 型定義
// ============================================

export type LifecycleStatus =
  | "not_created"
  | "unconfirmed"
  | "confirmed"
  | "in_invoice_draft"
  | "pdf_created"
  | "sent"
  | "received"
  | "overdue";

export type BillingLifecycleItem = {
  id: string;
  feeType: "initial" | "monthly" | "performance";
  companyName: string;
  stpCompanyId: number;
  contractHistoryId: number;

  amount: number;
  periodFrom: string;
  periodTo: string;
  description: string;

  status: LifecycleStatus;
  transactionId: number | null;
  invoiceGroupId: number | null;
  invoiceGroupStatus: string | null;

  expectedInvoiceDate: string | null;
  expectedPaymentDeadline: string | null;
  paymentDueDate: string | null;
  isOverdue: boolean;

  candidateId: number | null;
  candidateName: string | null;
};

export type BillingLifecycleData = {
  targetMonth: string;
  items: BillingLifecycleItem[];
  summary: {
    notCreated: number;
    unconfirmed: number;
    confirmed: number;
    inInvoiceDraft: number;
    pdfCreated: number;
    sent: number;
    received: number;
    overdue: number;
  };
};

export type BillingItemInput = {
  contractHistoryId: number;
  feeType: "initial" | "monthly" | "performance";
  amount: number;
  periodFrom: string;
  periodTo: string;
  candidateId?: number;
  paymentDueDate?: string;
};

// ============================================
// ユーティリティ
// ============================================

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function endOfMonth(year: number, month: number): Date {
  const daysInMonth = getDaysInMonth(year, month);
  return new Date(Date.UTC(year, month - 1, daysInMonth));
}

/**
 * 支払期限の計算
 * 締め日ベースの場合: 締め日の翌月(offset)のpaymentDay日
 */
function calculatePaymentDeadlineFromClosing(
  closingDay: number,
  paymentMonthOffset: number,
  paymentDay: number,
  baseDate: Date
): Date {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth(); // 0-based

  // 支払月 = 基準月 + offset
  let payYear = year;
  let payMonth = month + paymentMonthOffset; // 0-based
  if (payMonth > 11) {
    payYear += Math.floor(payMonth / 12);
    payMonth = payMonth % 12;
  }

  // paymentDay: 0=末日
  let day: number;
  if (paymentDay === 0) {
    day = getDaysInMonth(payYear, payMonth + 1); // getDaysInMonth expects 1-based month
  } else {
    const maxDay = getDaysInMonth(payYear, payMonth + 1);
    day = Math.min(paymentDay, maxDay);
  }

  return new Date(Date.UTC(payYear, payMonth, day));
}

// ============================================
// メイン: 請求ライフサイクルデータ取得
// ============================================

export async function getBillingLifecycleData(
  targetMonth: string
): Promise<BillingLifecycleData> {
  await getSession();

  const [yearStr, monthStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthStart = startOfMonth(year, month);
  const monthEnd = endOfMonth(year, month);

  // STPプロジェクト取得
  const stpCtx = await getSystemProjectContext("stp");
  const stpProjectId = stpCtx?.projectId ?? null;

  // 請求ルール取得
  const billingRules = await prisma.stpBillingRule.findMany({
    where: stpProjectId ? { projectId: stpProjectId } : {},
  });
  const ruleByFeeType = new Map(billingRules.map((r) => [r.feeType, r]));

  const items: BillingLifecycleItem[] = [];

  // ============================================
  // 1. 初期費用
  // ============================================
  const initialContracts = await prisma.stpContractHistory.findMany({
    where: {
      status: "active",
      deletedAt: null,
      initialFee: { gt: 0 },
      contractDate: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    include: {
      company: {
        include: {
          stpCompanies: { take: 1 },
        },
      },
    },
  });

  for (const contract of initialContracts) {
    const contractDate = contract.contractDate!;
    const periodFrom = formatDate(contractDate);
    const periodTo = formatDate(contractDate);

    // 請求予定日・支払期限計算
    const rule = ruleByFeeType.get("initial");
    let expectedInvoiceDate: string | null = null;
    let expectedPaymentDeadline: string | null = null;

    if (rule) {
      if (rule.invoiceBusinessDays != null) {
        const invoiceDate = addBusinessDays(contractDate, rule.invoiceBusinessDays);
        expectedInvoiceDate = formatDate(invoiceDate);

        if (rule.paymentBusinessDays != null) {
          const paymentDate = addBusinessDays(invoiceDate, rule.paymentBusinessDays);
          expectedPaymentDeadline = formatDate(paymentDate);
        }
      }
    }

    // 企業個別設定チェック
    const company = contract.company;
    if (
      company.closingDay != null &&
      company.paymentMonthOffset != null &&
      company.paymentDay != null
    ) {
      expectedPaymentDeadline = formatDate(
        calculatePaymentDeadlineFromClosing(
          company.closingDay,
          company.paymentMonthOffset,
          company.paymentDay,
          contractDate
        )
      );
    }

    const stpCompanyId = company.stpCompanies[0]?.id ?? 0;

    items.push({
      id: `initial-${contract.id}`,
      feeType: "initial",
      companyName: company.name,
      stpCompanyId,
      contractHistoryId: contract.id,
      amount: contract.initialFee,
      periodFrom,
      periodTo,
      description: `初期費用 ${contract.initialFee.toLocaleString()}円`,
      status: "not_created", // 後で更新
      transactionId: null,
      invoiceGroupId: null,
      invoiceGroupStatus: null,
      expectedInvoiceDate,
      expectedPaymentDeadline,
      paymentDueDate: null,
      isOverdue: false,
      candidateId: null,
      candidateName: null,
    });
  }

  // ============================================
  // 2. 月額
  // ============================================
  const monthlyContracts = await prisma.stpContractHistory.findMany({
    where: {
      status: "active",
      deletedAt: null,
      monthlyFee: { gt: 0 },
      contractStartDate: { lte: monthEnd },
      OR: [
        { contractEndDate: null },
        { contractEndDate: { gte: monthStart } },
      ],
    },
    include: {
      company: {
        include: {
          stpCompanies: { take: 1 },
        },
      },
    },
  });

  for (const contract of monthlyContracts) {
    const contractStartDate = contract.contractStartDate;
    const contractStartMonth =
      contractStartDate.getUTCFullYear() * 100 + (contractStartDate.getUTCMonth() + 1);
    const targetMonthNum = year * 100 + month;
    const isFirstMonth = contractStartMonth === targetMonthNum;

    let amount = contract.monthlyFee;
    let periodFromDate = monthStart;

    if (isFirstMonth && contractStartDate.getUTCDate() > 1) {
      // 初月日割り
      const totalDays = getDaysInMonth(year, month);
      amount = calculateProratedFee(
        contract.monthlyFee,
        contractStartDate.getUTCDate(),
        totalDays
      );
      periodFromDate = contractStartDate;
    }

    const periodFrom = formatDate(periodFromDate);
    const periodTo = formatDate(monthEnd);

    // 支払期限計算
    const rule = ruleByFeeType.get("monthly");
    const expectedInvoiceDate: string | null = null;
    let expectedPaymentDeadline: string | null = null;

    const company = contract.company;
    const closingDay = company.closingDay ?? rule?.closingDay ?? null;
    const paymentMonthOffset = company.paymentMonthOffset ?? rule?.paymentMonthOffset ?? null;
    const paymentDay = company.paymentDay ?? rule?.paymentDay ?? null;

    if (closingDay != null && paymentMonthOffset != null && paymentDay != null) {
      expectedPaymentDeadline = formatDate(
        calculatePaymentDeadlineFromClosing(closingDay, paymentMonthOffset, paymentDay, monthEnd)
      );
    }

    const stpCompanyId = company.stpCompanies[0]?.id ?? 0;

    items.push({
      id: `monthly-${contract.id}-${targetMonth}`,
      feeType: "monthly",
      companyName: company.name,
      stpCompanyId,
      contractHistoryId: contract.id,
      amount,
      periodFrom,
      periodTo,
      description: `月額 ${amount.toLocaleString()}円${isFirstMonth && contractStartDate.getUTCDate() > 1 ? "（日割り）" : ""}`,
      status: "not_created",
      transactionId: null,
      invoiceGroupId: null,
      invoiceGroupStatus: null,
      expectedInvoiceDate,
      expectedPaymentDeadline,
      paymentDueDate: null,
      isOverdue: false,
      candidateId: null,
      candidateName: null,
    });
  }

  // ============================================
  // 3. 成果報酬
  // ============================================
  const candidates = await prisma.stpCandidate.findMany({
    where: {
      deletedAt: null,
      joinDate: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    include: {
      stpCompany: {
        include: {
          company: {
            include: {
              stpCompanies: { take: 1 },
            },
          },
        },
      },
    },
  });

  for (const candidate of candidates) {
    const stpCompany = candidate.stpCompany;
    const company = stpCompany.company;
    const companyId = stpCompany.companyId;

    // 入社日時点でアクティブな契約を検索
    const matchingContracts = await prisma.stpContractHistory.findMany({
      where: {
        companyId,
        status: "active",
        deletedAt: null,
        performanceFee: { gt: 0 },
        contractStartDate: { lte: candidate.joinDate! },
        OR: [
          { contractEndDate: null },
          { contractEndDate: { gte: candidate.joinDate! } },
        ],
      },
    });

    if (matchingContracts.length !== 1) continue;

    const contractHistory = matchingContracts[0];
    const amount = contractHistory.performanceFee;
    const periodFrom = formatDate(startOfMonth(year, month));
    const periodTo = formatDate(endOfMonth(year, month));

    const candidateName = `${candidate.lastName}${candidate.firstName}`;

    // 支払期限計算
    const rule = ruleByFeeType.get("performance");
    let expectedPaymentDeadline: string | null = null;

    const closingDay = company.closingDay ?? rule?.closingDay ?? null;
    const paymentMonthOffset = company.paymentMonthOffset ?? rule?.paymentMonthOffset ?? null;
    const paymentDay = company.paymentDay ?? rule?.paymentDay ?? null;

    if (closingDay != null && paymentMonthOffset != null && paymentDay != null) {
      expectedPaymentDeadline = formatDate(
        calculatePaymentDeadlineFromClosing(closingDay, paymentMonthOffset, paymentDay, monthEnd)
      );
    }

    const stpCompanyId = stpCompany.id;

    items.push({
      id: `performance-${contractHistory.id}-${candidate.id}`,
      feeType: "performance",
      companyName: company.name,
      stpCompanyId,
      contractHistoryId: contractHistory.id,
      amount,
      periodFrom,
      periodTo,
      description: `成果報酬 ${candidateName} ${amount.toLocaleString()}円`,
      status: "not_created",
      transactionId: null,
      invoiceGroupId: null,
      invoiceGroupStatus: null,
      expectedInvoiceDate: null,
      expectedPaymentDeadline,
      paymentDueDate: null,
      isOverdue: false,
      candidateId: candidate.id,
      candidateName,
    });
  }

  // ============================================
  // 4. 既存Transactionとのマッチング
  // ============================================
  const contractHistoryIds = [...new Set(items.map((i) => i.contractHistoryId))];

  if (contractHistoryIds.length > 0) {
    const existingTransactions = await prisma.transaction.findMany({
      where: {
        stpContractHistoryId: { in: contractHistoryIds },
        type: "revenue",
        deletedAt: null,
        periodFrom: { gte: monthStart, lte: monthEnd },
      },
      include: {
        invoiceGroup: true,
      },
    });

    const now = new Date();

    for (const item of items) {
      // マッチングロジック
      const matchingTx = existingTransactions.find((tx) => {
        if (tx.stpContractHistoryId !== item.contractHistoryId) return false;
        if (tx.stpRevenueType !== item.feeType) return false;
        if (item.feeType === "performance" && tx.stpCandidateId !== item.candidateId) return false;
        return true;
      });

      if (!matchingTx) continue;

      item.transactionId = matchingTx.id;
      item.paymentDueDate = matchingTx.paymentDueDate
        ? formatDate(matchingTx.paymentDueDate)
        : null;

      // ステータス判定
      if (matchingTx.status === "unconfirmed") {
        item.status = "unconfirmed";
      } else if (
        (matchingTx.status === "confirmed" ||
          matchingTx.status === "awaiting_accounting" ||
          matchingTx.status === "returned" ||
          matchingTx.status === "resubmitted") &&
        matchingTx.invoiceGroupId == null
      ) {
        item.status = "confirmed";
      } else if (matchingTx.invoiceGroupId != null && matchingTx.invoiceGroup) {
        const ig = matchingTx.invoiceGroup;
        item.invoiceGroupId = ig.id;
        item.invoiceGroupStatus = ig.status;

        switch (ig.status) {
          case "draft":
            item.status = "in_invoice_draft";
            break;
          case "pdf_created":
            item.status = "pdf_created";
            break;
          case "sent":
          case "partially_received": {
            const dueDate = ig.paymentDueDate ?? matchingTx.paymentDueDate;
            if (dueDate && new Date(dueDate) < now) {
              item.status = "overdue";
              item.isOverdue = true;
            } else {
              item.status = "sent";
            }
            break;
          }
          case "fully_received":
          case "completed":
            item.status = "received";
            break;
          default:
            item.status = "confirmed";
        }
      } else {
        // confirmed but has invoiceGroupId without invoiceGroup loaded
        item.status = "confirmed";
      }
    }
  }

  // ============================================
  // 5. サマリー計算
  // ============================================
  const summary = {
    notCreated: 0,
    unconfirmed: 0,
    confirmed: 0,
    inInvoiceDraft: 0,
    pdfCreated: 0,
    sent: 0,
    received: 0,
    overdue: 0,
  };

  for (const item of items) {
    switch (item.status) {
      case "not_created":
        summary.notCreated++;
        break;
      case "unconfirmed":
        summary.unconfirmed++;
        break;
      case "confirmed":
        summary.confirmed++;
        break;
      case "in_invoice_draft":
        summary.inInvoiceDraft++;
        break;
      case "pdf_created":
        summary.pdfCreated++;
        break;
      case "sent":
        summary.sent++;
        break;
      case "received":
        summary.received++;
        break;
      case "overdue":
        summary.overdue++;
        break;
    }
  }

  return {
    targetMonth,
    items,
    summary,
  };
}

// ============================================
// 取引化
// ============================================

export async function createTransactionFromBilling(
  item: BillingItemInput
): Promise<{ transactionId: number }> {
  const session = await getSession();
  const staffId = session.id;

  const stpCtx = await getSystemProjectContext("stp");
  const stpProjectId = stpCtx?.projectId ?? null;

  // 契約履歴から企業情報を取得
  const contractHistory = await prisma.stpContractHistory.findUnique({
    where: { id: item.contractHistoryId },
    include: {
      company: true,
    },
  });

  if (!contractHistory) {
    throw new Error("契約履歴が見つかりません");
  }

  // Counterparty取得（companyId経由）
  const counterparty = await prisma.counterparty.findFirst({
    where: {
      companyId: contractHistory.companyId,
      deletedAt: null,
    },
  });

  if (!counterparty) {
    throw new Error(
      `取引先が見つかりません（企業: ${contractHistory.company.name}）。先に取引先マスタに登録してください。`
    );
  }

  // 費目取得
  const expenseCategories = await prisma.expenseCategory.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(stpProjectId ? { projectId: stpProjectId } : {}),
    },
  });

  let expenseCategory = null;
  if (item.feeType === "initial") {
    expenseCategory = expenseCategories.find(
      (c) => c.type !== "expense" && c.name.includes("初期")
    );
  } else if (item.feeType === "monthly") {
    expenseCategory = expenseCategories.find(
      (c) => c.type !== "expense" && c.name.includes("月額")
    );
  } else if (item.feeType === "performance") {
    expenseCategory = expenseCategories.find(
      (c) => c.type !== "expense" && c.name.includes("成果")
    );
  }

  // 備考
  const feeTypeLabel =
    item.feeType === "initial"
      ? "初期費用"
      : item.feeType === "monthly"
        ? "月額"
        : "成果報酬";
  const note = `${contractHistory.company.name} ${feeTypeLabel}`;

  const taxRate = 10;
  // 契約金額は税込で入力されている → 内税計算
  const taxAmount = Math.floor((item.amount * taxRate) / (100 + taxRate));

  const transaction = await prisma.transaction.create({
    data: {
      type: "revenue",
      counterpartyId: counterparty.id,
      projectId: stpProjectId,
      expenseCategoryId: expenseCategory?.id ?? null,
      amount: item.amount,
      taxAmount,
      taxRate,
      taxType: "tax_included",
      periodFrom: new Date(item.periodFrom),
      periodTo: new Date(item.periodTo),
      paymentDueDate: item.paymentDueDate ? new Date(item.paymentDueDate) : null,
      status: "unconfirmed",
      isAutoGenerated: true,
      sourceType: "crm",
      stpContractHistoryId: item.contractHistoryId,
      stpRevenueType: item.feeType,
      stpCandidateId: item.candidateId ?? null,
      note,
      createdBy: staffId,
    },
  });

  revalidatePath("/stp/finance/billing");
  revalidatePath("/stp/finance/transactions");

  return { transactionId: transaction.id };
}

// ============================================
// 一括取引化
// ============================================

export async function bulkCreateTransactionsFromBilling(
  items: BillingItemInput[]
): Promise<{ created: number }> {
  let created = 0;
  for (const item of items) {
    try {
      await createTransactionFromBilling(item);
      created++;
    } catch {
      // エラーがあってもスキップして続行
      console.error(`取引化失敗: contractHistoryId=${item.contractHistoryId}, feeType=${item.feeType}`);
    }
  }

  revalidatePath("/stp/finance/billing");
  revalidatePath("/stp/finance/transactions");

  return { created };
}

// ============================================
// 経費ライフサイクル 型定義
// ============================================

export type ExpenseLifecycleStatus =
  | "pending"
  | "approved"
  | "unconfirmed"
  | "confirmed"
  | "in_payment_group"
  | "invoice_received"
  | "paid"
  | "overdue";

export type ExpenseLifecycleItem = {
  id: string;
  expenseRecordId: number;
  expenseType: string;
  agentName: string;
  agentId: number;
  companyName: string | null;
  stpCompanyId: number | null;
  contractHistoryId: number | null;

  amount: number;
  netPaymentAmount: number | null;
  withholdingTaxAmount: number | null;
  targetMonth: string;
  description: string;

  appliedCommissionRate: number | null;
  appliedCommissionType: string | null;

  status: ExpenseLifecycleStatus;
  transactionId: number | null;
  paymentGroupId: number | null;
  paymentGroupStatus: string | null;

  paymentDueDate: string | null;
  isOverdue: boolean;

  candidateName: string | null;
};

export type ExpenseLifecycleData = {
  targetMonth: string;
  items: ExpenseLifecycleItem[];
  summary: {
    pending: number;
    approved: number;
    unconfirmed: number;
    confirmed: number;
    inPaymentGroup: number;
    invoiceReceived: number;
    paid: number;
    overdue: number;
  };
};

// ============================================
// 経費ライフサイクルデータ取得
// ============================================

export async function getExpenseLifecycleData(
  targetMonth: string
): Promise<ExpenseLifecycleData> {
  await getSession();

  const [yearStr, monthStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthStart = startOfMonth(year, month);
  const monthEnd = endOfMonth(year, month);

  // 対象月のStpExpenseRecordを取得
  const expenseRecords = await prisma.stpExpenseRecord.findMany({
    where: {
      targetMonth: monthStart,
      deletedAt: null,
    },
    include: {
      agentContractHistory: {
        include: {
          agent: {
            include: {
              company: true,
            },
          },
        },
      },
      stpCompany: {
        include: {
          company: true,
        },
      },
      contractHistory: true,
      revenueRecord: {
        include: {
          candidate: true,
        },
      },
    },
  });

  const items: ExpenseLifecycleItem[] = [];

  for (const record of expenseRecords) {
    const agentName = record.agentContractHistory?.agent?.company?.name ?? `代理店#${record.agentId}`;
    const companyName = record.stpCompany?.company?.name ?? null;
    const candidateName = record.revenueRecord?.candidate
      ? `${record.revenueRecord.candidate.lastName}${record.revenueRecord.candidate.firstName}`
      : null;

    const expenseTypeLabels: Record<string, string> = {
      agent_initial: "代理店初期費用",
      agent_monthly: "代理店月額",
      commission_initial: "初期費用紹介報酬",
      commission_monthly: "月額紹介報酬",
      commission_performance: "成果報酬紹介報酬",
    };
    const description = `${expenseTypeLabels[record.expenseType] || record.expenseType}${companyName ? ` (${companyName})` : ""}`;

    items.push({
      id: `expense-${record.id}`,
      expenseRecordId: record.id,
      expenseType: record.expenseType,
      agentName,
      agentId: record.agentId,
      companyName,
      stpCompanyId: record.stpCompanyId,
      contractHistoryId: record.contractHistoryId,
      amount: record.expectedAmount,
      netPaymentAmount: record.netPaymentAmount,
      withholdingTaxAmount: record.withholdingTaxAmount,
      targetMonth: formatDate(monthStart),
      description,
      appliedCommissionRate: record.appliedCommissionRate ? Number(record.appliedCommissionRate) : null,
      appliedCommissionType: record.appliedCommissionType,
      status: record.status === "pending" ? "pending" : "approved",
      transactionId: null,
      paymentGroupId: null,
      paymentGroupStatus: null,
      paymentDueDate: null,
      isOverdue: false,
      candidateName,
    });
  }

  // Transactionとのマッチング（経費側）
  // stpExpenseType + stpAgentId + periodFrom で照合
  if (items.length > 0) {
    const agentIds = [...new Set(items.map((i) => i.agentId))];
    const contractHistoryIds = [...new Set(items.filter((i) => i.contractHistoryId).map((i) => i.contractHistoryId!))];

    const existingTransactions = await prisma.transaction.findMany({
      where: {
        type: "expense",
        deletedAt: null,
        stpExpenseType: { not: null },
        periodFrom: { gte: monthStart, lte: monthEnd },
        OR: [
          ...(agentIds.length > 0 ? [{ stpAgentId: { in: agentIds } }] : []),
          ...(contractHistoryIds.length > 0 ? [{ stpContractHistoryId: { in: contractHistoryIds } }] : []),
        ],
      },
      include: {
        paymentGroup: true,
      },
    });

    const now = new Date();

    for (const item of items) {
      // マッチング: expenseType + agentId + (contractHistoryId or companyId)
      const matchingTx = existingTransactions.find((tx) => {
        if (tx.stpExpenseType !== item.expenseType) return false;
        if (tx.stpAgentId !== item.agentId) return false;
        if (item.contractHistoryId && tx.stpContractHistoryId !== item.contractHistoryId) return false;
        return true;
      });

      if (!matchingTx) {
        // Transactionなし → StpExpenseRecordのstatus次第
        if (item.status !== "pending") {
          item.status = "approved";
        }
        continue;
      }

      item.transactionId = matchingTx.id;
      item.paymentDueDate = matchingTx.paymentDueDate
        ? formatDate(matchingTx.paymentDueDate)
        : null;

      // ステータス判定
      if (matchingTx.status === "unconfirmed") {
        item.status = "unconfirmed";
      } else if (
        (matchingTx.status === "confirmed" ||
          matchingTx.status === "awaiting_accounting" ||
          matchingTx.status === "returned" ||
          matchingTx.status === "resubmitted") &&
        matchingTx.paymentGroupId == null
      ) {
        item.status = "confirmed";
      } else if (matchingTx.paymentGroupId != null && matchingTx.paymentGroup) {
        const pg = matchingTx.paymentGroup;
        item.paymentGroupId = pg.id;
        item.paymentGroupStatus = pg.status;

        switch (pg.status) {
          case "before_request":
          case "requested":
            item.status = "in_payment_group";
            break;
          case "invoice_received":
          case "rejected":
          case "re_requested":
            item.status = "invoice_received";
            break;
          case "confirmed":
          case "awaiting_accounting":
          case "returned": {
            const dueDate = pg.paymentDueDate ?? matchingTx.paymentDueDate;
            if (dueDate && new Date(dueDate) < now) {
              item.status = "overdue";
              item.isOverdue = true;
            } else {
              item.status = "invoice_received";
            }
            break;
          }
          case "paid":
            item.status = "paid";
            break;
          default:
            item.status = "confirmed";
        }
      } else {
        item.status = "confirmed";
      }
    }
  }

  // サマリー計算
  const summary = {
    pending: 0,
    approved: 0,
    unconfirmed: 0,
    confirmed: 0,
    inPaymentGroup: 0,
    invoiceReceived: 0,
    paid: 0,
    overdue: 0,
  };

  for (const item of items) {
    switch (item.status) {
      case "pending": summary.pending++; break;
      case "approved": summary.approved++; break;
      case "unconfirmed": summary.unconfirmed++; break;
      case "confirmed": summary.confirmed++; break;
      case "in_payment_group": summary.inPaymentGroup++; break;
      case "invoice_received": summary.invoiceReceived++; break;
      case "paid": summary.paid++; break;
      case "overdue": summary.overdue++; break;
    }
  }

  return {
    targetMonth,
    items,
    summary,
  };
}

// ============================================
// 経費の取引化
// ============================================

export type ExpenseItemInput = {
  expenseRecordId: number;
  paymentDueDate?: string;
};

export async function createTransactionFromExpense(
  input: ExpenseItemInput
): Promise<{ transactionId: number }> {
  const session = await getSession();
  const staffId = session.id;

  const stpCtx = await getSystemProjectContext("stp");
  const stpProjectId = stpCtx?.projectId ?? null;

  const expenseRecord = await prisma.stpExpenseRecord.findUnique({
    where: { id: input.expenseRecordId },
    include: {
      agentContractHistory: {
        include: {
          agent: {
            include: { company: true },
          },
        },
      },
      stpCompany: {
        include: { company: true },
      },
      contractHistory: true,
    },
  });

  if (!expenseRecord) {
    throw new Error("経費レコードが見つかりません");
  }

  // 代理店を取引先として検索
  const agent = expenseRecord.agentContractHistory?.agent;
  if (!agent) {
    throw new Error("代理店情報が見つかりません");
  }
  const agentName = agent.company?.name ?? `代理店#${agent.id}`;

  const counterparty = await prisma.counterparty.findFirst({
    where: {
      name: agentName,
      deletedAt: null,
    },
  });

  if (!counterparty) {
    throw new Error(
      `取引先が見つかりません（代理店: ${agentName}）。先に取引先マスタに登録してください。`
    );
  }

  // 費目取得
  const expenseCategories = await prisma.expenseCategory.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      type: "expense",
      ...(stpProjectId ? { projectId: stpProjectId } : {}),
    },
  });

  const expenseTypeLabels: Record<string, string> = {
    agent_initial: "代理店初期費用",
    agent_monthly: "代理店月額",
    commission_initial: "初期費用紹介報酬",
    commission_monthly: "月額紹介報酬",
    commission_performance: "成果報酬紹介報酬",
  };
  const typeLabel = expenseTypeLabels[expenseRecord.expenseType] || expenseRecord.expenseType;

  // 費目のマッチング
  let expenseCategory = null;
  if (expenseRecord.expenseType.includes("commission")) {
    expenseCategory = expenseCategories.find((c) => c.name.includes("紹介") || c.name.includes("報酬"));
  } else if (expenseRecord.expenseType.includes("agent")) {
    expenseCategory = expenseCategories.find((c) => c.name.includes("代理店") || c.name.includes("外注"));
  }
  if (!expenseCategory && expenseCategories.length > 0) {
    expenseCategory = expenseCategories[0];
  }

  const companyName = expenseRecord.stpCompany?.company?.name;
  const note = `${agentName} ${typeLabel}${companyName ? ` (${companyName})` : ""}`;

  const taxRate = expenseRecord.taxRate;
  const taxAmount = expenseRecord.taxAmount;

  const transaction = await prisma.transaction.create({
    data: {
      type: "expense",
      counterpartyId: counterparty.id,
      projectId: stpProjectId,
      expenseCategoryId: expenseCategory?.id ?? null,
      amount: expenseRecord.expectedAmount,
      taxAmount,
      taxRate,
      taxType: expenseRecord.taxType as "tax_included" | "tax_excluded",
      periodFrom: expenseRecord.targetMonth,
      periodTo: expenseRecord.targetMonth,
      paymentDueDate: input.paymentDueDate ? new Date(input.paymentDueDate) : null,
      status: "unconfirmed",
      isAutoGenerated: true,
      sourceType: "crm",
      stpContractHistoryId: expenseRecord.contractHistoryId,
      stpExpenseType: expenseRecord.expenseType,
      stpAgentId: expenseRecord.agentId,
      note,
      createdBy: staffId,
    },
  });

  revalidatePath("/stp/finance/billing");
  revalidatePath("/stp/finance/transactions");

  return { transactionId: transaction.id };
}

export async function bulkCreateTransactionsFromExpenses(
  inputs: ExpenseItemInput[]
): Promise<{ created: number }> {
  let created = 0;
  for (const input of inputs) {
    try {
      await createTransactionFromExpense(input);
      created++;
    } catch (error) {
      console.error(`経費取引化失敗: expenseRecordId=${input.expenseRecordId}`);
    }
  }

  revalidatePath("/stp/finance/billing");
  revalidatePath("/stp/finance/transactions");

  return { created };
}

// ============================================
// 利用可能な月の一覧
// ============================================

export async function getAvailableMonths(): Promise<string[]> {
  await getSession();

  // 最も古い契約開始日を取得
  const oldestContract = await prisma.stpContractHistory.findFirst({
    where: { deletedAt: null, status: "active" },
    orderBy: { contractStartDate: "asc" },
    select: { contractStartDate: true },
  });

  const months: string[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 未来3ヶ月まで
  let endYear = currentYear;
  let endMonth = currentMonth + 3;
  if (endMonth > 12) {
    endYear += Math.floor((endMonth - 1) / 12);
    endMonth = ((endMonth - 1) % 12) + 1;
  }

  // 開始月: 最も古い契約の開始月、または現在月の12ヶ月前
  let startYear: number;
  let startMonth: number;

  if (oldestContract) {
    const d = oldestContract.contractStartDate;
    startYear = d.getUTCFullYear();
    startMonth = d.getUTCMonth() + 1;

    // 最大24ヶ月前まで
    const minYear = currentYear - 2;
    if (startYear < minYear) {
      startYear = minYear;
      startMonth = currentMonth;
    }
  } else {
    startYear = currentYear;
    startMonth = currentMonth - 6;
    if (startMonth < 1) {
      startYear--;
      startMonth += 12;
    }
  }

  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return months;
}
