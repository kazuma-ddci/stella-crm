"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { sendInvoiceEmail } from "@/lib/email/invoice-email";

// ============================================
// 型定義
// ============================================

export type InvoiceMailFormData = {
  invoiceGroup: {
    id: number;
    invoiceNumber: string | null;
    counterpartyId: number;
    counterpartyName: string;
    operatingCompanyId: number;
    operatingCompanyName: string;
    paymentDueDate: string | null;
    totalAmount: number | null;
    pdfPath: string | null;
    pdfFileName: string | null;
    status: string;
  };
  contacts: {
    id: number;
    name: string;
    email: string | null;
    department: string | null;
    isPrimary: boolean;
  }[];
  senderEmails: {
    id: number;
    email: string;
    label: string | null;
    isDefault: boolean;
  }[];
  templates: {
    id: number;
    name: string;
    templateType: string;
    emailSubjectTemplate: string;
    emailBodyTemplate: string;
    isDefault: boolean;
  }[];
  mailHistory: {
    id: number;
    sendMethod: string;
    subject: string | null;
    status: string;
    sentAt: string | null;
    sentByName: string | null;
    errorMessage: string | null;
    recipientEmails: string[];
  }[];
};

// ============================================
// メール送信データ取得
// ============================================

export async function getInvoiceMailData(
  invoiceGroupId: number
): Promise<InvoiceMailFormData> {
  // InvoiceGroup取得（counterparty + operatingCompany含む）
  const group = await prisma.invoiceGroup.findUnique({
    where: { id: invoiceGroupId, deletedAt: null },
    include: {
      counterparty: true,
      operatingCompany: true,
    },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  // counterpartyに紐づくMasterStellaCompanyの担当者を取得
  // Counterparty.companyId → MasterStellaCompany.id
  // StellaCompanyContact.companyId → MasterStellaCompany.id
  let contacts: InvoiceMailFormData["contacts"] = [];
  if (group.counterparty.companyId) {
    const companyContacts = await prisma.stellaCompanyContact.findMany({
      where: {
        companyId: group.counterparty.companyId,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    });
    contacts = companyContacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      department: c.department,
      isPrimary: c.isPrimary,
    }));
  }

  // OperatingCompanyEmailを取得（deletedAt: null）
  const emails = await prisma.operatingCompanyEmail.findMany({
    where: {
      operatingCompanyId: group.operatingCompanyId,
      deletedAt: null,
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });
  const senderEmails = emails.map((e) => ({
    id: e.id,
    email: e.email,
    label: e.label,
    isDefault: e.isDefault,
  }));

  // InvoiceTemplate取得（deletedAt: null, templateType: "sending"）
  const templateRecords = await prisma.invoiceTemplate.findMany({
    where: {
      operatingCompanyId: group.operatingCompanyId,
      deletedAt: null,
      templateType: "sending",
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });
  const templates = templateRecords.map((t) => ({
    id: t.id,
    name: t.name,
    templateType: t.templateType,
    emailSubjectTemplate: t.emailSubjectTemplate,
    emailBodyTemplate: t.emailBodyTemplate,
    isDefault: t.isDefault,
  }));

  // 過去のInvoiceMail一覧を取得
  const mails = await prisma.invoiceMail.findMany({
    where: {
      invoiceGroupId,
      deletedAt: null,
    },
    include: {
      sender: true,
      recipients: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const mailHistory = mails.map((m) => ({
    id: m.id,
    sendMethod: m.sendMethod,
    subject: m.subject,
    status: m.status,
    sentAt: m.sentAt?.toISOString() ?? null,
    sentByName: m.sender?.name ?? null,
    errorMessage: m.errorMessage,
    recipientEmails: m.recipients.map((r) => r.email),
  }));

  return {
    invoiceGroup: {
      id: group.id,
      invoiceNumber: group.invoiceNumber,
      counterpartyId: group.counterpartyId,
      counterpartyName: group.counterparty.name,
      operatingCompanyId: group.operatingCompanyId,
      operatingCompanyName: group.operatingCompany.companyName,
      paymentDueDate:
        group.paymentDueDate?.toISOString().split("T")[0] ?? null,
      totalAmount: group.totalAmount,
      pdfPath: group.pdfPath,
      pdfFileName: group.pdfFileName,
      status: group.status,
    },
    contacts,
    senderEmails,
    templates,
    mailHistory,
  };
}

// ============================================
// メール送信
// ============================================

export async function sendInvoiceMail(data: {
  invoiceGroupId: number;
  senderEmailId: number;
  templateId?: number;
  subject: string;
  body: string;
  recipients: {
    contactId?: number | null;
    name: string | null;
    email: string;
    type: "to" | "cc" | "bcc";
  }[];
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireEdit("stp");

  // InvoiceGroupの存在確認とステータスチェック
  const group = await prisma.invoiceGroup.findUnique({
    where: { id: data.invoiceGroupId, deletedAt: null },
  });
  if (!group) {
    return { success: false, error: "請求グループが見つかりません" };
  }
  // pdf_created または sent（再送扱い）のみ送付可能
  if (!["pdf_created", "sent"].includes(group.status)) {
    return {
      success: false,
      error: "PDF作成済みまたは送付済みの請求グループのみメール送信できます",
    };
  }

  // OperatingCompanyEmailの取得（SMTP設定含む）
  const senderEmail = await prisma.operatingCompanyEmail.findUnique({
    where: { id: data.senderEmailId, deletedAt: null },
  });
  if (!senderEmail) {
    return { success: false, error: "送信元メールアドレスが見つかりません" };
  }

  // トランザクションでInvoiceMail + Recipients作成
  const mail = await prisma.$transaction(async (tx) => {
    const created = await tx.invoiceMail.create({
      data: {
        invoiceGroupId: data.invoiceGroupId,
        operatingCompanyId: group.operatingCompanyId,
        senderEmailId: data.senderEmailId,
        sendMethod: "email",
        subject: data.subject,
        body: data.body,
        pdfPath: group.pdfPath,
        status: "draft",
        createdBy: user.id,
      },
    });

    // InvoiceMailRecipient 全件作成
    if (data.recipients.length > 0) {
      await tx.invoiceMailRecipient.createMany({
        data: data.recipients.map((r) => ({
          invoiceMailId: created.id,
          contactId: r.contactId ?? null,
          name: r.name,
          email: r.email,
          recipientType: r.type,
        })),
      });
    }

    return created;
  });

  // トランザクション外でメール送信
  try {
    const result = await sendInvoiceEmail({
      senderEmail: {
        email: senderEmail.email,
        smtpHost: senderEmail.smtpHost,
        smtpPort: senderEmail.smtpPort,
        smtpUser: senderEmail.smtpUser,
        smtpPass: senderEmail.smtpPass,
      },
      recipients: data.recipients.map((r) => ({
        email: r.email,
        name: r.name,
        type: r.type,
      })),
      subject: data.subject,
      body: data.body,
      pdfPath: group.pdfPath,
    });

    if (result.success) {
      // 成功: InvoiceMail.status = "sent", sentAt, sentBy 更新
      // InvoiceGroup.status を "sent" に更新
      await prisma.$transaction([
        prisma.invoiceMail.update({
          where: { id: mail.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            sentBy: user.id,
            updatedBy: user.id,
          },
        }),
        prisma.invoiceGroup.update({
          where: { id: data.invoiceGroupId },
          data: {
            status: "sent",
            updatedBy: user.id,
          },
        }),
      ]);

      revalidatePath("/stp/finance/invoices");
      return { success: true };
    } else {
      // 失敗: InvoiceMail.status = "failed", errorMessage 更新
      await prisma.invoiceMail.update({
        where: { id: mail.id },
        data: {
          status: "failed",
          errorMessage: result.error ?? "メール送信に失敗しました",
          updatedBy: user.id,
        },
      });

      revalidatePath("/stp/finance/invoices");
      return {
        success: false,
        error: result.error ?? "メール送信に失敗しました",
      };
    }
  } catch (error) {
    // 予期しないエラー
    const errorMessage =
      error instanceof Error ? error.message : "メール送信中にエラーが発生しました";

    await prisma.invoiceMail.update({
      where: { id: mail.id },
      data: {
        status: "failed",
        errorMessage,
        updatedBy: user.id,
      },
    });

    revalidatePath("/stp/finance/invoices");
    return { success: false, error: errorMessage };
  }
}

// ============================================
// メール再送
// ============================================

export async function resendInvoiceMail(
  mailId: number
): Promise<{ success: boolean; error?: string }> {
  const user = await requireEdit("stp");

  // InvoiceMailを取得（recipients, senderEmail, invoiceGroup含む）
  const mail = await prisma.invoiceMail.findUnique({
    where: { id: mailId, deletedAt: null },
    include: {
      recipients: true,
      senderEmail: true,
      invoiceGroup: true,
    },
  });
  if (!mail) {
    return { success: false, error: "メール送信履歴が見つかりません" };
  }

  // failed または sent ステータスのもののみ再送可能
  if (!["failed", "sent"].includes(mail.status)) {
    return {
      success: false,
      error: "失敗または送付済みのメールのみ再送できます",
    };
  }

  if (!mail.senderEmail) {
    return { success: false, error: "送信元メールアドレスが設定されていません" };
  }

  // メール送信
  try {
    const result = await sendInvoiceEmail({
      senderEmail: {
        email: mail.senderEmail.email,
        smtpHost: mail.senderEmail.smtpHost,
        smtpPort: mail.senderEmail.smtpPort,
        smtpUser: mail.senderEmail.smtpUser,
        smtpPass: mail.senderEmail.smtpPass,
      },
      recipients: mail.recipients.map((r) => ({
        email: r.email,
        name: r.name,
        type: r.recipientType as "to" | "cc" | "bcc",
      })),
      subject: mail.subject ?? "",
      body: mail.body ?? "",
      pdfPath: mail.pdfPath,
    });

    if (result.success) {
      // 成功: InvoiceMail.status = "sent", sentAt, sentBy 更新
      if (mail.invoiceGroupId && mail.invoiceGroup) {
        // InvoiceGroupがあれば "sent" に更新
        await prisma.$transaction([
          prisma.invoiceMail.update({
            where: { id: mail.id },
            data: {
              status: "sent",
              sentAt: new Date(),
              sentBy: user.id,
              errorMessage: null,
              updatedBy: user.id,
            },
          }),
          prisma.invoiceGroup.update({
            where: { id: mail.invoiceGroupId },
            data: {
              status: "sent",
              updatedBy: user.id,
            },
          }),
        ]);
      } else {
        await prisma.invoiceMail.update({
          where: { id: mail.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            sentBy: user.id,
            errorMessage: null,
            updatedBy: user.id,
          },
        });
      }

      revalidatePath("/stp/finance/invoices");
      return { success: true };
    } else {
      // 失敗: errorMessage 更新
      await prisma.invoiceMail.update({
        where: { id: mail.id },
        data: {
          status: "failed",
          errorMessage: result.error ?? "メール送信に失敗しました",
          updatedBy: user.id,
        },
      });

      revalidatePath("/stp/finance/invoices");
      return {
        success: false,
        error: result.error ?? "メール送信に失敗しました",
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "メール送信中にエラーが発生しました";

    await prisma.invoiceMail.update({
      where: { id: mail.id },
      data: {
        status: "failed",
        errorMessage,
        updatedBy: user.id,
      },
    });

    revalidatePath("/stp/finance/invoices");
    return { success: false, error: errorMessage };
  }
}

// ============================================
// 手動送付記録
// ============================================

export async function recordManualSend(data: {
  invoiceGroupId: number;
  sendMethod: "line" | "postal" | "other";
  note?: string;
}): Promise<void> {
  const user = await requireEdit("stp");

  // InvoiceGroupの存在確認とステータスチェック
  const group = await prisma.invoiceGroup.findUnique({
    where: { id: data.invoiceGroupId, deletedAt: null },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  // pdf_created以降のステータスが必要
  const allowedStatuses = [
    "pdf_created",
    "sent",
    "awaiting_accounting",
    "partially_paid",
    "paid",
  ];
  if (!allowedStatuses.includes(group.status)) {
    throw new Error("PDF作成済み以降のステータスでのみ手動送付を記録できます");
  }

  await prisma.$transaction([
    // InvoiceMail作成（status: "sent"）
    prisma.invoiceMail.create({
      data: {
        invoiceGroupId: data.invoiceGroupId,
        operatingCompanyId: group.operatingCompanyId,
        sendMethod: data.sendMethod,
        body: data.note ?? null,
        status: "sent",
        sentAt: new Date(),
        sentBy: user.id,
        createdBy: user.id,
      },
    }),
    // InvoiceGroup.status を "sent" に更新
    prisma.invoiceGroup.update({
      where: { id: data.invoiceGroupId },
      data: {
        status: "sent",
        updatedBy: user.id,
      },
    }),
  ]);

  revalidatePath("/stp/finance/invoices");
}
