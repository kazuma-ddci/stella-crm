"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordChangeLog, extractChanges, pickRecordData, JOURNAL_ENTRY_LOG_FIELDS } from "@/app/accounting/changelog/actions";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";

// ============================================
// 型定義
// ============================================

export type JournalEntryLineInput = {
  side: "debit" | "credit";
  accountId: number;
  amount: number;
  description?: string;
};

export type JournalFormData = {
  accounts: {
    id: number;
    code: string;
    name: string;
    category: string;
  }[];
};

// ============================================
// バリデーション
// ============================================

const VALID_STATUSES = ["draft", "confirmed"] as const;
const VALID_SIDES = ["debit", "credit"] as const;

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

  const nonNullCount = [invoiceGroupId, paymentGroupId, transactionId].filter(
    (v) => v !== null
  ).length;
  if (nonNullCount > 1) {
    throw new Error(
      "紐づき先（請求グループ/支払グループ/取引）は1つのみ指定できます"
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

  return {
    journalDate,
    description,
    invoiceGroupId,
    paymentGroupId,
    transactionId,
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
      creator: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
    orderBy: [{ journalDate: "desc" }, { id: "desc" }],
  });
}

// ============================================
// 2. createJournalEntry（新規仕訳作成）
// ============================================

export async function createJournalEntry(data: Record<string, unknown>) {
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
      throw new Error("指定された請求グループが見つかりません");
    }
  }
  if (validated.paymentGroupId) {
    const pg = await prisma.paymentGroup.findUnique({
      where: { id: validated.paymentGroupId },
      select: { id: true },
    });
    if (!pg) {
      throw new Error("指定された支払グループが見つかりません");
    }
  }
  if (validated.transactionId) {
    const tx = await prisma.transaction.findFirst({
      where: { id: validated.transactionId, deletedAt: null },
      select: { id: true },
    });
    if (!tx) {
      throw new Error("指定された取引が見つかりません");
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
      throw new Error(`勘定科目ID ${id} が見つかりません`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const journalEntry = await tx.journalEntry.create({
      data: {
        journalDate: validated.journalDate,
        description: validated.description,
        invoiceGroupId: validated.invoiceGroupId,
        paymentGroupId: validated.paymentGroupId,
        transactionId: validated.transactionId,
        isAutoGenerated: false,
        status: "draft",
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
        createdBy: staffId,
      })),
    });

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "JournalEntry",
        recordId: journalEntry.id,
        changeType: "create",
        newData: pickRecordData(
          journalEntry as unknown as Record<string, unknown>,
          [...JOURNAL_ENTRY_LOG_FIELDS]
        ),
      },
      staffId,
      tx
    );

    return journalEntry;
  });

  revalidatePath("/accounting/journal");
  return { id: result.id };
}

// ============================================
// 3. updateJournalEntry（仕訳更新）
// ============================================

export async function updateJournalEntry(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const existing = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new Error("仕訳が見つかりません");
  }
  if (existing.status !== "draft") {
    throw new Error("確定済みの仕訳は編集できません");
  }

  // 月次クローズチェック（既存レコードの日付）
  await ensureMonthNotClosed(existing.journalDate);

  const validated = validateJournalEntryData(data);

  // 月次クローズチェック（新しい日付）
  await ensureMonthNotClosed(validated.journalDate);

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
      throw new Error(`勘定科目ID ${aid} が見つかりません`);
    }
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.journalEntry.update({
      where: { id },
      data: {
        journalDate: validated.journalDate,
        description: validated.description,
        invoiceGroupId: validated.invoiceGroupId,
        paymentGroupId: validated.paymentGroupId,
        transactionId: validated.transactionId,
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
        createdBy: staffId,
      })),
    });

    // 変更履歴を記録
    const oldData = pickRecordData(
      existing as unknown as Record<string, unknown>,
      [...JOURNAL_ENTRY_LOG_FIELDS]
    );
    const newData = pickRecordData(
      updated as unknown as Record<string, unknown>,
      [...JOURNAL_ENTRY_LOG_FIELDS]
    );
    const changes = extractChanges(oldData, newData, [...JOURNAL_ENTRY_LOG_FIELDS]);
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

  revalidatePath("/accounting/journal");
}

// ============================================
// 4. confirmJournalEntry（仕訳確定）
// ============================================

export async function confirmJournalEntry(id: number) {
  const session = await getSession();
  const staffId = session.id;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
    include: {
      lines: true,
    },
  });
  if (!entry) {
    throw new Error("仕訳が見つかりません");
  }
  if (entry.status !== "draft") {
    throw new Error("下書き状態の仕訳のみ確定できます");
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
    throw new Error(
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

    // 取引に紐づいている場合、取引ステータスを更新
    if (entry.transactionId) {
      const transaction = await tx.transaction.findFirst({
        where: { id: entry.transactionId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (
        transaction &&
        transaction.status === "awaiting_accounting"
      ) {
        await tx.transaction.update({
          where: { id: entry.transactionId },
          data: {
            status: "journalized",
            updatedBy: staffId,
          },
        });

        // 取引のステータス変更も記録
        await recordChangeLog(
          {
            tableName: "Transaction",
            recordId: entry.transactionId,
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
}

// ============================================
// 5. deleteJournalEntry（仕訳削除 / 論理削除）
// ============================================

export async function deleteJournalEntry(id: number) {
  const session = await getSession();
  const staffId = session.id;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!entry) {
    throw new Error("仕訳が見つかりません");
  }
  if (entry.status !== "draft") {
    throw new Error("確定済みの仕訳は削除できません。下書きの仕訳のみ削除可能です");
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
        oldData: pickRecordData(
          entry as unknown as Record<string, unknown>,
          [...JOURNAL_ENTRY_LOG_FIELDS]
        ),
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/journal");
}

// ============================================
// 6. getJournalFormData（フォーム用マスタデータ取得）
// ============================================

export async function getJournalFormData(): Promise<JournalFormData> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, category: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });

  return { accounts };
}
