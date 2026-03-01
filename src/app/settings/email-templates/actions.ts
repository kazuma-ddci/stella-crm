"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const VALID_TEMPLATE_TYPES = ["sending", "request"] as const;

export async function createInvoiceTemplate(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const name = ((data.name as string) ?? "").trim();
  const templateType = data.templateType as string;
  const operatingCompanyId = Number(data.operatingCompanyId);
  const emailSubjectTemplate = ((data.emailSubjectTemplate as string) ?? "").trim();
  const emailBodyTemplate = ((data.emailBodyTemplate as string) ?? "").trim();
  const isDefault = data.isDefault === true || data.isDefault === "true";

  if (!name || !templateType || !operatingCompanyId || !emailSubjectTemplate || !emailBodyTemplate) {
    throw new Error("テンプレート名、種別、運営法人、メール件名、メール本文は必須です");
  }

  if (!(VALID_TEMPLATE_TYPES as readonly string[]).includes(templateType)) {
    throw new Error("無効なテンプレート種別です");
  }

  // 運営法人の存在チェック
  const company = await prisma.operatingCompany.findUnique({
    where: { id: operatingCompanyId },
    select: { id: true },
  });
  if (!company) {
    throw new Error("指定された運営法人が見つかりません");
  }

  // 同一法人・同一種別での名称重複チェック
  const existing = await prisma.invoiceTemplate.findFirst({
    where: {
      name,
      operatingCompanyId,
      templateType,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`テンプレート名「${name}」は同じ法人・種別で既に使用されています`);
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
        emailSubjectTemplate,
        emailBodyTemplate,
        isDefault,
        createdBy: staffId,
      },
    });
  }

  revalidatePath("/settings/email-templates");
}

export async function updateInvoiceTemplate(id: number, data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const updateData: Record<string, unknown> = {};

  // 更新対象のテンプレートを取得
  const current = await prisma.invoiceTemplate.findUnique({
    where: { id },
    select: { id: true, operatingCompanyId: true, templateType: true, name: true },
  });
  if (!current) {
    throw new Error("テンプレートが見つかりません");
  }

  // 全フィールドの最終値を先に確定
  let operatingCompanyId = current.operatingCompanyId;
  let templateType = current.templateType;
  let name = current.name;

  if ("operatingCompanyId" in data) {
    const newCompanyId = Number(data.operatingCompanyId);
    if (!newCompanyId) throw new Error("運営法人は必須です");

    const company = await prisma.operatingCompany.findUnique({
      where: { id: newCompanyId },
      select: { id: true },
    });
    if (!company) {
      throw new Error("指定された運営法人が見つかりません");
    }
    operatingCompanyId = newCompanyId;
    updateData.operatingCompanyId = newCompanyId;
  }

  if ("templateType" in data) {
    const newType = data.templateType as string;
    if (!(VALID_TEMPLATE_TYPES as readonly string[]).includes(newType)) {
      throw new Error("無効なテンプレート種別です");
    }
    templateType = newType;
    updateData.templateType = newType;
  }

  if ("name" in data) {
    const newName = ((data.name as string) ?? "").trim();
    if (!newName) throw new Error("テンプレート名は必須です");
    name = newName;
    updateData.name = newName;
  }

  // 名称・法人・種別のいずれかが変更された場合、最終値で重複チェック
  if ("name" in data || "operatingCompanyId" in data || "templateType" in data) {
    const existing = await prisma.invoiceTemplate.findFirst({
      where: {
        name,
        operatingCompanyId,
        templateType,
        deletedAt: null,
        id: { not: id },
      },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`テンプレート名「${name}」は同じ法人・種別で既に使用されています`);
    }
  }

  if ("emailSubjectTemplate" in data) {
    const subject = ((data.emailSubjectTemplate as string) ?? "").trim();
    if (!subject) throw new Error("メール件名テンプレートは必須です");
    updateData.emailSubjectTemplate = subject;
  }

  if ("emailBodyTemplate" in data) {
    const body = ((data.emailBodyTemplate as string) ?? "").trim();
    if (!body) throw new Error("メール本文テンプレートは必須です");
    updateData.emailBodyTemplate = body;
  }

  if ("isDefault" in data) {
    const isDefault = data.isDefault === true || data.isDefault === "true";
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
}

export async function deleteInvoiceTemplate(id: number) {
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
}
