"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { ensureCostCentersForActiveProjects } from "@/lib/accounting/cost-centers";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { syncCounterpartiesForCostCenters } from "@/lib/counterparty-sync";

type CostCenterBankAccountDto = {
  id: number;
  bankAccountId: number;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
  memo: string | null;
  isDefault: boolean;
};

type AvailableBankAccountDto = {
  id: number;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
};

async function getEditableCostCenter(costCenterId: number) {
  const costCenter = await prisma.costCenter.findFirst({
    where: { id: costCenterId, deletedAt: null },
    select: { id: true, projectId: true, operatingCompanyId: true },
  });

  if (!costCenter) {
    return { ok: false as const, error: "経理用プロジェクトが見つかりません" };
  }
  if (costCenter.projectId) {
    return {
      ok: false as const,
      error: "CRMプロジェクトと連携している行は、CRMプロジェクト側の口座管理を使用してください",
    };
  }
  if (!costCenter.operatingCompanyId) {
    return {
      ok: false as const,
      error: "先に運営法人を選択してください",
    };
  }

  return { ok: true as const, costCenter };
}

async function validateOperatingCompany(operatingCompanyId: number | null) {
  if (!operatingCompanyId) return true;
  const company = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, isActive: true },
    select: { id: true },
  });
  return !!company;
}

export async function createCostCenter(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("accounting");
    const session = await getSession();
    const staffId = session.id;

    const name = (data.name as string).trim();
    const projectId = data.projectId ? Number(data.projectId) : null;
    const operatingCompanyId =
      !projectId && data.operatingCompanyId ? Number(data.operatingCompanyId) : null;
    const isActive = data.isActive !== false && data.isActive !== "false";

    if (!name) {
      return err("名称は必須です");
    }

    // 名称重複チェック
    const existing = await prisma.costCenter.findFirst({
      where: { name, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return err(`按分先「${name}」は既に登録されています`);
    }

    // プロジェクトの存在チェック
    if (projectId) {
      const project = await prisma.masterProject.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) {
        return err("指定されたプロジェクトが見つかりません");
      }
    }

    if (!(await validateOperatingCompany(operatingCompanyId))) {
      return err("指定された運営法人が見つかりません");
    }

    await prisma.costCenter.create({
      data: {
        name,
        projectId,
        operatingCompanyId,
        isActive,
        createdBy: staffId,
      },
    });

    await ensureCostCentersForActiveProjects();
    await syncCounterpartiesForCostCenters(staffId);
    revalidatePath("/accounting/masters/cost-centers");
    revalidatePath("/accounting/masters/counterparties");
    return ok();
  } catch (e) {
    console.error("[createCostCenter] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateCostCenter(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("accounting");
    const session = await getSession();
    const staffId = session.id;

    const current = await prisma.costCenter.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!current) {
      return err("経理用プロジェクトが見つかりません");
    }

    const updateData: Record<string, unknown> = {};
    let nextProjectId = current.projectId;

    if ("name" in data) {
      const name = (data.name as string).trim();
      if (!name) return err("名称は必須です");

      // 名称重複チェック（自分自身は除く）
      const existing = await prisma.costCenter.findFirst({
        where: { name, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        return err(`按分先「${name}」は既に登録されています`);
      }
      updateData.name = name;
    }

    if ("projectId" in data) {
      const projectId = data.projectId ? Number(data.projectId) : null;
      if (projectId) {
        const project = await prisma.masterProject.findUnique({
          where: { id: projectId },
          select: { id: true },
        });
        if (!project) {
          return err("指定されたプロジェクトが見つかりません");
        }
      }
      nextProjectId = projectId;
      updateData.projectId = projectId;
    }

    if ("operatingCompanyId" in data || "projectId" in data) {
      const operatingCompanyId =
        nextProjectId || !data.operatingCompanyId ? null : Number(data.operatingCompanyId);
      if (!(await validateOperatingCompany(operatingCompanyId))) {
        return err("指定された運営法人が見つかりません");
      }
      updateData.operatingCompanyId = operatingCompanyId;
    }

    if ("isActive" in data) {
      updateData.isActive = toBoolean(data.isActive);
    }

    updateData.updatedBy = staffId;

    await prisma.$transaction(async (tx) => {
      await tx.costCenter.update({
        where: { id },
        data: updateData,
      });

      if (nextProjectId) {
        await tx.costCenterBankAccount.deleteMany({ where: { costCenterId: id } });
      }
    });

    await ensureCostCentersForActiveProjects();
    await syncCounterpartiesForCostCenters(staffId);
    revalidatePath("/accounting/masters/cost-centers");
    revalidatePath("/accounting/masters/counterparties");
    return ok();
  } catch (e) {
    console.error("[updateCostCenter] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function getCostCenterBankAccounts(
  costCenterId: number
): Promise<CostCenterBankAccountDto[]> {
  const records = await prisma.costCenterBankAccount.findMany({
    where: { costCenterId },
    include: {
      bankAccount: {
        select: {
          id: true,
          bankName: true,
          branchName: true,
          accountType: true,
          accountNumber: true,
          accountHolderName: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });

  return records.map((record) => ({
    id: record.id,
    bankAccountId: record.bankAccountId,
    bankName: record.bankAccount.bankName,
    branchName: record.bankAccount.branchName,
    accountType: record.bankAccount.accountType,
    accountNumber: record.bankAccount.accountNumber,
    accountHolderName: record.bankAccount.accountHolderName,
    memo: record.memo,
    isDefault: record.isDefault,
  }));
}

export async function getAvailableCostCenterBankAccounts(
  costCenterId: number
): Promise<ActionResult<AvailableBankAccountDto[]>> {
  try {
    const editable = await getEditableCostCenter(costCenterId);
    if (!editable.ok) return err(editable.error);

    const existing = await prisma.costCenterBankAccount.findMany({
      where: { costCenterId },
      select: { bankAccountId: true },
    });
    const existingIds = existing.map((record) => record.bankAccountId);

    const accounts = await prisma.operatingCompanyBankAccount.findMany({
      where: {
        operatingCompanyId: editable.costCenter.operatingCompanyId!,
        deletedAt: null,
        ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        bankName: true,
        branchName: true,
        accountType: true,
        accountNumber: true,
        accountHolderName: true,
      },
    });

    return ok(accounts);
  } catch (e) {
    console.error("[getAvailableCostCenterBankAccounts] error:", e);
    return err(e instanceof Error ? e.message : "銀行口座の取得に失敗しました");
  }
}

export async function addCostCenterBankAccount(data: {
  costCenterId: number;
  bankAccountId: number;
  memo?: string | null;
}): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("accounting");
    const editable = await getEditableCostCenter(data.costCenterId);
    if (!editable.ok) return err(editable.error);

    const bankAccount = await prisma.operatingCompanyBankAccount.findFirst({
      where: { id: data.bankAccountId, deletedAt: null },
      select: { operatingCompanyId: true },
    });
    if (!bankAccount) return err("銀行口座が見つかりません");
    if (bankAccount.operatingCompanyId !== editable.costCenter.operatingCompanyId) {
      return err("この口座は選択中の運営法人に属していません");
    }

    const existing = await prisma.costCenterBankAccount.findUnique({
      where: {
        costCenterId_bankAccountId: {
          costCenterId: data.costCenterId,
          bankAccountId: data.bankAccountId,
        },
      },
    });
    if (existing) return err("この口座は既に登録されています");

    await prisma.costCenterBankAccount.create({
      data: {
        costCenterId: data.costCenterId,
        bankAccountId: data.bankAccountId,
        memo: data.memo?.trim() || null,
      },
    });

    revalidatePath("/accounting/masters/cost-centers");
    return ok();
  } catch (e) {
    console.error("[addCostCenterBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "銀行口座の追加に失敗しました");
  }
}

export async function createAndAddCostCenterBankAccount(data: {
  costCenterId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountType?: string;
  accountNumber: string;
  accountHolderName: string;
  memo?: string | null;
}): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("accounting");
    const editable = await getEditableCostCenter(data.costCenterId);
    if (!editable.ok) return err(editable.error);

    await prisma.$transaction(async (tx) => {
      const bankAccount = await tx.operatingCompanyBankAccount.create({
        data: {
          operatingCompanyId: editable.costCenter.operatingCompanyId!,
          bankName: data.bankName.trim(),
          bankCode: data.bankCode.trim(),
          branchName: data.branchName.trim(),
          branchCode: data.branchCode.trim(),
          accountType: data.accountType || "普通",
          accountNumber: data.accountNumber.trim(),
          accountHolderName: data.accountHolderName.trim(),
          note: data.memo?.trim() || null,
        },
      });

      await tx.costCenterBankAccount.create({
        data: {
          costCenterId: data.costCenterId,
          bankAccountId: bankAccount.id,
          memo: data.memo?.trim() || null,
        },
      });
    });

    revalidatePath("/accounting/masters/cost-centers");
    return ok();
  } catch (e) {
    console.error("[createAndAddCostCenterBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "銀行口座の追加に失敗しました");
  }
}

export async function setCostCenterDefaultBankAccount(
  costCenterId: number,
  costCenterBankAccountId: number | null
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("accounting");
    const editable = await getEditableCostCenter(costCenterId);
    if (!editable.ok) return err(editable.error);

    if (costCenterBankAccountId === null) {
      await prisma.costCenterBankAccount.updateMany({
        where: { costCenterId, isDefault: true },
        data: { isDefault: false },
      });
      revalidatePath("/accounting/masters/cost-centers");
      return ok();
    }

    const record = await prisma.costCenterBankAccount.findUnique({
      where: { id: costCenterBankAccountId },
      select: { costCenterId: true },
    });
    if (!record) return err("銀行口座が見つかりません");
    if (record.costCenterId !== costCenterId) return err("経理用プロジェクトが一致しません");

    await prisma.$transaction(async (tx) => {
      await tx.costCenterBankAccount.updateMany({
        where: { costCenterId, isDefault: true },
        data: { isDefault: false },
      });
      await tx.costCenterBankAccount.update({
        where: { id: costCenterBankAccountId },
        data: { isDefault: true },
      });
    });

    revalidatePath("/accounting/masters/cost-centers");
    return ok();
  } catch (e) {
    console.error("[setCostCenterDefaultBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "既定口座の設定に失敗しました");
  }
}

export async function updateCostCenterBankAccountMemo(
  costCenterBankAccountId: number,
  memo: string | null
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("accounting");
    const record = await prisma.costCenterBankAccount.findUnique({
      where: { id: costCenterBankAccountId },
      select: { costCenterId: true },
    });
    if (!record) return err("銀行口座が見つかりません");

    const editable = await getEditableCostCenter(record.costCenterId);
    if (!editable.ok) return err(editable.error);

    await prisma.costCenterBankAccount.update({
      where: { id: costCenterBankAccountId },
      data: { memo: memo?.trim() || null },
    });

    revalidatePath("/accounting/masters/cost-centers");
    return ok();
  } catch (e) {
    console.error("[updateCostCenterBankAccountMemo] error:", e);
    return err(e instanceof Error ? e.message : "メモの更新に失敗しました");
  }
}

export async function deleteCostCenterBankAccount(
  costCenterBankAccountId: number
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("accounting");
    const record = await prisma.costCenterBankAccount.findUnique({
      where: { id: costCenterBankAccountId },
      select: { costCenterId: true },
    });
    if (!record) return err("銀行口座が見つかりません");

    const editable = await getEditableCostCenter(record.costCenterId);
    if (!editable.ok) return err(editable.error);

    await prisma.costCenterBankAccount.delete({ where: { id: costCenterBankAccountId } });
    revalidatePath("/accounting/masters/cost-centers");
    return ok();
  } catch (e) {
    console.error("[deleteCostCenterBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "銀行口座の削除に失敗しました");
  }
}
