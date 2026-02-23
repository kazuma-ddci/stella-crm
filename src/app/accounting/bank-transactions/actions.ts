"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/library";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";

// ============================================
// 型定義
// ============================================

export type BankTransactionFormData = {
  paymentMethods: {
    id: number;
    name: string;
    methodType: string;
  }[];
  counterparties: {
    id: number;
    name: string;
    counterpartyType: string;
  }[];
};

type AttachmentInput = {
  id?: number;
  filePath: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  attachmentType: string;
};

type CryptoDetailInput = {
  currency: string;
  network: string;
  counterpartyWallet?: string;
  ownWallet?: string;
  foreignAmount: string;
  foreignCurrency: string;
  exchangeRate: string;
  paymentMethodId?: number;
};

export type BankTransactionRow = {
  id: number;
  transactionDate: Date;
  direction: string;
  amount: number;
  description: string | null;
  source: string;
  paymentMethod: {
    id: number;
    name: string;
    methodType: string;
  };
  counterparty: {
    id: number;
    name: string;
  } | null;
  reconciliations: {
    id: number;
    amount: number;
  }[];
  attachments: {
    id: number;
    fileName: string;
    filePath: string;
    fileSize: number | null;
    mimeType: string | null;
    attachmentType: string;
  }[];
  cryptoDetail: {
    id: number;
    currency: string;
    network: string;
    counterpartyWallet: string | null;
    ownWallet: string | null;
    foreignAmount: Decimal;
    foreignCurrency: string;
    exchangeRate: Decimal;
    paymentMethodId: number | null;
  } | null;
};

// ============================================
// バリデーション
// ============================================

const VALID_DIRECTIONS = ["incoming", "outgoing"] as const;

function validateBankTransactionData(data: Record<string, unknown>) {
  // transactionDate
  if (!data.transactionDate) {
    throw new Error("日付は必須です");
  }
  const transactionDate = new Date(data.transactionDate as string);
  if (isNaN(transactionDate.getTime())) {
    throw new Error("日付が無効です");
  }

  // direction
  const direction = data.direction as string;
  if (!direction || !(VALID_DIRECTIONS as readonly string[]).includes(direction)) {
    throw new Error("区分（入金/出金）は必須です");
  }

  // paymentMethodId
  const paymentMethodId = Number(data.paymentMethodId);
  if (!data.paymentMethodId || isNaN(paymentMethodId)) {
    throw new Error("決済手段は必須です");
  }

  // counterpartyId (optional)
  const counterpartyId = data.counterpartyId ? Number(data.counterpartyId) : null;
  if (data.counterpartyId && isNaN(counterpartyId!)) {
    throw new Error("取引先IDが不正です");
  }

  // amount
  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error("金額は1以上の整数で入力してください");
  }

  // description (optional)
  const description = (data.description as string)?.trim() || null;

  return {
    transactionDate,
    direction,
    paymentMethodId,
    counterpartyId,
    amount,
    description,
  };
}

function validateCryptoDetail(data: CryptoDetailInput) {
  if (!data.currency?.trim()) {
    throw new Error("仮想通貨の銘柄は必須です");
  }
  if (!data.network?.trim()) {
    throw new Error("ネットワークは必須です");
  }

  const foreignAmount = Number(data.foreignAmount);
  if (isNaN(foreignAmount) || foreignAmount <= 0) {
    throw new Error("外貨金額は0より大きい数値で入力してください");
  }

  if (!data.foreignCurrency?.trim()) {
    throw new Error("外貨単位は必須です");
  }

  const exchangeRate = Number(data.exchangeRate);
  if (isNaN(exchangeRate) || exchangeRate <= 0) {
    throw new Error("レートは0より大きい数値で入力してください");
  }

  return {
    currency: data.currency.trim(),
    network: data.network.trim(),
    counterpartyWallet: data.counterpartyWallet?.trim() || null,
    ownWallet: data.ownWallet?.trim() || null,
    foreignAmount: new Decimal(data.foreignAmount),
    foreignCurrency: data.foreignCurrency.trim(),
    exchangeRate: new Decimal(data.exchangeRate),
    paymentMethodId: data.paymentMethodId || null,
  };
}

// ============================================
// データ取得
// ============================================

export async function getBankTransactionFormData(): Promise<BankTransactionFormData> {
  const [paymentMethods, counterparties] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, methodType: true },
      orderBy: { name: "asc" },
    }),
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: { id: true, name: true, counterpartyType: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { paymentMethods, counterparties };
}

export async function getBankTransactions(filters?: {
  paymentMethodIds?: number[];
  direction?: string;
  search?: string;
}): Promise<BankTransactionRow[]> {
  const where: Record<string, unknown> = { deletedAt: null };

  if (filters?.paymentMethodIds && filters.paymentMethodIds.length > 0) {
    where.paymentMethodId = { in: filters.paymentMethodIds };
  }

  if (filters?.direction && (VALID_DIRECTIONS as readonly string[]).includes(filters.direction)) {
    where.direction = filters.direction;
  }

  const transactions = await prisma.bankTransaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
    take: 200,
    include: {
      paymentMethod: {
        select: { id: true, name: true, methodType: true },
      },
      counterparty: {
        select: { id: true, name: true },
      },
      reconciliations: {
        select: { id: true, amount: true },
      },
      attachments: {
        where: { deletedAt: null },
        select: {
          id: true,
          fileName: true,
          filePath: true,
          fileSize: true,
          mimeType: true,
          attachmentType: true,
        },
      },
      cryptoDetail: {
        select: {
          id: true,
          currency: true,
          network: true,
          counterpartyWallet: true,
          ownWallet: true,
          foreignAmount: true,
          foreignCurrency: true,
          exchangeRate: true,
          paymentMethodId: true,
        },
      },
    },
  });

  // search filter (client-side for simplicity with includes)
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.counterparty?.name?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        tx.paymentMethod.name.toLowerCase().includes(q)
    );
  }

  return transactions;
}

export async function getBankTransaction(id: number): Promise<BankTransactionRow | null> {
  return prisma.bankTransaction.findFirst({
    where: { id, deletedAt: null },
    include: {
      paymentMethod: {
        select: { id: true, name: true, methodType: true },
      },
      counterparty: {
        select: { id: true, name: true },
      },
      reconciliations: {
        select: { id: true, amount: true },
      },
      attachments: {
        where: { deletedAt: null },
        select: {
          id: true,
          fileName: true,
          filePath: true,
          fileSize: true,
          mimeType: true,
          attachmentType: true,
        },
      },
      cryptoDetail: {
        select: {
          id: true,
          currency: true,
          network: true,
          counterpartyWallet: true,
          ownWallet: true,
          foreignAmount: true,
          foreignCurrency: true,
          exchangeRate: true,
          paymentMethodId: true,
        },
      },
    },
  });
}

// ============================================
// 作成
// ============================================

export async function createBankTransaction(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const validated = validateBankTransactionData(data);

  // 月次クローズチェック
  await ensureMonthNotClosed(validated.transactionDate);

  // 仮想通貨詳細
  const cryptoDetailRaw = data.cryptoDetail as CryptoDetailInput | undefined;
  let cryptoDetailValidated: ReturnType<typeof validateCryptoDetail> | null = null;
  if (cryptoDetailRaw) {
    cryptoDetailValidated = validateCryptoDetail(cryptoDetailRaw);
  }

  // 証憑
  const attachments = (data.attachments as AttachmentInput[] | undefined) ?? [];

  const result = await prisma.$transaction(async (tx) => {
    const bankTransaction = await tx.bankTransaction.create({
      data: {
        transactionDate: validated.transactionDate,
        direction: validated.direction,
        paymentMethodId: validated.paymentMethodId,
        counterpartyId: validated.counterpartyId,
        amount: validated.amount,
        description: validated.description,
        source: "manual",
        createdBy: staffId,
      },
    });

    // 仮想通貨詳細
    if (cryptoDetailValidated) {
      await tx.cryptoTransactionDetail.create({
        data: {
          bankTransactionId: bankTransaction.id,
          ...cryptoDetailValidated,
          createdBy: staffId,
        },
      });
    }

    // 証憑
    if (attachments.length > 0) {
      await tx.attachment.createMany({
        data: attachments.map((att) => ({
          bankTransactionId: bankTransaction.id,
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          attachmentType: att.attachmentType || "other",
          uploadedBy: staffId,
        })),
      });
    }

    return bankTransaction;
  });

  revalidatePath("/accounting/bank-transactions");
  return { id: result.id };
}

// ============================================
// 更新
// ============================================

export async function updateBankTransaction(id: number, data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const existing = await prisma.bankTransaction.findFirst({
    where: { id, deletedAt: null },
    include: {
      attachments: { where: { deletedAt: null } },
      cryptoDetail: true,
    },
  });
  if (!existing) {
    throw new Error("入出金データが見つかりません");
  }

  // 月次クローズチェック（既存レコードの日付）
  await ensureMonthNotClosed(existing.transactionDate);

  // 消込済みの場合は編集不可
  const reconciliationCount = await prisma.reconciliation.count({
    where: { bankTransactionId: id },
  });
  if (reconciliationCount > 0) {
    throw new Error("消込済みの入出金は編集できません");
  }

  const validated = validateBankTransactionData(data);

  // 月次クローズチェック（新しい日付）
  await ensureMonthNotClosed(validated.transactionDate);

  // 仮想通貨詳細
  const cryptoDetailRaw = data.cryptoDetail as CryptoDetailInput | undefined;
  let cryptoDetailValidated: ReturnType<typeof validateCryptoDetail> | null = null;
  if (cryptoDetailRaw) {
    cryptoDetailValidated = validateCryptoDetail(cryptoDetailRaw);
  }

  // 証憑
  const incomingAttachments = (data.attachments as AttachmentInput[] | undefined) ?? [];

  await prisma.$transaction(async (tx) => {
    // メインレコード更新
    await tx.bankTransaction.update({
      where: { id },
      data: {
        transactionDate: validated.transactionDate,
        direction: validated.direction,
        paymentMethodId: validated.paymentMethodId,
        counterpartyId: validated.counterpartyId,
        amount: validated.amount,
        description: validated.description,
        updatedBy: staffId,
      },
    });

    // 仮想通貨詳細の更新
    if (cryptoDetailValidated) {
      if (existing.cryptoDetail) {
        await tx.cryptoTransactionDetail.update({
          where: { id: existing.cryptoDetail.id },
          data: {
            ...cryptoDetailValidated,
            updatedBy: staffId,
          },
        });
      } else {
        await tx.cryptoTransactionDetail.create({
          data: {
            bankTransactionId: id,
            ...cryptoDetailValidated,
            createdBy: staffId,
          },
        });
      }
    } else if (existing.cryptoDetail) {
      // 仮想通貨詳細が不要になった場合は削除
      await tx.cryptoTransactionDetail.delete({
        where: { id: existing.cryptoDetail.id },
      });
    }

    // 証憑の差分管理
    const incomingIds = new Set(
      incomingAttachments
        .filter((att) => att.id !== undefined)
        .map((att) => att.id as number)
    );

    // 削除対象：入力に含まれないもの → 論理削除
    const toDelete = existing.attachments.filter(
      (att) => !incomingIds.has(att.id)
    );
    if (toDelete.length > 0) {
      await tx.attachment.updateMany({
        where: { id: { in: toDelete.map((att) => att.id) } },
        data: { deletedAt: new Date() },
      });
    }

    // 新規追加：idがないもの
    const toCreate = incomingAttachments.filter(
      (att) => att.id === undefined
    );
    if (toCreate.length > 0) {
      await tx.attachment.createMany({
        data: toCreate.map((att) => ({
          bankTransactionId: id,
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          attachmentType: att.attachmentType || "other",
          uploadedBy: staffId,
        })),
      });
    }
  });

  revalidatePath("/accounting/bank-transactions");
}

// ============================================
// 論理削除
// ============================================

export async function deleteBankTransaction(id: number) {
  const session = await getSession();
  const staffId = session.id;

  const existing = await prisma.bankTransaction.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new Error("入出金データが見つかりません");
  }

  // 月次クローズチェック
  await ensureMonthNotClosed(existing.transactionDate);

  // 消込済みの場合は削除不可
  const reconciliationCount = await prisma.reconciliation.count({
    where: { bankTransactionId: id },
  });
  if (reconciliationCount > 0) {
    throw new Error("消込済みの入出金は削除できません");
  }

  await prisma.bankTransaction.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy: staffId,
    },
  });

  revalidatePath("/accounting/bank-transactions");
}
