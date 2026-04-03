"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";

const VALID_METHOD_TYPES = [
  "cash",
  "bank_account",
  "credit_card",
  "crypto_wallet",
] as const;

const VALID_AVAILABLE_FOR = ["both", "incoming", "outgoing"] as const;

const DETAIL_FIELDS = [
  "bankName",
  "branchName",
  "accountType",
  "accountNumber",
  "accountHolder",
  "cardBrand",
  "cardLast4",
  "cryptoCurrency",
  "cryptoNetwork",
  "walletAddress",
];

function buildDetails(
  methodType: string,
  data: Record<string, unknown>
): Record<string, unknown> | null {
  switch (methodType) {
    case "bank_account": {
      const details: Record<string, unknown> = {};
      if (data.bankName)
        details.bankName = (data.bankName as string).trim();
      if (data.branchName)
        details.branchName = (data.branchName as string).trim();
      if (data.accountType) details.accountType = data.accountType;
      if (data.accountNumber)
        details.accountNumber = (data.accountNumber as string).trim();
      if (data.accountHolder)
        details.accountHolder = (data.accountHolder as string).trim();
      return Object.keys(details).length > 0 ? details : null;
    }
    case "credit_card": {
      const details: Record<string, unknown> = {};
      if (data.cardBrand)
        details.cardBrand = (data.cardBrand as string).trim();
      if (data.cardLast4)
        details.cardLast4 = (data.cardLast4 as string).trim();
      return Object.keys(details).length > 0 ? details : null;
    }
    case "crypto_wallet": {
      const details: Record<string, unknown> = {};
      if (data.cryptoCurrency) details.currency = data.cryptoCurrency;
      if (data.cryptoNetwork) details.network = data.cryptoNetwork;
      if (data.walletAddress)
        details.walletAddress = (data.walletAddress as string).trim();
      return Object.keys(details).length > 0 ? details : null;
    }
    default:
      return null;
  }
}

export async function createPaymentMethod(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const methodType = data.methodType as string;
  const name = (data.name as string).trim();

  if (!methodType || !name) {
    throw new Error("種別と名称は必須です");
  }

  if (!(VALID_METHOD_TYPES as readonly string[]).includes(methodType)) {
    throw new Error("無効な種別です");
  }

  // 名称重複チェック
  const existing = await prisma.paymentMethod.findFirst({
    where: { name, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`決済手段「${name}」は既に登録されています`);
  }

  // details JSON組み立て
  const details = buildDetails(methodType, data);

  // クレカ専用フィールド
  let closingDay: number | null = null;
  let paymentDay: number | null = null;
  let settlementAccountId: number | null = null;

  if (methodType === "credit_card") {
    closingDay = data.closingDay ? Number(data.closingDay) : null;
    paymentDay = data.paymentDay ? Number(data.paymentDay) : null;
    settlementAccountId = data.settlementAccountId
      ? Number(data.settlementAccountId)
      : null;

    if (closingDay !== null && (closingDay < 1 || closingDay > 31)) {
      throw new Error("締め日は1〜31の範囲で指定してください");
    }
    if (paymentDay !== null && (paymentDay < 1 || paymentDay > 31)) {
      throw new Error("引落日は1〜31の範囲で指定してください");
    }

    if (settlementAccountId !== null) {
      const account = await prisma.paymentMethod.findFirst({
        where: { id: settlementAccountId, methodType: "bank_account", isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!account) throw new Error("引落口座が見つからないか無効です");
    }
  }

  const initialBalance = data.initialBalance
    ? Number(data.initialBalance)
    : null;
  const initialBalanceDate = data.initialBalanceDate
    ? new Date(data.initialBalanceDate as string)
    : null;
  const balanceAlertThreshold = data.balanceAlertThreshold
    ? Number(data.balanceAlertThreshold)
    : null;
  const isActive = data.isActive !== false && data.isActive !== "false";

  const availableFor = (data.availableFor as string) || "both";
  if (!(VALID_AVAILABLE_FOR as readonly string[]).includes(availableFor)) {
    throw new Error("無効な利用区分です");
  }

  await prisma.paymentMethod.create({
    data: {
      methodType,
      name,
      details:
        details !== null
          ? (details as Prisma.InputJsonValue)
          : Prisma.DbNull,
      initialBalance,
      initialBalanceDate,
      balanceAlertThreshold,
      closingDay,
      paymentDay,
      settlementAccountId,
      availableFor,
      isActive,
      createdBy: staffId,
    },
  });

  revalidatePath("/accounting/masters/payment-methods");
}

export async function updatePaymentMethod(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const updateData: Record<string, unknown> = {};

  // methodType の決定（更新時 or 既存レコードから取得）
  let effectiveMethodType: string;
  if ("methodType" in data) {
    const methodType = data.methodType as string;
    if (!(VALID_METHOD_TYPES as readonly string[]).includes(methodType)) {
      throw new Error("無効な種別です");
    }
    updateData.methodType = methodType;
    effectiveMethodType = methodType;

    // 種別変更時、credit_card以外ならクレカ専用フィールドをクリア
    if (effectiveMethodType !== "credit_card") {
      updateData.closingDay = null;
      updateData.paymentDay = null;
      updateData.settlementAccountId = null;
    }
  } else {
    const current = await prisma.paymentMethod.findUnique({
      where: { id },
      select: { methodType: true },
    });
    if (!current) throw new Error("決済手段が見つかりません");
    effectiveMethodType = current.methodType;
  }

  if ("name" in data) {
    const name = (data.name as string).trim();
    if (!name) throw new Error("名称は必須です");

    const existing = await prisma.paymentMethod.findFirst({
      where: { name, deletedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`決済手段「${name}」は既に登録されています`);
    }
    updateData.name = name;
  }

  // details JSON再構築
  const hasDetailFields = DETAIL_FIELDS.some((f) => f in data);
  if (hasDetailFields || "methodType" in data) {
    const details = buildDetails(effectiveMethodType, data);
    updateData.details = details ?? Prisma.DbNull;
  }

  // クレカ専用フィールド
  if ("closingDay" in data) {
    const closingDay = data.closingDay ? Number(data.closingDay) : null;
    if (closingDay !== null && (closingDay < 1 || closingDay > 31)) {
      throw new Error("締め日は1〜31の範囲で指定してください");
    }
    updateData.closingDay = closingDay;
  }

  if ("paymentDay" in data) {
    const paymentDay = data.paymentDay ? Number(data.paymentDay) : null;
    if (paymentDay !== null && (paymentDay < 1 || paymentDay > 31)) {
      throw new Error("引落日は1〜31の範囲で指定してください");
    }
    updateData.paymentDay = paymentDay;
  }

  if ("settlementAccountId" in data) {
    const settlementAccountId = data.settlementAccountId
      ? Number(data.settlementAccountId)
      : null;
    if (settlementAccountId !== null) {
      const account = await prisma.paymentMethod.findFirst({
        where: { id: settlementAccountId, methodType: "bank_account", isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!account) throw new Error("引落口座が見つからないか無効です");
    }
    updateData.settlementAccountId = settlementAccountId;
  }

  if ("initialBalance" in data) {
    updateData.initialBalance = data.initialBalance
      ? Number(data.initialBalance)
      : null;
  }

  if ("initialBalanceDate" in data) {
    updateData.initialBalanceDate = data.initialBalanceDate
      ? new Date(data.initialBalanceDate as string)
      : null;
  }

  if ("balanceAlertThreshold" in data) {
    updateData.balanceAlertThreshold = data.balanceAlertThreshold
      ? Number(data.balanceAlertThreshold)
      : null;
  }

  if ("availableFor" in data) {
    const availableFor = data.availableFor as string;
    if (!(VALID_AVAILABLE_FOR as readonly string[]).includes(availableFor)) {
      throw new Error("無効な利用区分です");
    }
    updateData.availableFor = availableFor;
  }

  if ("isActive" in data) {
    updateData.isActive = toBoolean(data.isActive);
  }

  updateData.updatedBy = staffId;

  await prisma.paymentMethod.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/accounting/masters/payment-methods");
}
