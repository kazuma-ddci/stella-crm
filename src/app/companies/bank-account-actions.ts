"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addBankAccount(
  companyId: number,
  data: Record<string, unknown>
) {
  const bankAccount = await prisma.stellaCompanyBankAccount.create({
    data: {
      companyId,
      bankName: data.bankName as string,
      bankCode: data.bankCode as string,
      branchName: data.branchName as string,
      branchCode: data.branchCode as string,
      accountNumber: data.accountNumber as string,
      accountHolderName: data.accountHolderName as string,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/companies");
  return {
    id: bankAccount.id,
    companyId: bankAccount.companyId,
    bankName: bankAccount.bankName,
    bankCode: bankAccount.bankCode,
    branchName: bankAccount.branchName,
    branchCode: bankAccount.branchCode,
    accountNumber: bankAccount.accountNumber,
    accountHolderName: bankAccount.accountHolderName,
    note: bankAccount.note,
    createdAt: bankAccount.createdAt.toISOString(),
    updatedAt: bankAccount.updatedAt.toISOString(),
  };
}

export async function updateBankAccount(
  id: number,
  data: Record<string, unknown>
) {
  const existing = await prisma.stellaCompanyBankAccount.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Bank account not found");

  const bankAccount = await prisma.stellaCompanyBankAccount.update({
    where: { id },
    data: {
      bankName: data.bankName as string,
      bankCode: data.bankCode as string,
      branchName: data.branchName as string,
      branchCode: data.branchCode as string,
      accountNumber: data.accountNumber as string,
      accountHolderName: data.accountHolderName as string,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/companies");
  return {
    id: bankAccount.id,
    companyId: bankAccount.companyId,
    bankName: bankAccount.bankName,
    bankCode: bankAccount.bankCode,
    branchName: bankAccount.branchName,
    branchCode: bankAccount.branchCode,
    accountNumber: bankAccount.accountNumber,
    accountHolderName: bankAccount.accountHolderName,
    note: bankAccount.note,
    createdAt: bankAccount.createdAt.toISOString(),
    updatedAt: bankAccount.updatedAt.toISOString(),
  };
}

export async function deleteBankAccount(id: number) {
  // 論理削除：deletedAtに現在日時を設定
  await prisma.stellaCompanyBankAccount.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/companies");
}
