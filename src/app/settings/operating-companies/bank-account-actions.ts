"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireMasterDataEditPermission,
  requireProjectMasterDataEditPermission,
} from "@/lib/auth/master-data-permission";
import { ok, err, type ActionResult } from "@/lib/action-result";

async function requireOperatingCompanyEditPermission() {
  try {
    await requireMasterDataEditPermission();
  } catch {
    await requireProjectMasterDataEditPermission("accounting");
  }
}

type OperatingCompanyBankAccountDto = {
  id: number;
  operatingCompanyId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function addOperatingCompanyBankAccount(
  operatingCompanyId: number,
  data: Record<string, unknown>
): Promise<ActionResult<OperatingCompanyBankAccountDto>> {
  try {
    await requireOperatingCompanyEditPermission();
    const isDefault = !!data.isDefault;

    const bankAccount = await prisma.operatingCompanyBankAccount.create({
      data: {
        operatingCompanyId,
        bankName: data.bankName as string,
        bankCode: data.bankCode as string,
        branchName: data.branchName as string,
        branchCode: data.branchCode as string,
        accountType: (data.accountType as string) || "普通",
        accountNumber: data.accountNumber as string,
        accountHolderName: data.accountHolderName as string,
        note: (data.note as string) || null,
        isDefault,
      },
    });

    if (isDefault) {
      await prisma.operatingCompanyBankAccount.updateMany({
        where: {
          operatingCompanyId,
          id: { not: bankAccount.id },
          deletedAt: null,
        },
        data: { isDefault: false },
      });
    }

    revalidatePath("/settings/projects");
    revalidatePath("/accounting/masters/cost-centers");
    return ok({
      id: bankAccount.id,
      operatingCompanyId: bankAccount.operatingCompanyId,
      bankName: bankAccount.bankName,
      bankCode: bankAccount.bankCode,
      branchName: bankAccount.branchName,
      branchCode: bankAccount.branchCode,
      accountType: bankAccount.accountType,
      accountNumber: bankAccount.accountNumber,
      accountHolderName: bankAccount.accountHolderName,
      note: bankAccount.note,
      isDefault: bankAccount.isDefault,
      createdAt: bankAccount.createdAt.toISOString(),
      updatedAt: bankAccount.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[addOperatingCompanyBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateOperatingCompanyBankAccount(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult<OperatingCompanyBankAccountDto>> {
  try {
    await requireOperatingCompanyEditPermission();
    const existing = await prisma.operatingCompanyBankAccount.findUnique({
      where: { id },
    });
    if (!existing) return err("銀行口座が見つかりません");

    const isDefault = !!data.isDefault;

    const bankAccount = await prisma.operatingCompanyBankAccount.update({
      where: { id },
      data: {
        bankName: data.bankName as string,
        bankCode: data.bankCode as string,
        branchName: data.branchName as string,
        branchCode: data.branchCode as string,
        accountType: (data.accountType as string) || "普通",
        accountNumber: data.accountNumber as string,
        accountHolderName: data.accountHolderName as string,
        note: (data.note as string) || null,
        isDefault,
      },
    });

    if (isDefault) {
      await prisma.operatingCompanyBankAccount.updateMany({
        where: {
          operatingCompanyId: bankAccount.operatingCompanyId,
          id: { not: bankAccount.id },
          deletedAt: null,
        },
        data: { isDefault: false },
      });
    }

    revalidatePath("/settings/projects");
    revalidatePath("/accounting/masters/cost-centers");
    return ok({
      id: bankAccount.id,
      operatingCompanyId: bankAccount.operatingCompanyId,
      bankName: bankAccount.bankName,
      bankCode: bankAccount.bankCode,
      branchName: bankAccount.branchName,
      branchCode: bankAccount.branchCode,
      accountType: bankAccount.accountType,
      accountNumber: bankAccount.accountNumber,
      accountHolderName: bankAccount.accountHolderName,
      note: bankAccount.note,
      isDefault: bankAccount.isDefault,
      createdAt: bankAccount.createdAt.toISOString(),
      updatedAt: bankAccount.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[updateOperatingCompanyBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteOperatingCompanyBankAccount(
  id: number
): Promise<ActionResult> {
  try {
    await requireOperatingCompanyEditPermission();
    await prisma.operatingCompanyBankAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/settings/projects");
    revalidatePath("/accounting/masters/cost-centers");
    return ok();
  } catch (e) {
    console.error("[deleteOperatingCompanyBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
