"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";

type BankAccountDto = {
  id: number;
  companyId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function addBankAccount(
  companyId: number,
  data: Record<string, unknown>
): Promise<ActionResult<BankAccountDto>> {
  try {
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
    return ok({
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
    });
  } catch (e) {
    console.error("[addBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateBankAccount(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult<BankAccountDto>> {
  try {
    const existing = await prisma.stellaCompanyBankAccount.findUnique({
      where: { id },
    });
    if (!existing) return err("銀行口座が見つかりません");

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
    return ok({
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
    });
  } catch (e) {
    console.error("[updateBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteBankAccount(id: number): Promise<ActionResult> {
  try {
    // 論理削除：deletedAtに現在日時を設定
    await prisma.stellaCompanyBankAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/companies");
    return ok();
  } catch (e) {
    console.error("[deleteBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
