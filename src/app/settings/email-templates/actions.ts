"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

const VALID_TEMPLATE_TYPES = ["sending", "request"] as const;

export async function createInvoiceTemplate(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const name = ((data.name as string) ?? "").trim();
  const templateType = data.templateType as string;
  const operatingCompanyId = Number(data.operatingCompanyId);
  const projectId = data.projectId ? Number(data.projectId) : null;
  const emailSubjectTemplate = ((data.emailSubjectTemplate as string) ?? "").trim();
  const emailBodyTemplate = ((data.emailBodyTemplate as string) ?? "").trim();
  const isDefault = toBoolean(data.isDefault);

  if (!name || !templateType || !operatingCompanyId || !emailSubjectTemplate || !emailBodyTemplate) {
    return err("テンプレート名、種別、運営法人、メール件名、メール本文は必須です");
  }

  if (!(VALID_TEMPLATE_TYPES as readonly string[]).includes(templateType)) {
    return err("無効なテンプレート種別です");
  }

  // 運営法人の存在チェック
  const company = await prisma.operatingCompany.findUnique({
    where: { id: operatingCompanyId },
    select: { id: true },
  });
  if (!company) {
    return err("指定された運営法人が見つかりません");
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

  // 同一PJ・法人・種別での名称重複チェック
  const existing = await prisma.invoiceTemplate.findFirst({
    where: {
      name,
      operatingCompanyId,
      templateType,
      projectId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    return err(`テンプレート名「${name}」は同じプロジェクト・法人・種別で既に使用されています`);
  }

  // isDefaultがtrueの場合、既存デフォルト解除とcreateをトランザクションで実行
  if (isDefault) {
    await prisma.$transaction([
      prisma.invoiceTemplate.updateMany({
        where: {
          operatingCompanyId,
          templateType,
          isDefault: true,
          deletedAt: null,
        },
        data: { isDefault: false },
      }),
      prisma.invoiceTemplate.create({
        data: {
          name,
          templateType,
          operatingCompanyId,
          projectId,
          emailSubjectTemplate,
          emailBodyTemplate,
          isDefault,
          createdBy: staffId,
        },
      }),
    ]);
  } else {
    await prisma.invoiceTemplate.create({
      data: {
        name,
        templateType,
        operatingCompanyId,
        projectId,
        emailSubjectTemplate,
        emailBodyTemplate,
        isDefault,
        createdBy: staffId,
      },
    });
  }

    revalidatePath("/settings/email-templates");
    return ok();
  } catch (e) {
    console.error("[createInvoiceTemplate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateInvoiceTemplate(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const updateData: Record<string, unknown> = {};

  // 更新対象のテンプレートを取得
  const current = await prisma.invoiceTemplate.findUnique({
    where: { id },
    select: { id: true, operatingCompanyId: true, templateType: true, name: true, projectId: true },
  });
  if (!current) {
    return err("テンプレートが見つかりません");
  }

  // 全フィールドの最終値を先に確定
  let operatingCompanyId = current.operatingCompanyId;
  let templateType = current.templateType;
  let name = current.name;
  let projectId: number | null = current.projectId;

  if ("operatingCompanyId" in data) {
    const newCompanyId = Number(data.operatingCompanyId);
    if (!newCompanyId) return err("運営法人は必須です");

    const company = await prisma.operatingCompany.findUnique({
      where: { id: newCompanyId },
      select: { id: true },
    });
    if (!company) {
      return err("指定された運営法人が見つかりません");
    }
    operatingCompanyId = newCompanyId;
    updateData.operatingCompanyId = newCompanyId;
  }

  if ("projectId" in data) {
    const newProjectId = data.projectId ? Number(data.projectId) : null;
    if (newProjectId) {
      const project = await prisma.masterProject.findUnique({
        where: { id: newProjectId },
        select: { id: true },
      });
      if (!project) {
        return err("指定されたプロジェクトが見つかりません");
      }
    }
    projectId = newProjectId;
    updateData.projectId = newProjectId;
  }

  if ("templateType" in data) {
    const newType = data.templateType as string;
    if (!(VALID_TEMPLATE_TYPES as readonly string[]).includes(newType)) {
      return err("無効なテンプレート種別です");
    }
    templateType = newType;
    updateData.templateType = newType;
  }

  if ("name" in data) {
    const newName = ((data.name as string) ?? "").trim();
    if (!newName) return err("テンプレート名は必須です");
    name = newName;
    updateData.name = newName;
  }

  // 名称・法人・種別・PJのいずれかが変更された場合、最終値で重複チェック
  if ("name" in data || "operatingCompanyId" in data || "templateType" in data || "projectId" in data) {
    const existing = await prisma.invoiceTemplate.findFirst({
      where: {
        name,
        operatingCompanyId,
        templateType,
        projectId,
        deletedAt: null,
        id: { not: id },
      },
      select: { id: true },
    });
    if (existing) {
      return err(`テンプレート名「${name}」は同じプロジェクト・法人・種別で既に使用されています`);
    }
  }

  if ("emailSubjectTemplate" in data) {
    const subject = ((data.emailSubjectTemplate as string) ?? "").trim();
    if (!subject) return err("メール件名テンプレートは必須です");
    updateData.emailSubjectTemplate = subject;
  }

  if ("emailBodyTemplate" in data) {
    const body = ((data.emailBodyTemplate as string) ?? "").trim();
    if (!body) return err("メール本文テンプレートは必須です");
    updateData.emailBodyTemplate = body;
  }

  if ("isDefault" in data) {
    const isDefault = toBoolean(data.isDefault);
    updateData.isDefault = isDefault;
  }

  updateData.updatedBy = staffId;

  // isDefaultがtrueの場合、既存デフォルト解除とupdateをトランザクションで実行
  if (updateData.isDefault === true) {
    await prisma.$transaction([
      prisma.invoiceTemplate.updateMany({
        where: {
          operatingCompanyId,
          templateType,
          isDefault: true,
          deletedAt: null,
          id: { not: id },
        },
        data: { isDefault: false },
      }),
      prisma.invoiceTemplate.update({
        where: { id },
        data: updateData,
      }),
    ]);
  } else {
    await prisma.invoiceTemplate.update({
      where: { id },
      data: updateData,
    });
  }

    revalidatePath("/settings/email-templates");
    return ok();
  } catch (e) {
    console.error("[updateInvoiceTemplate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteInvoiceTemplate(id: number): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    await prisma.invoiceTemplate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: staffId,
      },
    });

    revalidatePath("/settings/email-templates");
    return ok();
  } catch (e) {
    console.error("[deleteInvoiceTemplate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
