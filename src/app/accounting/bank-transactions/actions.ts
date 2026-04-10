"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/library";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";
import { ok, err, type ActionResult } from "@/lib/action-result";

// ============================================
// 型定義
// ============================================

export type BankTransactionFormData = {
  paymentMethods: {
    id: number;
    name: string;
    methodType: string;
    availableFor: string;
  }[];
  invoiceGroups: {
    id: number;
    invoiceNumber: string | null;
    counterpartyName: string;
    totalAmount: number | null;
  }[];
  paymentGroups: {
    id: number;
    referenceCode: string | null;
    counterpartyName: string;
    totalAmount: number | null;
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
  linkCompleted: boolean;
  paymentMethod: {
    id: number;
    name: string;
    methodType: string;
  };
  counterparty: {
    id: number;
    name: string;
  } | null;
  // 紐付けられているグループ一覧（分割紐付け対応）
  groupLinks: {
    id: number;
    groupType: "invoice" | "payment";
    groupId: number;
    groupLabel: string;
    counterpartyName: string;
    groupTotalAmount: number | null;
    amount: number;
    note: string | null;
  }[];
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

type ValidatedBankTx = {
  transactionDate: Date;
  direction: string;
  paymentMethodId: number;
  counterpartyId: number | null;
  amount: number;
  description: string | null;
};

function validateBankTransactionData(
  data: Record<string, unknown>
): { ok: true; value: ValidatedBankTx } | { ok: false; error: string } {
  // transactionDate
  if (!data.transactionDate) {
    return { ok: false, error: "日付は必須です" };
  }
  const transactionDate = new Date(data.transactionDate as string);
  if (isNaN(transactionDate.getTime())) {
    return { ok: false, error: "日付が無効です" };
  }

  // direction
  const direction = data.direction as string;
  if (!direction || !(VALID_DIRECTIONS as readonly string[]).includes(direction)) {
    return { ok: false, error: "区分（入金/出金）は必須です" };
  }

  // paymentMethodId
  const paymentMethodId = Number(data.paymentMethodId);
  if (!data.paymentMethodId || isNaN(paymentMethodId)) {
    return { ok: false, error: "決済手段は必須です" };
  }

  // counterpartyId (optional)
  const counterpartyId = data.counterpartyId ? Number(data.counterpartyId) : null;
  if (data.counterpartyId && isNaN(counterpartyId!)) {
    return { ok: false, error: "取引先IDが不正です" };
  }

  // amount
  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
    return { ok: false, error: "金額は1以上の整数で入力してください" };
  }

  // description (optional)
  const description = (data.description as string)?.trim() || null;

  return {
    ok: true,
    value: {
      transactionDate,
      direction,
      paymentMethodId,
      counterpartyId,
      amount,
      description,
    },
  };
}

type ValidatedCrypto = {
  currency: string;
  network: string;
  counterpartyWallet: string | null;
  ownWallet: string | null;
  foreignAmount: Decimal;
  foreignCurrency: string;
  exchangeRate: Decimal;
  paymentMethodId: number | null;
};

function validateCryptoDetail(
  data: CryptoDetailInput
): { ok: true; value: ValidatedCrypto } | { ok: false; error: string } {
  if (!data.currency?.trim()) {
    return { ok: false, error: "仮想通貨の銘柄は必須です" };
  }
  if (!data.network?.trim()) {
    return { ok: false, error: "ネットワークは必須です" };
  }

  const foreignAmount = Number(data.foreignAmount);
  if (isNaN(foreignAmount) || foreignAmount <= 0) {
    return { ok: false, error: "外貨金額は0より大きい数値で入力してください" };
  }

  if (!data.foreignCurrency?.trim()) {
    return { ok: false, error: "外貨単位は必須です" };
  }

  const exchangeRate = Number(data.exchangeRate);
  if (isNaN(exchangeRate) || exchangeRate <= 0) {
    return { ok: false, error: "レートは0より大きい数値で入力してください" };
  }

  return {
    ok: true,
    value: {
      currency: data.currency.trim(),
      network: data.network.trim(),
      counterpartyWallet: data.counterpartyWallet?.trim() || null,
      ownWallet: data.ownWallet?.trim() || null,
      foreignAmount: new Decimal(data.foreignAmount),
      foreignCurrency: data.foreignCurrency.trim(),
      exchangeRate: new Decimal(data.exchangeRate),
      paymentMethodId: data.paymentMethodId || null,
    },
  };
}

// ============================================
// データ取得
// ============================================

export async function getBankTransactionFormData(): Promise<BankTransactionFormData> {
  const [paymentMethods, invoiceGroups, paymentGroups] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, methodType: true, availableFor: true },
      orderBy: { name: "asc" },
    }),
    prisma.invoiceGroup.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        counterparty: { select: { name: true } },
      },
      orderBy: { id: "desc" },
      take: 200,
    }),
    prisma.paymentGroup.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        referenceCode: true,
        totalAmount: true,
        counterparty: { select: { name: true } },
      },
      orderBy: { id: "desc" },
      take: 200,
    }),
  ]);

  return {
    paymentMethods,
    invoiceGroups: invoiceGroups.map((ig) => ({
      id: ig.id,
      invoiceNumber: ig.invoiceNumber,
      counterpartyName: ig.counterparty?.name ?? "",
      totalAmount: ig.totalAmount,
    })),
    paymentGroups: paymentGroups.map((pg) => ({
      id: pg.id,
      referenceCode: pg.referenceCode,
      counterpartyName: pg.counterparty?.name ?? "",
      totalAmount: pg.totalAmount,
    })),
  };
}

const BANK_TX_INCLUDE = {
  paymentMethod: {
    select: { id: true, name: true, methodType: true },
  },
  counterparty: {
    select: { id: true, name: true },
  },
  groupLinks: {
    include: {
      invoiceGroup: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          counterparty: { select: { name: true } },
        },
      },
      paymentGroup: {
        select: {
          id: true,
          referenceCode: true,
          totalAmount: true,
          counterparty: { select: { name: true } },
        },
      },
    },
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
} as const;

function mapBankTxRow(
  raw: Awaited<ReturnType<typeof prisma.bankTransaction.findFirstOrThrow<{ include: typeof BANK_TX_INCLUDE }>>>
): BankTransactionRow {
  return {
    id: raw.id,
    transactionDate: raw.transactionDate,
    direction: raw.direction,
    amount: raw.amount,
    description: raw.description,
    source: raw.source,
    linkCompleted: raw.linkCompleted,
    paymentMethod: raw.paymentMethod,
    counterparty: raw.counterparty,
    groupLinks: raw.groupLinks.map((l) => {
      const isInvoice = l.invoiceGroupId !== null;
      return {
        id: l.id,
        groupType: isInvoice ? "invoice" as const : "payment" as const,
        groupId: isInvoice ? (l.invoiceGroupId ?? 0) : (l.paymentGroupId ?? 0),
        groupLabel: isInvoice
          ? (l.invoiceGroup?.invoiceNumber ?? `INV-${l.invoiceGroupId}`)
          : (l.paymentGroup?.referenceCode ?? `PG-${l.paymentGroupId}`),
        counterpartyName: isInvoice
          ? (l.invoiceGroup?.counterparty?.name ?? "")
          : (l.paymentGroup?.counterparty?.name ?? ""),
        groupTotalAmount: isInvoice
          ? (l.invoiceGroup?.totalAmount ?? null)
          : (l.paymentGroup?.totalAmount ?? null),
        amount: l.amount,
        note: l.note,
      };
    }),
    reconciliations: raw.reconciliations,
    attachments: raw.attachments,
    cryptoDetail: raw.cryptoDetail,
  };
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
    include: BANK_TX_INCLUDE,
  });

  const rows = transactions.map(mapBankTxRow);

  // search filter (client-side for simplicity with includes)
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    return rows.filter(
      (tx) =>
        tx.counterparty?.name?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        tx.paymentMethod.name.toLowerCase().includes(q) ||
        tx.groupLinks.some(
          (l) =>
            l.groupLabel.toLowerCase().includes(q) ||
            l.counterpartyName.toLowerCase().includes(q)
        )
    );
  }

  return rows;
}

export async function getBankTransaction(id: number): Promise<BankTransactionRow | null> {
  const raw = await prisma.bankTransaction.findFirst({
    where: { id, deletedAt: null },
    include: BANK_TX_INCLUDE,
  });
  if (!raw) return null;
  return mapBankTxRow(raw);
}

// ============================================
// 作成
// ============================================

export async function createBankTransaction(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: number }>> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const validatedRes = validateBankTransactionData(data);
    if (!validatedRes.ok) return err(validatedRes.error);
    const validated = validatedRes.value;

    // 月次クローズチェック
    await ensureMonthNotClosed(validated.transactionDate);

    // 仮想通貨詳細
    const cryptoDetailRaw = data.cryptoDetail as CryptoDetailInput | undefined;
    let cryptoDetailValidated: ValidatedCrypto | null = null;
    if (cryptoDetailRaw) {
      const res = validateCryptoDetail(cryptoDetailRaw);
      if (!res.ok) return err(res.error);
      cryptoDetailValidated = res.value;
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
    return ok({ id: result.id });
  } catch (e) {
    console.error("[createBankTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 更新
// ============================================

export async function updateBankTransaction(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
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
    return err("入出金データが見つかりません");
  }

  // 月次クローズチェック（既存レコードの日付）
  await ensureMonthNotClosed(existing.transactionDate);

  // 消込済みの場合は編集不可
  const reconciliationCount = await prisma.reconciliation.count({
    where: { bankTransactionId: id },
  });
  if (reconciliationCount > 0) {
    return err("消込済みの入出金は編集できません");
  }

  const validatedRes = validateBankTransactionData(data);
  if (!validatedRes.ok) return err(validatedRes.error);
  const validated = validatedRes.value;

  // 月次クローズチェック（新しい日付）
  await ensureMonthNotClosed(validated.transactionDate);

  // 仮想通貨詳細
  const cryptoDetailRaw = data.cryptoDetail as CryptoDetailInput | undefined;
  let cryptoDetailValidated: ValidatedCrypto | null = null;
  if (cryptoDetailRaw) {
    const res = validateCryptoDetail(cryptoDetailRaw);
    if (!res.ok) return err(res.error);
    cryptoDetailValidated = res.value;
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
  return ok();
  } catch (e) {
    console.error("[updateBankTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 論理削除
// ============================================

export async function deleteBankTransaction(id: number): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return err("入出金データが見つかりません");
    }

    // 月次クローズチェック
    await ensureMonthNotClosed(existing.transactionDate);

    // 消込済みの場合は削除不可
    const reconciliationCount = await prisma.reconciliation.count({
      where: { bankTransactionId: id },
    });
    if (reconciliationCount > 0) {
      return err("消込済みの入出金は削除できません");
    }

    await prisma.bankTransaction.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: staffId,
      },
    });

    revalidatePath("/accounting/bank-transactions");
    return ok();
  } catch (e) {
    console.error("[deleteBankTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
