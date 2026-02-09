"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addOperatingCompanyBankAccount(
  operatingCompanyId: number,
  data: Record<string, unknown>
) {
  await requireMasterDataEditPermission();
  const bankAccount = await prisma.operatingCompanyBankAccount.create({
    data: {
      operatingCompanyId,
      bankName: data.bankName as string,
      bankCode: data.bankCode as string,
      branchName: data.branchName as string,
      branchCode: data.branchCode as string,
      accountNumber: data.accountNumber as string,
      accountHolderName: data.accountHolderName as string,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/settings/operating-companies");
  return {
    id: bankAccount.id,
    operatingCompanyId: bankAccount.operatingCompanyId,
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

export async function updateOperatingCompanyBankAccount(
  id: number,
  data: Record<string, unknown>
) {
  await requireMasterDataEditPermission();
  const existing = await prisma.operatingCompanyBankAccount.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Bank account not found");

  const bankAccount = await prisma.operatingCompanyBankAccount.update({
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

  revalidatePath("/settings/operating-companies");
  return {
    id: bankAccount.id,
    operatingCompanyId: bankAccount.operatingCompanyId,
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

export async function deleteOperatingCompanyBankAccount(id: number) {
  await requireMasterDataEditPermission();
  await prisma.operatingCompanyBankAccount.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/settings/operating-companies");
}
