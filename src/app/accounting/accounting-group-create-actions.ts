"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import { generateOtherCounterpartyDisplayId } from "@/lib/counterparty-sync";
import { ensureCostCentersForActiveProjects } from "@/lib/accounting/cost-centers";
import {
  recalcInvoiceGroupActualPaymentDate,
  recalcPaymentGroupActualPaymentDate,
  syncInvoiceGroupPaymentStateFromRecords,
  syncPaymentGroupPaymentStateFromRecords,
} from "@/lib/accounting/sync-payment-date";

export type AccountingGroupKind = "invoice" | "payment";

export type AccountingGroupCreateOptions = {
  operatingCompanies: { id: number; name: string }[];
  projects: { id: number; name: string }[];
  counterparties: {
    id: number;
    name: string;
    displayId: string | null;
    companyId: number | null;
    companyCode: string | null;
  }[];
  expenseCategories: { id: number; name: string; type: string; projectId: number }[];
  allocationTemplates: {
    id: number;
    name: string;
    lines: {
      label: string | null;
      costCenterName: string | null;
      allocationRate: number;
    }[];
  }[];
  sourceEntry: {
    id: number;
    direction: AccountingGroupKind | null;
    operatingCompanyId: number;
    amount: number;
    remainingAmount: number;
    transactionDate: string;
    description: string;
  } | null;
};

export type CreateAccountingGroupInput = {
  groupKind: AccountingGroupKind;
  sourceEntryId?: number | null;
  operatingCompanyId: number;
  projectId: number;
  counterpartyId?: number | null;
  customCounterpartyName?: string | null;
  expectedDate: string;
  accountingDate: string;
  note?: string | null;
  lines: {
    expenseCategoryId: number;
    amount: number;
    taxRate: number;
    allocationTemplateId?: number | null;
    isWithholdingTarget?: boolean;
    withholdingTaxRate?: number | null;
    withholdingTaxAmount?: number | null;
    note?: string | null;
  }[];
};

type EntryMeta = {
  id: number;
  direction: AccountingGroupKind | null;
  operatingCompanyId: number;
  amount: number;
  remainingAmount: number;
  transactionDate: Date;
  description: string;
  excluded: boolean;
};

function calcIncludedTax(total: number, taxRate: number) {
  if (taxRate <= 0) return 0;
  return Math.floor(total - total / (1 + taxRate / 100));
}

async function getEntryMeta(entryId: number): Promise<EntryMeta | null> {
  const entry = await prisma.bankStatementEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      operatingCompanyId: true,
      incomingAmount: true,
      outgoingAmount: true,
      transactionDate: true,
      description: true,
      excluded: true,
      groupLinks: { select: { amount: true } },
    },
  });
  if (!entry) return null;

  const amount =
    (entry.incomingAmount ?? 0) > 0
      ? entry.incomingAmount!
      : (entry.outgoingAmount ?? 0) > 0
        ? entry.outgoingAmount!
        : 0;
  const direction =
    (entry.incomingAmount ?? 0) > 0
      ? "invoice"
      : (entry.outgoingAmount ?? 0) > 0
        ? "payment"
        : null;
  const linkedAmount = entry.groupLinks.reduce((sum, link) => sum + link.amount, 0);

  return {
    id: entry.id,
    direction,
    operatingCompanyId: entry.operatingCompanyId,
    amount,
    remainingAmount: amount - linkedAmount,
    transactionDate: entry.transactionDate,
    description: entry.description,
    excluded: entry.excluded,
  };
}

async function getProjectDefaultCostCenterId(projectId: number) {
  const project = await prisma.masterProject.findUnique({
    where: { id: projectId },
    select: { defaultCostCenterId: true },
  });
  return project?.defaultCostCenterId ?? null;
}

async function resolveAccountingGroupCounterpartyId(
  tx: Prisma.TransactionClient,
  input: {
    counterpartyId: number | null;
    customCounterpartyName: string | null;
    staffId: number;
  }
) {
  if (input.counterpartyId) {
    const existing = await tx.counterparty.findFirst({
      where: {
        id: input.counterpartyId,
        deletedAt: null,
        mergedIntoId: null,
        isActive: true,
      },
      select: { id: true },
    });
    if (!existing) throw new Error("取引先が見つかりません");
    return existing.id;
  }

  const name = input.customCounterpartyName?.trim();
  if (!name) throw new Error("取引先を選択するか、取引先名を入力してください");

  const existing = await tx.counterparty.findFirst({
    where: { name, deletedAt: null, mergedIntoId: null, isActive: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const displayId = await generateOtherCounterpartyDisplayId(tx);
  const created = await tx.counterparty.create({
    data: {
      displayId,
      name,
      counterpartyType: "other",
      isActive: true,
      createdBy: input.staffId,
    },
    select: { id: true },
  });
  return created.id;
}

export async function getAccountingGroupCreateOptions(
  sourceEntryId?: number | null
): Promise<ActionResult<AccountingGroupCreateOptions>> {
  await requireStaffForAccounting("view");
  try {
    await ensureCostCentersForActiveProjects();
    const [operatingCompanies, projects, counterparties, expenseCategories, allocationTemplates, sourceEntry] =
      await Promise.all([
        prisma.operatingCompany.findMany({
          where: { isActive: true },
          select: { id: true, companyName: true },
          orderBy: { id: "asc" },
        }),
        prisma.masterProject.findMany({
          where: { isActive: true },
          select: { id: true, name: true, defaultCostCenter: { select: { name: true } } },
          orderBy: { displayOrder: "asc" },
        }),
        prisma.counterparty.findMany({
          where: { deletedAt: null, mergedIntoId: null, isActive: true },
          select: {
            id: true,
            name: true,
            displayId: true,
            companyId: true,
            company: { select: { companyCode: true } },
          },
          orderBy: [{ displayId: "asc" }, { name: "asc" }],
        }),
        prisma.expenseCategory.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true, name: true, type: true, projectId: true },
          orderBy: [{ projectId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        }),
        prisma.allocationTemplate.findMany({
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            name: true,
            lines: {
              select: {
                label: true,
                allocationRate: true,
                costCenter: { select: { name: true } },
              },
              orderBy: { id: "asc" },
            },
          },
          orderBy: { name: "asc" },
        }),
        sourceEntryId ? getEntryMeta(sourceEntryId) : Promise.resolve(null),
      ]);

    return ok({
      operatingCompanies: operatingCompanies.map((company) => ({
        id: company.id,
        name: company.companyName,
      })),
      projects: projects.map((project) => ({
        id: project.id,
        name: project.defaultCostCenter?.name ?? project.name,
      })),
      counterparties: counterparties.map((counterparty) => ({
        id: counterparty.id,
        name: counterparty.name,
        displayId: counterparty.displayId,
        companyId: counterparty.companyId,
        companyCode: counterparty.company?.companyCode ?? null,
      })),
      expenseCategories,
      allocationTemplates: allocationTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        lines: template.lines.map((line) => ({
          label: line.label,
          costCenterName: line.costCenter?.name ?? null,
          allocationRate: Number(line.allocationRate),
        })),
      })),
      sourceEntry: sourceEntry
        ? {
            id: sourceEntry.id,
            direction: sourceEntry.direction,
            operatingCompanyId: sourceEntry.operatingCompanyId,
            amount: sourceEntry.amount,
            remainingAmount: sourceEntry.remainingAmount,
            transactionDate: sourceEntry.transactionDate.toISOString().slice(0, 10),
            description: sourceEntry.description,
          }
        : null,
    });
  } catch (e) {
    console.error("[getAccountingGroupCreateOptions] error:", e);
    return err(e instanceof Error ? e.message : "作成フォームの取得に失敗しました");
  }
}

export async function createAccountingGroup(
  input: CreateAccountingGroupInput
): Promise<ActionResult<{ groupKind: AccountingGroupKind; groupId: number; label: string }>> {
  const session = await requireStaffForAccounting("edit");
  try {
    if (input.groupKind !== "invoice" && input.groupKind !== "payment") {
      return err("種別が不正です");
    }
    if (!Number.isInteger(input.operatingCompanyId) || input.operatingCompanyId <= 0) {
      return err("法人を選択してください");
    }
    if (!Number.isInteger(input.projectId) || input.projectId <= 0) {
      return err("プロジェクトを選択してください");
    }
    if (
      (!input.counterpartyId || !Number.isInteger(input.counterpartyId) || input.counterpartyId <= 0) &&
      !input.customCounterpartyName?.trim()
    ) {
      return err("取引先を選択するか、取引先名を入力してください");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expectedDate)) {
      return err("予定日を入力してください");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.accountingDate)) {
      return err("計上日を入力してください");
    }
    if (input.lines.length === 0) return err("明細を1件以上入力してください");
    for (const line of input.lines) {
      if (!Number.isInteger(line.expenseCategoryId) || line.expenseCategoryId <= 0) {
        return err("すべての明細で費目を選択してください");
      }
      if (!Number.isInteger(line.amount) || line.amount <= 0) {
        return err("明細金額は1円以上の整数で入力してください");
      }
      if (!Number.isInteger(line.taxRate) || line.taxRate < 0 || line.taxRate > 100) {
        return err("税率が不正です");
      }
      if (
        line.allocationTemplateId !== undefined &&
        line.allocationTemplateId !== null &&
        (!Number.isInteger(line.allocationTemplateId) || line.allocationTemplateId <= 0)
      ) {
        return err("按分テンプレートが不正です");
      }
      if (input.groupKind === "invoice" && line.isWithholdingTarget) {
        return err("源泉徴収は支払グループのみ設定できます");
      }
      if (line.isWithholdingTarget) {
        if (
          line.withholdingTaxRate === null ||
          line.withholdingTaxRate === undefined ||
          Number.isNaN(line.withholdingTaxRate) ||
          line.withholdingTaxRate < 0 ||
          line.withholdingTaxRate > 100
        ) {
          return err("源泉徴収税率が不正です");
        }
        if (
          line.withholdingTaxAmount === null ||
          line.withholdingTaxAmount === undefined ||
          !Number.isInteger(line.withholdingTaxAmount) ||
          line.withholdingTaxAmount < 0
        ) {
          return err("源泉徴収税額が不正です");
        }
      }
    }

    const sourceEntry = input.sourceEntryId ? await getEntryMeta(input.sourceEntryId) : null;
    if (input.sourceEntryId && !sourceEntry) return err("入出金履歴が見つかりません");
    if (sourceEntry) {
      if (sourceEntry.excluded) {
        return err("除外済みの入出金履歴からは作成できません。先に除外を解除してください");
      }
      if (!sourceEntry.direction) return err("入金/出金が0円のため作成できません");
      if (sourceEntry.direction !== input.groupKind) {
        return err(
          sourceEntry.direction === "invoice"
            ? "入金履歴からは請求グループのみ作成できます"
            : "出金履歴からは支払グループのみ作成できます"
        );
      }
      if (sourceEntry.operatingCompanyId !== input.operatingCompanyId) {
        return err("入出金履歴の法人と作成するグループの法人が一致していません");
      }
      if (sourceEntry.remainingAmount <= 0) {
        return err("この入出金履歴はすでに全額紐づいています");
      }
    }

    const allocationTemplateIds = [
      ...new Set(
        input.lines
          .map((line) => line.allocationTemplateId ?? null)
          .filter((id): id is number => id !== null)
      ),
    ];
    const [company, project, categories, allocationTemplates] = await Promise.all([
      prisma.operatingCompany.findFirst({
        where: { id: input.operatingCompanyId, isActive: true },
        select: { id: true },
      }),
      prisma.masterProject.findFirst({
        where: { id: input.projectId, isActive: true },
        select: { id: true },
      }),
      prisma.expenseCategory.findMany({
        where: {
          id: { in: input.lines.map((line) => line.expenseCategoryId) },
          projectId: input.projectId,
          deletedAt: null,
          isActive: true,
          type: { in: [input.groupKind === "invoice" ? "revenue" : "expense", "both"] },
        },
        select: { id: true },
      }),
      allocationTemplateIds.length > 0
        ? prisma.allocationTemplate.findMany({
            where: { id: { in: allocationTemplateIds }, deletedAt: null, isActive: true },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    if (!company) return err("法人が見つかりません");
    if (!project) return err("プロジェクトが見つかりません");
    if (categories.length !== new Set(input.lines.map((line) => line.expenseCategoryId)).size) {
      return err("選択された費目に利用できないものがあります");
    }
    if (allocationTemplates.length !== allocationTemplateIds.length) {
      return err("選択された按分テンプレートに利用できないものがあります");
    }

    const costCenterId = await getProjectDefaultCostCenterId(input.projectId);
    const totalAmount = input.lines.reduce((sum, line) => sum + line.amount, 0);
    const taxAmount = input.lines.reduce(
      (sum, line) => sum + calcIncludedTax(line.amount, line.taxRate),
      0
    );
    const subtotal = totalAmount - taxAmount;
    const expectedDate = new Date(input.expectedDate);
    const accountingDate = new Date(input.accountingDate);
    const groupNote = input.note?.trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      const resolvedCounterpartyId = await resolveAccountingGroupCounterpartyId(tx, {
        counterpartyId: input.counterpartyId ?? null,
        customCounterpartyName: input.customCounterpartyName ?? null,
        staffId: session.id,
      });

      if (input.groupKind === "invoice") {
        const group = await tx.invoiceGroup.create({
          data: {
            counterpartyId: resolvedCounterpartyId,
            operatingCompanyId: input.operatingCompanyId,
            invoiceDate: expectedDate,
            paymentDueDate: expectedDate,
            expectedPaymentDate: expectedDate,
            subtotal,
            taxAmount,
            totalAmount,
            projectId: input.projectId,
            status: "awaiting_accounting",
            createdBy: session.id,
            remarks: groupNote,
          },
        });

        for (const line of input.lines) {
          const lineTax = calcIncludedTax(line.amount, line.taxRate);
          await tx.transaction.create({
            data: {
              invoiceGroupId: group.id,
              counterpartyId: resolvedCounterpartyId,
              expenseCategoryId: line.expenseCategoryId,
              projectId: input.projectId,
              type: "revenue",
              amount: line.amount,
              taxAmount: lineTax,
              taxRate: line.taxRate,
              taxType: "tax_included",
              periodFrom: accountingDate,
              periodTo: accountingDate,
              scheduledPaymentDate: expectedDate,
              status: "awaiting_accounting",
              note: line.note?.trim() || groupNote,
              sourceType: "manual",
              allocationTemplateId: line.allocationTemplateId ?? null,
              costCenterId: line.allocationTemplateId ? null : costCenterId,
              createdBy: session.id,
            },
          });
        }

        if (sourceEntry) {
          const link = await tx.bankStatementEntryGroupLink.create({
            data: {
              bankStatementEntryId: sourceEntry.id,
              invoiceGroupId: group.id,
              amount: sourceEntry.remainingAmount,
              note: groupNote,
              createdBy: session.id,
            },
          });
          await tx.invoiceGroupReceipt.create({
            data: {
              invoiceGroupId: group.id,
              receivedDate: sourceEntry.transactionDate,
              amount: sourceEntry.remainingAmount,
              comment: groupNote,
              recordSource: "bank_statement",
              createdById: session.id,
              bankStatementEntryGroupLinkId: link.id,
            },
          });
          await recalcInvoiceGroupActualPaymentDate(tx, group.id);
          await syncInvoiceGroupPaymentStateFromRecords(tx, group.id);
        }

        return { groupKind: "invoice" as const, groupId: group.id, label: `請求#${group.id}` };
      }

      const group = await tx.paymentGroup.create({
        data: {
          counterpartyId: resolvedCounterpartyId,
          operatingCompanyId: input.operatingCompanyId,
          expectedPaymentDate: expectedDate,
          paymentDueDate: expectedDate,
          totalAmount,
          taxAmount,
          projectId: input.projectId,
          paymentType: "direct",
          status: "awaiting_accounting",
          createdBy: session.id,
        },
      });
      const referenceCode = `PG-${String(group.id).padStart(4, "0")}`;
      await tx.paymentGroup.update({
        where: { id: group.id },
        data: { referenceCode },
      });

      for (const line of input.lines) {
        const lineTax = calcIncludedTax(line.amount, line.taxRate);
        await tx.transaction.create({
          data: {
            paymentGroupId: group.id,
            counterpartyId: resolvedCounterpartyId,
            expenseCategoryId: line.expenseCategoryId,
            costCenterId: line.allocationTemplateId ? null : costCenterId,
            allocationTemplateId: line.allocationTemplateId ?? null,
            projectId: input.projectId,
            type: "expense",
            amount: line.amount,
            taxAmount: lineTax,
            taxRate: line.taxRate,
            taxType: "tax_included",
            periodFrom: accountingDate,
            periodTo: accountingDate,
            paymentDueDate: expectedDate,
            scheduledPaymentDate: expectedDate,
            status: "awaiting_accounting",
            note: line.note?.trim() || groupNote,
            sourceType: "manual",
            isWithholdingTarget: !!line.isWithholdingTarget,
            withholdingTaxRate: line.isWithholdingTarget ? line.withholdingTaxRate ?? null : null,
            withholdingTaxAmount: line.isWithholdingTarget ? line.withholdingTaxAmount ?? null : null,
            netPaymentAmount: line.isWithholdingTarget
              ? line.amount - (line.withholdingTaxAmount ?? 0)
              : null,
            createdBy: session.id,
          },
        });
      }

      if (sourceEntry) {
        const link = await tx.bankStatementEntryGroupLink.create({
          data: {
            bankStatementEntryId: sourceEntry.id,
            paymentGroupId: group.id,
            amount: sourceEntry.remainingAmount,
            note: groupNote,
            createdBy: session.id,
          },
        });
        await tx.paymentGroupPayment.create({
          data: {
            paymentGroupId: group.id,
            paidDate: sourceEntry.transactionDate,
            amount: sourceEntry.remainingAmount,
            comment: groupNote,
            recordSource: "bank_statement",
            createdById: session.id,
            bankStatementEntryGroupLinkId: link.id,
          },
        });
        await recalcPaymentGroupActualPaymentDate(tx, group.id);
        await syncPaymentGroupPaymentStateFromRecords(tx, group.id);
      }

      return { groupKind: "payment" as const, groupId: group.id, label: referenceCode };
    });

    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/workflow");
    revalidatePath("/accounting/workflow/group-detail");
    return ok(result);
  } catch (e) {
    console.error("[createAccountingGroup] error:", e);
    return err(e instanceof Error ? e.message : "請求/支払グループの作成に失敗しました");
  }
}
