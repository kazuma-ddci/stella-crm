"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordChangeLog, extractChanges, pickRecordData } from "@/app/finance/changelog/actions";
import { JOURNAL_ENTRY_LOG_FIELDS } from "@/app/finance/changelog/log-fields";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";

// ============================================
// 型定義
// ============================================

export type JournalEntryLineInput = {
  side: "debit" | "credit";
  accountId: number;
  amount: number;
  description?: string;
  taxClassification?: string;
  taxAmount?: number;
};

export type JournalFormData = {
  accounts: {
    id: number;
    code: string;
    name: string;
    category: string;
  }[];
  bankTransactions: {
    id: number;
    transactionDate: Date;
    direction: string;
    amount: number;
    description: string | null;
    counterparty: { id: number; name: string } | null;
    paymentMethod: { id: number; name: string };
  }[];
  projects: {
    id: number;
    code: string;
    name: string;
  }[];
  counterparties: {
    id: number;
    displayId: string | null;
    name: string;
    companyId: number | null;
    costCenterId: number | null;
    isInvoiceRegistered: boolean;
  }[];
  taxAccounts: {
    inputTaxAccountId: number | null;  // 仮払消費税
    outputTaxAccountId: number | null; // 仮受消費税
  };
};

// ============================================
// バリデーション
// ============================================

const VALID_STATUSES = ["draft", "confirmed"] as const;
const VALID_SIDES = ["debit", "credit"] as const;
const VALID_REALIZATION_STATUSES = ["realized", "unrealized"] as const;
const VALID_TAX_CLASSIFICATIONS = [
  "taxable_10", "taxable_8", "exempt", "non_taxable",
  "tax_free_export", "taxable_10_no_invoice", "taxable_8_no_invoice",
] as const;

function validateJournalEntryData(data: Record<string, unknown>) {
  // journalDate
  if (!data.journalDate) {
    throw new Error("仕訳日は必須です");
  }
  const journalDate = new Date(data.journalDate as string);
  if (isNaN(journalDate.getTime())) {
    throw new Error("仕訳日が無効な日付です");
  }

  // description
  const description = (data.description as string)?.trim();
  if (!description) {
    throw new Error("摘要は必須です");
  }

  // 排他FK制約: invoiceGroupId, paymentGroupId, transactionId はいずれか1つのみ
  const invoiceGroupId = data.invoiceGroupId
    ? Number(data.invoiceGroupId)
    : null;
  const paymentGroupId = data.paymentGroupId
    ? Number(data.paymentGroupId)
    : null;
  const transactionId = data.transactionId
    ? Number(data.transactionId)
    : null;

  if (invoiceGroupId !== null && (isNaN(invoiceGroupId) || !Number.isInteger(invoiceGroupId) || invoiceGroupId <= 0)) {
    throw new Error("請求グループIDが不正です");
  }
  if (paymentGroupId !== null && (isNaN(paymentGroupId) || !Number.isInteger(paymentGroupId) || paymentGroupId <= 0)) {
    throw new Error("支払グループIDが不正です");
  }
  if (transactionId !== null && (isNaN(transactionId) || !Number.isInteger(transactionId) || transactionId <= 0)) {
    throw new Error("取引IDが不正です");
  }

  const nonNullCount = [invoiceGroupId, paymentGroupId, transactionId].filter(
    (v) => v !== null
  ).length;
  if (nonNullCount > 1) {
    throw new Error(
      "紐づき先（請求/支払/取引）は1つのみ指定できます"
    );
  }

  // lines
  const lines = data.lines as JournalEntryLineInput[] | undefined;
  if (!lines || lines.length < 2) {
    throw new Error("仕訳明細は最低2行（借方・貸方）必要です");
  }

  // 各明細のバリデーション
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!(VALID_SIDES as readonly string[]).includes(line.side)) {
      throw new Error(`明細${i + 1}: 借方/貸方の指定が無効です`);
    }
    if (!line.accountId || isNaN(Number(line.accountId))) {
      throw new Error(`明細${i + 1}: 勘定科目は必須です`);
    }
    if (
      line.amount === undefined ||
      line.amount === null ||
      isNaN(Number(line.amount)) ||
      Number(line.amount) <= 0 ||
      !Number.isInteger(Number(line.amount))
    ) {
      throw new Error(`明細${i + 1}: 金額は1以上の整数で入力してください`);
    }
  }

  // 借方合計 = 貸方合計
  const debitTotal = lines
    .filter((l) => l.side === "debit")
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const creditTotal = lines
    .filter((l) => l.side === "credit")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  if (debitTotal !== creditTotal) {
    throw new Error(
      `借方合計（${debitTotal.toLocaleString()}円）と貸方合計（${creditTotal.toLocaleString()}円）が一致しません`
    );
  }

  if (debitTotal === 0) {
    throw new Error("借方・貸方の合計金額が0円です");
  }

  // 消費税区分バリデーション
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.taxClassification && !(VALID_TAX_CLASSIFICATIONS as readonly string[]).includes(line.taxClassification)) {
      throw new Error(`明細${i + 1}: 無効な消費税区分です`);
    }
  }

  // ステータス
  const status = (data.status as string) || "draft";
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new Error("無効なステータスです");
  }

  // 実現/未実現
  const realizationStatus = (data.realizationStatus as string) || "";
  if (status === "confirmed" && !realizationStatus) {
    throw new Error("実現ステータスを選択してください");
  }
  if (realizationStatus && !(VALID_REALIZATION_STATUSES as readonly string[]).includes(realizationStatus)) {
    throw new Error("無効な実現ステータスです");
  }

  const scheduledDate = data.scheduledDate
    ? new Date(data.scheduledDate as string)
    : null;
  if (scheduledDate && isNaN(scheduledDate.getTime())) {
    throw new Error("実現予定日が無効な日付です");
  }

  // 未実現の場合は予定日が推奨
  if (realizationStatus === "unrealized" && !scheduledDate) {
    // 警告だけで必須にはしない
  }

  const bankTransactionId = data.bankTransactionId
    ? Number(data.bankTransactionId)
    : null;

  if (bankTransactionId !== null && (isNaN(bankTransactionId) || !Number.isInteger(bankTransactionId) || bankTransactionId <= 0)) {
    throw new Error("入出金IDが不正です");
  }

  // プロジェクト・取引先・インボイス有無
  const projectId = data.projectId ? Number(data.projectId) : null;
  if (projectId !== null && (isNaN(projectId) || !Number.isInteger(projectId) || projectId <= 0)) {
    throw new Error("プロジェクトIDが不正です");
  }
  const counterpartyId = data.counterpartyId ? Number(data.counterpartyId) : null;
  if (counterpartyId !== null && (isNaN(counterpartyId) || !Number.isInteger(counterpartyId) || counterpartyId <= 0)) {
    throw new Error("取引先IDが不正です");
  }
  const hasInvoice = data.hasInvoice !== false;

  return {
    journalDate,
    description,
    invoiceGroupId,
    paymentGroupId,
    transactionId,
    bankTransactionId,
    projectId,
    counterpartyId,
    hasInvoice,
    status,
    realizationStatus: realizationStatus || "unrealized",
    scheduledDate,
    lines,
    debitTotal,
    creditTotal,
  };
}

// ============================================
// 1. getJournalEntries（一覧取得）
// ============================================

export async function getJournalEntries(filters?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  // 認証: 経理プロジェクトの閲覧権限以上
  await requireStaffForAccounting("view");

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (filters?.status && (VALID_STATUSES as readonly string[]).includes(filters.status)) {
    where.status = filters.status;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    const journalDateFilter: Record<string, Date> = {};
    if (filters?.dateFrom) {
      journalDateFilter.gte = new Date(filters.dateFrom);
    }
    if (filters?.dateTo) {
      journalDateFilter.lte = new Date(filters.dateTo);
    }
    where.journalDate = journalDateFilter;
  }

  return prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true } },
        },
      },
      invoiceGroup: {
        select: {
          id: true,
          invoiceNumber: true,
          counterparty: { select: { id: true, name: true } },
        },
      },
      paymentGroup: {
        select: {
          id: true,
          targetMonth: true,
          counterparty: { select: { id: true, name: true } },
        },
      },
      transaction: {
        select: {
          id: true,
          type: true,
          amount: true,
          counterparty: { select: { id: true, name: true } },
        },
      },
      bankTransaction: {
        select: {
          id: true,
          transactionDate: true,
          direction: true,
          amount: true,
          description: true,
        },
      },
      project: { select: { id: true, code: true, name: true } },
      counterparty: { select: { id: true, name: true, isInvoiceRegistered: true } },
      creator: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      realizer: { select: { id: true, name: true } },
    },
    orderBy: [{ journalDate: "desc" }, { id: "desc" }],
  });
}

// ============================================
// 2. createJournalEntry（新規仕訳作成）
// ============================================

export async function createJournalEntry(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: number }>> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const validated = validateJournalEntryData(data);

  // 月次クローズチェック
  await ensureMonthNotClosed(validated.journalDate);

  // 紐づき先の存在チェック
  if (validated.invoiceGroupId) {
    const ig = await prisma.invoiceGroup.findUnique({
      where: { id: validated.invoiceGroupId },
      select: { id: true },
    });
    if (!ig) {
      return err("指定された請求が見つかりません");
    }
  }
  if (validated.paymentGroupId) {
    const pg = await prisma.paymentGroup.findUnique({
      where: { id: validated.paymentGroupId },
      select: { id: true },
    });
    if (!pg) {
      return err("指定された支払が見つかりません");
    }
  }
  if (validated.transactionId) {
    const tx = await prisma.transaction.findFirst({
      where: { id: validated.transactionId, deletedAt: null },
      select: { id: true },
    });
    if (!tx) {
      return err("指定された取引が見つかりません");
    }
  }
  if (validated.bankTransactionId) {
    const bt = await prisma.bankTransaction.findFirst({
      where: { id: validated.bankTransactionId, deletedAt: null },
      select: { id: true },
    });
    if (!bt) {
      return err("指定された入出金が見つかりません");
    }
  }

  // 勘定科目の存在チェック
  const accountIds = [
    ...new Set(validated.lines.map((l) => Number(l.accountId))),
  ];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true },
  });
  const foundAccountIds = new Set(accounts.map((a) => a.id));
  for (const id of accountIds) {
    if (!foundAccountIds.has(id)) {
      return err(`勘定科目ID ${id} が見つかりません`);
    }
  }

  let result;
  try {
  result = await prisma.$transaction(async (tx) => {
    const journalEntry = await tx.journalEntry.create({
      data: {
        journalDate: validated.journalDate,
        description: validated.description,
        invoiceGroupId: validated.invoiceGroupId,
        paymentGroupId: validated.paymentGroupId,
        transactionId: validated.transactionId,
        bankTransactionId: validated.bankTransactionId,
        projectId: validated.projectId,
        counterpartyId: validated.counterpartyId,
        hasInvoice: validated.hasInvoice,
        realizationStatus: validated.realizationStatus,
        scheduledDate: validated.scheduledDate,
        isAutoGenerated: false,
        status: validated.status,
        createdBy: staffId,
      },
    });

    await tx.journalEntryLine.createMany({
      data: validated.lines.map((line) => ({
        journalEntryId: journalEntry.id,
        side: line.side,
        accountId: Number(line.accountId),
        amount: Number(line.amount),
        description: line.description?.trim() || null,
        taxClassification: line.taxClassification || null,
        taxAmount: line.taxAmount != null ? Number(line.taxAmount) : null,
        createdBy: staffId,
      })),
    });

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "JournalEntry",
        recordId: journalEntry.id,
        changeType: "create",
        newData: await pickRecordData(
          journalEntry as unknown as Record<string, unknown>,
          [...JOURNAL_ENTRY_LOG_FIELDS]
        ),
      },
      staffId,
      tx
    );

    return journalEntry;
  });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Foreign key constraint")) {
      return err("紐づき先のレコードが見つかりません。入力内容を確認してください");
    }
    throw e;
  }

  revalidatePath("/accounting/journal");
  return ok({ id: result.id });
  } catch (e) {
    console.error("[createJournalEntry] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 3. updateJournalEntry（仕訳更新）
// ============================================

export async function updateJournalEntry(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const existing = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return err("仕訳が見つかりません");
  }
  if (existing.status !== "draft") {
    return err("確定済みの仕訳は編集できません");
  }

  // 月次クローズチェック（既存レコードの日付）
  await ensureMonthNotClosed(existing.journalDate);

  const validated = validateJournalEntryData(data);

  // 月次クローズチェック（新しい日付）
  await ensureMonthNotClosed(validated.journalDate);

  // bankTransaction存在チェック
  if (validated.bankTransactionId) {
    const bt = await prisma.bankTransaction.findFirst({
      where: { id: validated.bankTransactionId, deletedAt: null },
      select: { id: true },
    });
    if (!bt) {
      return err("指定された入出金が見つかりません");
    }
  }

  // 勘定科目の存在チェック
  const accountIds = [
    ...new Set(validated.lines.map((l) => Number(l.accountId))),
  ];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true },
  });
  const foundAccountIds = new Set(accounts.map((a) => a.id));
  for (const aid of accountIds) {
    if (!foundAccountIds.has(aid)) {
      return err(`勘定科目ID ${aid} が見つかりません`);
    }
  }

  try {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.journalEntry.update({
      where: { id },
      data: {
        journalDate: validated.journalDate,
        description: validated.description,
        invoiceGroupId: validated.invoiceGroupId,
        paymentGroupId: validated.paymentGroupId,
        transactionId: validated.transactionId,
        bankTransactionId: validated.bankTransactionId,
        projectId: validated.projectId,
        counterpartyId: validated.counterpartyId,
        hasInvoice: validated.hasInvoice,
        realizationStatus: validated.realizationStatus,
        scheduledDate: validated.scheduledDate,
        updatedBy: staffId,
      },
    });

    // 既存明細を全削除して再作成
    await tx.journalEntryLine.deleteMany({
      where: { journalEntryId: id },
    });

    await tx.journalEntryLine.createMany({
      data: validated.lines.map((line) => ({
        journalEntryId: id,
        side: line.side,
        accountId: Number(line.accountId),
        amount: Number(line.amount),
        description: line.description?.trim() || null,
        taxClassification: line.taxClassification || null,
        taxAmount: line.taxAmount != null ? Number(line.taxAmount) : null,
        createdBy: staffId,
      })),
    });

    // 変更履歴を記録
    const oldData = await pickRecordData(
      existing as unknown as Record<string, unknown>,
      [...JOURNAL_ENTRY_LOG_FIELDS]
    );
    const newData = await pickRecordData(
      updated as unknown as Record<string, unknown>,
      [...JOURNAL_ENTRY_LOG_FIELDS]
    );
    const changes = await extractChanges(oldData, newData, [...JOURNAL_ENTRY_LOG_FIELDS]);
    if (changes) {
      await recordChangeLog(
        {
          tableName: "JournalEntry",
          recordId: id,
          changeType: "update",
          oldData: changes.oldData,
          newData: changes.newData,
        },
        staffId,
        tx
      );
    }
  });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Foreign key constraint")) {
      return err("紐づき先のレコードが見つかりません。入力内容を確認してください");
    }
    throw e;
  }

  revalidatePath("/accounting/journal");
  return ok();
  } catch (e) {
    console.error("[updateJournalEntry] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 4. confirmJournalEntry（仕訳確定）
// ============================================

export async function confirmJournalEntry(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
    include: {
      lines: true,
    },
  });
  if (!entry) {
    return err("仕訳が見つかりません");
  }
  if (entry.status !== "draft") {
    return err("下書き状態の仕訳のみ確定できます");
  }

  // 月次クローズチェック
  await ensureMonthNotClosed(entry.journalDate);

  // 借方/貸方合計チェック（確定時にも再検証）
  const debitTotal = entry.lines
    .filter((l) => l.side === "debit")
    .reduce((sum, l) => sum + l.amount, 0);
  const creditTotal = entry.lines
    .filter((l) => l.side === "credit")
    .reduce((sum, l) => sum + l.amount, 0);

  if (debitTotal !== creditTotal) {
    return err(
      `借方合計（${debitTotal.toLocaleString()}円）と貸方合計（${creditTotal.toLocaleString()}円）が一致しないため確定できません`
    );
  }

  // 紐づいている取引のステータスを「仕訳済み」に更新
  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({
      where: { id },
      data: {
        status: "confirmed",
        approvedBy: staffId,
        approvedAt: new Date(),
        updatedBy: staffId,
      },
    });

    // 仕訳の変更履歴を記録
    await recordChangeLog(
      {
        tableName: "JournalEntry",
        recordId: id,
        changeType: "update",
        oldData: { status: entry.status },
        newData: { status: "confirmed" },
      },
      staffId,
      tx
    );

    // 紐づいている取引のステータスを「仕訳済み」に更新
    // transactionId直接紐づき、またはinvoiceGroupId/paymentGroupId経由の取引を対象
    const relatedTransactionIds: number[] = [];

    if (entry.transactionId) {
      relatedTransactionIds.push(entry.transactionId);
    }

    if (entry.invoiceGroupId) {
      const groupTxns = await tx.transaction.findMany({
        where: { invoiceGroupId: entry.invoiceGroupId, deletedAt: null },
        select: { id: true },
      });
      groupTxns.forEach((t) => relatedTransactionIds.push(t.id));
    }

    if (entry.paymentGroupId) {
      const groupTxns = await tx.transaction.findMany({
        where: { paymentGroupId: entry.paymentGroupId, deletedAt: null },
        select: { id: true },
      });
      groupTxns.forEach((t) => relatedTransactionIds.push(t.id));
    }

    const uniqueTransactionIds = [...new Set(relatedTransactionIds)];

    for (const txnId of uniqueTransactionIds) {
      const transaction = await tx.transaction.findFirst({
        where: { id: txnId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (
        transaction &&
        transaction.status === "awaiting_accounting"
      ) {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "journalized",
            updatedBy: staffId,
          },
        });

        await recordChangeLog(
          {
            tableName: "Transaction",
            recordId: transaction.id,
            changeType: "update",
            oldData: { status: "awaiting_accounting" },
            newData: { status: "journalized" },
          },
          staffId,
          tx
        );
      }
    }
  });

  revalidatePath("/accounting/journal");
  revalidatePath("/accounting/transactions");
  return ok();
  } catch (e) {
    console.error("[confirmJournalEntry] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 5. deleteJournalEntry（仕訳削除 / 論理削除）
// ============================================

export async function deleteJournalEntry(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!entry) {
    return err("仕訳が見つかりません");
  }
  if (entry.status !== "draft") {
    return err("確定済みの仕訳は削除できません。下書きの仕訳のみ削除可能です");
  }

  // 月次クローズチェック
  await ensureMonthNotClosed(entry.journalDate);

  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: staffId,
      },
    });

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "JournalEntry",
        recordId: id,
        changeType: "delete",
        oldData: await pickRecordData(
          entry as unknown as Record<string, unknown>,
          [...JOURNAL_ENTRY_LOG_FIELDS]
        ),
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/journal");
  return ok();
  } catch (e) {
    console.error("[deleteJournalEntry] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 6. getJournalFormData（フォーム用マスタデータ取得）
// ============================================

export async function getJournalFormData(): Promise<JournalFormData> {
  await requireStaffForAccounting("view");

  const [accounts, bankTransactions, projects, counterparties, inputTaxAccount, outputTaxAccount] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, category: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
    prisma.bankTransaction.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        transactionDate: true,
        direction: true,
        amount: true,
        description: true,
        counterparty: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 200,
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.counterparty.findMany({
      where: { isActive: true, deletedAt: null, mergedIntoId: null },
      select: { id: true, displayId: true, name: true, companyId: true, costCenterId: true, isInvoiceRegistered: true },
      orderBy: { displayId: "asc" },
    }),
    prisma.account.findFirst({
      where: { name: "仮払消費税", isActive: true },
      select: { id: true },
    }),
    prisma.account.findFirst({
      where: { name: "仮受消費税", isActive: true },
      select: { id: true },
    }),
  ]);

  return {
    accounts,
    bankTransactions,
    projects,
    counterparties,
    taxAccounts: {
      inputTaxAccountId: inputTaxAccount?.id ?? null,
      outputTaxAccountId: outputTaxAccount?.id ?? null,
    },
  };
}

// ============================================
// 7. realizeJournalEntry（仕訳を実現に変更）
// ============================================

export async function realizeJournalEntry(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!entry) {
    return err("仕訳が見つかりません");
  }
  if (entry.status !== "confirmed") {
    return err("確定済みの仕訳のみ実現に変更できます");
  }
  if (entry.realizationStatus !== "unrealized") {
    return err("未実現の仕訳のみ実現に変更できます");
  }

  // 月次クローズチェック
  await ensureMonthNotClosed(entry.journalDate);

  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({
      where: { id },
      data: {
        realizationStatus: "realized",
        realizedAt: new Date(),
        realizedBy: staffId,
        updatedBy: staffId,
      },
    });

    await recordChangeLog(
      {
        tableName: "JournalEntry",
        recordId: id,
        changeType: "update",
        oldData: { realizationStatus: "unrealized" },
        newData: { realizationStatus: "realized" },
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/journal");
  revalidatePath("/accounting/workflow");
  return ok();
  } catch (e) {
    console.error("[realizeJournalEntry] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 8. unrealizeJournalEntry（仕訳を未実現に戻す）
// ============================================

export async function unrealizeJournalEntry(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!entry) {
    return err("仕訳が見つかりません");
  }
  if (entry.status !== "confirmed") {
    return err("確定済みの仕訳のみ実現ステータスを変更できます");
  }
  if (entry.realizationStatus !== "realized") {
    return err("実現済みの仕訳のみ未実現に戻せます");
  }

  // 月次クローズチェック
  await ensureMonthNotClosed(entry.journalDate);

  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({
      where: { id },
      data: {
        realizationStatus: "unrealized",
        realizedAt: null,
        realizedBy: null,
        updatedBy: staffId,
      },
    });

    await recordChangeLog(
      {
        tableName: "JournalEntry",
        recordId: id,
        changeType: "update",
        oldData: { realizationStatus: "realized" },
        newData: { realizationStatus: "unrealized" },
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/journal");
  revalidatePath("/accounting/workflow");
  return ok();
  } catch (e) {
    console.error("[unrealizeJournalEntry] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 9. getUnrealizedScheduledEntries（実現予定日到来の未実現仕訳一覧）
// ============================================

export async function getUnrealizedScheduledEntries() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // 認証: 経理プロジェクトの閲覧権限以上
  await requireStaffForAccounting("view");

  return prisma.journalEntry.findMany({
    where: {
      deletedAt: null,
      realizationStatus: "unrealized",
      scheduledDate: { lte: today },
    },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true } },
        },
      },
      invoiceGroup: {
        select: {
          id: true,
          invoiceNumber: true,
          counterparty: { select: { id: true, name: true } },
        },
      },
      paymentGroup: {
        select: {
          id: true,
          counterparty: { select: { id: true, name: true } },
        },
      },
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
  });
}
