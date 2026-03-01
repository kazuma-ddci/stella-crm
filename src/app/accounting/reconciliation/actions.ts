"use server";

import { revalidatePath } from "next/cache";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";
import { recordChangeLog } from "@/app/accounting/changelog/actions";

// Prisma transaction client type
type TxClient = Omit<
  PrismaClient,
  | "$connect"
  | "$disconnect"
  | "$on"
  | "$transaction"
  | "$use"
  | "$extends"
>;

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
  paymentGroup: { id: number; targetMonth: Date | null } | null;
  transaction: {
    id: number;
    type: string;
    counterparty: { name: string } | null;
  } | null;
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
// ヘルパー: 月次クローズチェック（P3）
// ============================================

async function checkMonthlyCloseForReconciliation(
  journalDate: Date,
  bankTransactionDate: Date
) {
  // 仕訳日と入出金日の両方の月をチェック
  await ensureMonthNotClosed(journalDate);
  if (
    journalDate.getFullYear() !== bankTransactionDate.getFullYear() ||
    journalDate.getMonth() !== bankTransactionDate.getMonth()
  ) {
    await ensureMonthNotClosed(bankTransactionDate);
  }
}

// ============================================
// ヘルパー: 決済手段に対応する勘定科目を取得（P1）
// ============================================

const METHOD_TYPE_ACCOUNT_PATTERNS: Record<string, string[]> = {
  bank_account: ["普通預金", "当座預金"],
  cash: ["現金", "小口現金"],
  credit_card: ["未払金"],
  crypto_wallet: ["仮想通貨"],
};

async function findAccountByMethodType(
  tx: TxClient,
  methodType: string
): Promise<{ id: number; code: string; name: string } | null> {
  const patterns = METHOD_TYPE_ACCOUNT_PATTERNS[methodType];
  if (!patterns) return null;

  for (const pattern of patterns) {
    const account = await tx.account.findFirst({
      where: { name: { contains: pattern }, isActive: true },
      select: { id: true, code: true, name: true },
    });
    if (account) return account;
  }

  return null;
}

// ============================================
// ヘルパー: Transaction.statusの更新（P2）
// ============================================

async function updateRelatedTransactionStatus(
  tx: TxClient,
  refs: {
    transactionId: number | null;
    invoiceGroupId: number | null;
    paymentGroupId: number | null;
  },
  staffId?: number
) {
  // 関連するTransactionのIDを収集
  const transactionIds: number[] = [];

  if (refs.transactionId) {
    transactionIds.push(refs.transactionId);
  }

  if (refs.invoiceGroupId) {
    const txns = await tx.transaction.findMany({
      where: {
        invoiceGroupId: refs.invoiceGroupId,
        deletedAt: null,
      },
      select: { id: true },
    });
    txns.forEach((t) => transactionIds.push(t.id));
  }

  if (refs.paymentGroupId) {
    const txns = await tx.transaction.findMany({
      where: {
        paymentGroupId: refs.paymentGroupId,
        deletedAt: null,
      },
      select: { id: true },
    });
    txns.forEach((t) => transactionIds.push(t.id));
  }

  // 重複除去
  const uniqueIds = [...new Set(transactionIds)];

  for (const txnId of uniqueIds) {
    const transaction = await tx.transaction.findUnique({
      where: { id: txnId },
      select: {
        id: true,
        status: true,
        amount: true,
        taxAmount: true,
        invoiceGroupId: true,
        paymentGroupId: true,
      },
    });

    if (!transaction) continue;
    // 消込ステータス遷移の対象: journalized, partially_paid, paid のみ
    if (
      !["journalized", "partially_paid", "paid"].includes(transaction.status)
    ) {
      continue;
    }

    // この取引に紐づく全仕訳の消込合計を計算
    const journalWhere: {
      transactionId?: number;
      invoiceGroupId?: number;
      paymentGroupId?: number;
    }[] = [{ transactionId: transaction.id }];

    if (transaction.invoiceGroupId) {
      journalWhere.push({ invoiceGroupId: transaction.invoiceGroupId });
    }
    if (transaction.paymentGroupId) {
      journalWhere.push({ paymentGroupId: transaction.paymentGroupId });
    }

    const relatedJournals = await tx.journalEntry.findMany({
      where: {
        deletedAt: null,
        OR: journalWhere,
      },
      include: { reconciliations: { select: { amount: true } } },
    });

    const totalReconciled = relatedJournals.reduce(
      (sum, je) =>
        sum + je.reconciliations.reduce((s, r) => s + r.amount, 0),
      0
    );

    // グループ紐づきの場合はグループ合計と比較、個別取引の場合は取引額と比較
    let targetTotal: number;

    if (transaction.invoiceGroupId) {
      // InvoiceGroupのtotalAmountを使用
      const ig = await tx.invoiceGroup.findUnique({
        where: { id: transaction.invoiceGroupId },
        select: { totalAmount: true },
      });
      targetTotal = ig?.totalAmount ?? (transaction.amount + transaction.taxAmount);
    } else if (transaction.paymentGroupId) {
      // PaymentGroupの取引合計を使用
      const groupTxns = await tx.transaction.findMany({
        where: { paymentGroupId: transaction.paymentGroupId, deletedAt: null },
        select: { amount: true, taxAmount: true },
      });
      targetTotal = groupTxns.reduce((sum, t) => sum + t.amount + t.taxAmount, 0);
    } else {
      targetTotal = transaction.amount + transaction.taxAmount;
    }

    // 消込状況に基づくステータス決定
    let correctStatus: string;
    if (totalReconciled >= targetTotal) {
      correctStatus = "paid";
    } else if (totalReconciled > 0) {
      correctStatus = "partially_paid";
    } else {
      correctStatus = "journalized";
    }

    if (correctStatus !== transaction.status) {
      const oldStatus = transaction.status;
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: correctStatus,
          ...(staffId ? { updatedBy: staffId } : {}),
        },
      });

      if (staffId) {
        await recordChangeLog(
          {
            tableName: "Transaction",
            recordId: transaction.id,
            changeType: "update",
            oldData: { status: oldStatus },
            newData: { status: correctStatus },
          },
          staffId,
          tx
        );
      }
    }
  }
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

  // 入出金の存在チェック（paymentMethodを含む）
  const bankTransaction = await prisma.bankTransaction.findFirst({
    where: { id: validated.bankTransactionId, deletedAt: null },
    include: {
      reconciliations: { select: { amount: true } },
      paymentMethod: { select: { id: true, methodType: true } },
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

  // P3: 月次クローズチェック
  await checkMonthlyCloseForReconciliation(
    journalEntry.journalDate,
    bankTransaction.transactionDate
  );

  // トランザクションで消込＋入金仕訳＋差額仕訳を作成
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

    // P1: 入金/支払仕訳の自動生成
    // 決済手段に対応する勘定科目を取得
    const paymentAccount = await findAccountByMethodType(
      tx as unknown as TxClient,
      bankTransaction.paymentMethod.methodType
    );

    if (paymentAccount) {
      const isIncoming = bankTransaction.direction === "incoming";

      // 対応する相手勘定を元仕訳から取得
      // 入金: 元仕訳の借方（売掛金等）が相手勘定
      // 出金: 元仕訳の貸方（買掛金等）が相手勘定
      const targetSide = isIncoming ? "debit" : "credit";
      const counterpartLines = journalEntry.lines
        .filter((l) => l.side === targetSide)
        .sort((a, b) => b.amount - a.amount);

      if (counterpartLines.length > 0) {
        const counterpartAccountId = counterpartLines[0].accountId;

        const cashDescription = isIncoming
          ? `入金仕訳（消込#${reconciliation.id}自動生成）`
          : `支払仕訳（消込#${reconciliation.id}自動生成）`;

        const cashJournal = await tx.journalEntry.create({
          data: {
            journalDate: bankTransaction.transactionDate,
            description: cashDescription,
            isAutoGenerated: true,
            status: "confirmed",
            approvedBy: staffId,
            approvedAt: new Date(),
            createdBy: staffId,
          },
        });

        await tx.journalEntryLine.createMany({
          data: [
            {
              journalEntryId: cashJournal.id,
              side: "debit",
              accountId: isIncoming
                ? paymentAccount.id
                : counterpartAccountId,
              amount: validated.amount,
              description: null,
              createdBy: staffId,
            },
            {
              journalEntryId: cashJournal.id,
              side: "credit",
              accountId: isIncoming
                ? counterpartAccountId
                : paymentAccount.id,
              amount: validated.amount,
              description: null,
              createdBy: staffId,
            },
          ],
        });
      }
    }

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
          ? `振込手数料（消込#${reconciliation.id}差額）`
          : `値引き（消込#${reconciliation.id}差額）`;

      const diffJournal = await tx.journalEntry.create({
        data: {
          journalDate: bankTransaction.transactionDate,
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

    // P2: Transaction.statusの更新
    await updateRelatedTransactionStatus(tx as unknown as TxClient, {
      transactionId: journalEntry.transactionId,
      invoiceGroupId: journalEntry.invoiceGroupId,
      paymentGroupId: journalEntry.paymentGroupId,
    }, staffId);

    return reconciliation;
  });

  revalidatePath("/accounting/reconciliation");
  revalidatePath("/accounting/bank-transactions");
  revalidatePath("/accounting/journal");
  revalidatePath("/accounting/transactions");
  return { id: result.id };
}

// ============================================
// 6. cancelReconciliation（消込取り消し）
// ============================================

export async function cancelReconciliation(id: number) {
  const session = await getSession();
  const staffId = session.id;

  const reconciliation = await prisma.reconciliation.findUnique({
    where: { id },
    include: {
      journalEntry: {
        select: {
          id: true,
          journalDate: true,
          transactionId: true,
          invoiceGroupId: true,
          paymentGroupId: true,
        },
      },
      bankTransaction: {
        select: {
          id: true,
          transactionDate: true,
        },
      },
    },
  });
  if (!reconciliation) {
    throw new Error("消込が見つかりません");
  }

  // P3: 月次クローズチェック
  await checkMonthlyCloseForReconciliation(
    reconciliation.journalEntry.journalDate,
    reconciliation.bankTransaction.transactionDate
  );

  await prisma.$transaction(async (tx) => {
    // 消込に紐づく自動生成仕訳（入金仕訳・差額仕訳）を論理削除
    // 部分一致による誤マッチを防ぐため、消込IDの後に非数字が続くパターンで検索
    const candidateJournals = await tx.journalEntry.findMany({
      where: {
        isAutoGenerated: true,
        deletedAt: null,
        description: { contains: `消込#${id}` },
      },
      select: { id: true, description: true },
    });
    // 厳密マッチ: "消込#${id}" の後に数字が続かないことを確認
    const pattern = new RegExp(`消込#${id}(?!\\d)`);
    const autoJournals = candidateJournals.filter(
      (j) => j.description && pattern.test(j.description)
    );

    for (const journal of autoJournals) {
      await tx.journalEntry.update({
        where: { id: journal.id },
        data: { deletedAt: new Date() },
      });
    }

    // 消込レコード削除（物理削除）
    await tx.reconciliation.delete({
      where: { id },
    });

    // P2: Transaction.statusの更新（消込取り消しによるリバート）
    await updateRelatedTransactionStatus(tx as unknown as TxClient, {
      transactionId: reconciliation.journalEntry.transactionId,
      invoiceGroupId: reconciliation.journalEntry.invoiceGroupId,
      paymentGroupId: reconciliation.journalEntry.paymentGroupId,
    }, staffId);
  });

  revalidatePath("/accounting/reconciliation");
  revalidatePath("/accounting/bank-transactions");
  revalidatePath("/accounting/journal");
  revalidatePath("/accounting/transactions");
}
