"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ============================================
// 型定義
// ============================================

export type ReconciliationFormData = {
  accounts: {
    id: number;
    code: string;
    name: string;
    category: string;
  }[];
};

export type UnmatchedBankTransaction = {
  id: number;
  transactionDate: Date;
  direction: string;
  amount: number;
  description: string | null;
  paymentMethod: { id: number; name: string };
  counterparty: { id: number; name: string } | null;
  reconciledAmount: number; // 既消込金額
};

export type UnmatchedJournalEntry = {
  id: number;
  journalDate: Date;
  description: string;
  status: string;
  debitTotal: number;
  creditTotal: number;
  lines: {
    id: number;
    side: string;
    amount: number;
    account: { id: number; code: string; name: string };
    description: string | null;
  }[];
  invoiceGroup: { id: number; invoiceNumber: string | null } | null;
  paymentGroup: { id: number; targetMonth: Date } | null;
  transaction: { id: number; type: string; counterparty: { name: string } | null } | null;
  reconciledAmount: number; // 既消込金額
};

export type ReconciliationRow = {
  id: number;
  amount: number;
  performedAt: Date;
  performer: { id: number; name: string };
  journalEntry: {
    id: number;
    journalDate: Date;
    description: string;
    lines: {
      side: string;
      amount: number;
      account: { code: string; name: string };
    }[];
  };
  bankTransaction: {
    id: number;
    transactionDate: Date;
    direction: string;
    amount: number;
    description: string | null;
    counterparty: { name: string } | null;
    paymentMethod: { name: string };
  };
};

// ============================================
// バリデーション
// ============================================

const VALID_DIFFERENCE_TYPES = [
  "partial_payment",
  "transfer_fee",
  "discount",
  "manual",
] as const;

type DifferenceType = (typeof VALID_DIFFERENCE_TYPES)[number];

type DifferenceJournalLine = {
  side: "debit" | "credit";
  accountId: number;
  amount: number;
  description?: string;
};

function validateReconciliationData(data: Record<string, unknown>) {
  const journalEntryId = Number(data.journalEntryId);
  if (!data.journalEntryId || isNaN(journalEntryId)) {
    throw new Error("仕訳は必須です");
  }

  const bankTransactionId = Number(data.bankTransactionId);
  if (!data.bankTransactionId || isNaN(bankTransactionId)) {
    throw new Error("入出金は必須です");
  }

  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error("消込金額は1以上の整数で入力してください");
  }

  // 差額処理タイプ（任意）
  const differenceType = data.differenceType as string | undefined;
  if (
    differenceType &&
    !(VALID_DIFFERENCE_TYPES as readonly string[]).includes(differenceType)
  ) {
    throw new Error("差額処理タイプが不正です");
  }

  // 差額仕訳明細（差額処理がある場合）
  const differenceLines = data.differenceLines as
    | DifferenceJournalLine[]
    | undefined;
  if (
    differenceType &&
    differenceType !== "partial_payment" &&
    differenceType !== "manual"
  ) {
    if (!differenceLines || differenceLines.length < 2) {
      throw new Error("差額仕訳は最低2行（借方・貸方）必要です");
    }
    const debitTotal = differenceLines
      .filter((l) => l.side === "debit")
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const creditTotal = differenceLines
      .filter((l) => l.side === "credit")
      .reduce((sum, l) => sum + Number(l.amount), 0);
    if (debitTotal !== creditTotal) {
      throw new Error(
        `差額仕訳の借方合計（${debitTotal.toLocaleString()}円）と貸方合計（${creditTotal.toLocaleString()}円）が一致しません`
      );
    }
  }

  return {
    journalEntryId,
    bankTransactionId,
    amount,
    differenceType: differenceType as DifferenceType | undefined,
    differenceLines,
  };
}

// ============================================
// 1. getUnmatchedBankTransactions（未消込の入出金取得）
// ============================================

export async function getUnmatchedBankTransactions(): Promise<
  UnmatchedBankTransaction[]
> {
  const bankTransactions = await prisma.bankTransaction.findMany({
    where: { deletedAt: null },
    include: {
      paymentMethod: { select: { id: true, name: true } },
      counterparty: { select: { id: true, name: true } },
      reconciliations: { select: { amount: true } },
    },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });

  // 未消込 or 部分消込のものだけ返す
  return bankTransactions
    .map((bt) => {
      const reconciledAmount = bt.reconciliations.reduce(
        (sum, r) => sum + r.amount,
        0
      );
      return {
        id: bt.id,
        transactionDate: bt.transactionDate,
        direction: bt.direction,
        amount: bt.amount,
        description: bt.description,
        paymentMethod: bt.paymentMethod,
        counterparty: bt.counterparty,
        reconciledAmount,
      };
    })
    .filter((bt) => bt.reconciledAmount < bt.amount);
}

// ============================================
// 2. getUnmatchedJournalEntries（未消込の仕訳取得）
// ============================================

export async function getUnmatchedJournalEntries(): Promise<
  UnmatchedJournalEntry[]
> {
  const entries = await prisma.journalEntry.findMany({
    where: {
      deletedAt: null,
      status: "confirmed",
    },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true } },
        },
      },
      invoiceGroup: {
        select: { id: true, invoiceNumber: true },
      },
      paymentGroup: {
        select: { id: true, targetMonth: true },
      },
      transaction: {
        select: {
          id: true,
          type: true,
          counterparty: { select: { name: true } },
        },
      },
      reconciliations: { select: { amount: true } },
    },
    orderBy: [{ journalDate: "desc" }, { id: "desc" }],
    take: 200,
  });

  // 仕訳の借方（または貸方）合計を基準に未消込判定
  return entries
    .map((entry) => {
      const debitTotal = entry.lines
        .filter((l) => l.side === "debit")
        .reduce((sum, l) => sum + l.amount, 0);
      const creditTotal = entry.lines
        .filter((l) => l.side === "credit")
        .reduce((sum, l) => sum + l.amount, 0);
      const reconciledAmount = entry.reconciliations.reduce(
        (sum, r) => sum + r.amount,
        0
      );

      return {
        id: entry.id,
        journalDate: entry.journalDate,
        description: entry.description,
        status: entry.status,
        debitTotal,
        creditTotal,
        lines: entry.lines.map((l) => ({
          id: l.id,
          side: l.side,
          amount: l.amount,
          account: l.account,
          description: l.description,
        })),
        invoiceGroup: entry.invoiceGroup,
        paymentGroup: entry.paymentGroup,
        transaction: entry.transaction,
        reconciledAmount,
      };
    })
    .filter((entry) => entry.reconciledAmount < entry.debitTotal);
}

// ============================================
// 3. getReconciliations（消込履歴取得）
// ============================================

export async function getReconciliations(): Promise<ReconciliationRow[]> {
  const reconciliations = await prisma.reconciliation.findMany({
    include: {
      journalEntry: {
        select: {
          id: true,
          journalDate: true,
          description: true,
          lines: {
            select: {
              side: true,
              amount: true,
              account: { select: { code: true, name: true } },
            },
          },
        },
      },
      bankTransaction: {
        select: {
          id: true,
          transactionDate: true,
          direction: true,
          amount: true,
          description: true,
          counterparty: { select: { name: true } },
          paymentMethod: { select: { name: true } },
        },
      },
      performer: { select: { id: true, name: true } },
    },
    orderBy: { performedAt: "desc" },
    take: 200,
  });

  return reconciliations;
}

// ============================================
// 4. getReconciliationFormData（フォーム用マスタデータ）
// ============================================

export async function getReconciliationFormData(): Promise<ReconciliationFormData> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, category: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });

  return { accounts };
}

// ============================================
// 5. createReconciliation（消込作成）
// ============================================

export async function createReconciliation(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const validated = validateReconciliationData(data);

  // 仕訳の存在チェック
  const journalEntry = await prisma.journalEntry.findFirst({
    where: {
      id: validated.journalEntryId,
      deletedAt: null,
      status: "confirmed",
    },
    include: {
      lines: true,
      reconciliations: { select: { amount: true } },
    },
  });
  if (!journalEntry) {
    throw new Error("仕訳が見つかりません（確定済みの仕訳が必要です）");
  }

  // 仕訳の借方合計
  const journalDebitTotal = journalEntry.lines
    .filter((l) => l.side === "debit")
    .reduce((sum, l) => sum + l.amount, 0);

  // 仕訳側の既消込金額
  const journalReconciledAmount = journalEntry.reconciliations.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  // 消込金額が仕訳の残額を超えないか
  const journalRemaining = journalDebitTotal - journalReconciledAmount;
  if (validated.amount > journalRemaining) {
    throw new Error(
      `消込金額（${validated.amount.toLocaleString()}円）が仕訳の未消込残額（${journalRemaining.toLocaleString()}円）を超えています`
    );
  }

  // 入出金の存在チェック
  const bankTransaction = await prisma.bankTransaction.findFirst({
    where: { id: validated.bankTransactionId, deletedAt: null },
    include: {
      reconciliations: { select: { amount: true } },
    },
  });
  if (!bankTransaction) {
    throw new Error("入出金が見つかりません");
  }

  // 入出金側の既消込金額
  const bankReconciledAmount = bankTransaction.reconciliations.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  // 消込金額が入出金の残額を超えないか
  const bankRemaining = bankTransaction.amount - bankReconciledAmount;
  if (validated.amount > bankRemaining) {
    throw new Error(
      `消込金額（${validated.amount.toLocaleString()}円）が入出金の未消込残額（${bankRemaining.toLocaleString()}円）を超えています`
    );
  }

  // トランザクションで消込＋差額仕訳を作成
  const result = await prisma.$transaction(async (tx) => {
    // 消込レコード作成
    const reconciliation = await tx.reconciliation.create({
      data: {
        journalEntryId: validated.journalEntryId,
        bankTransactionId: validated.bankTransactionId,
        amount: validated.amount,
        performedBy: staffId,
      },
    });

    // 差額仕訳の自動生成（振込手数料・値引きの場合）
    if (
      validated.differenceType &&
      validated.differenceType !== "partial_payment" &&
      validated.differenceType !== "manual" &&
      validated.differenceLines &&
      validated.differenceLines.length >= 2
    ) {
      const diffDescription =
        validated.differenceType === "transfer_fee"
          ? "振込手数料（消込差額）"
          : "値引き（消込差額）";

      const diffJournal = await tx.journalEntry.create({
        data: {
          journalDate: new Date(),
          description: diffDescription,
          isAutoGenerated: true,
          status: "confirmed",
          approvedBy: staffId,
          approvedAt: new Date(),
          createdBy: staffId,
        },
      });

      await tx.journalEntryLine.createMany({
        data: validated.differenceLines.map((line) => ({
          journalEntryId: diffJournal.id,
          side: line.side,
          accountId: Number(line.accountId),
          amount: Number(line.amount),
          description: line.description?.trim() || null,
          createdBy: staffId,
        })),
      });
    }

    return reconciliation;
  });

  revalidatePath("/accounting/reconciliation");
  revalidatePath("/accounting/bank-transactions");
  revalidatePath("/accounting/journal");
  return { id: result.id };
}

// ============================================
// 6. cancelReconciliation（消込取り消し）
// ============================================

export async function cancelReconciliation(id: number) {
  await getSession();

  const reconciliation = await prisma.reconciliation.findUnique({
    where: { id },
  });
  if (!reconciliation) {
    throw new Error("消込が見つかりません");
  }

  // 物理削除（Reconciliationはイベントログ的性質、取り消しは削除→再作成）
  await prisma.reconciliation.delete({
    where: { id },
  });

  revalidatePath("/accounting/reconciliation");
  revalidatePath("/accounting/bank-transactions");
  revalidatePath("/accounting/journal");
}
