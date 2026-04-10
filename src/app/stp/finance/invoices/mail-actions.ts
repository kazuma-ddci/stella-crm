"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { sendInvoiceEmail } from "@/lib/email/invoice-email";
import { toLocalDateString } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

// ============================================
// 型定義
// ============================================

export type InvoiceMailFormData = {
  invoiceGroup: {
    id: number;
    invoiceNumber: string | null;
    counterpartyId: number;
    counterpartyName: string;
    stellaCompanyId: number | null;
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
    memo: string | null;
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
): Promise<InvoiceMailFormData | null> {
  // InvoiceGroup取得（counterparty + operatingCompany含む）
  const group = await prisma.invoiceGroup.findUnique({
    where: { id: invoiceGroupId, deletedAt: null },
    include: {
      counterparty: true,
      operatingCompany: true,
    },
  });
  // 見つからない場合は null を返す（throw すると本番で英語エラー化される）
  if (!group) return null;

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

  // ProjectEmailのメモ取得
  const projectEmails = group.projectId
    ? await prisma.projectEmail.findMany({
        where: { projectId: group.projectId },
      })
    : [];
  const projectEmailMap = new Map(
    projectEmails.map((pe) => [pe.emailId, pe.memo])
  );

  // 個別SMTP設定があるメールのみフィルタ＋memo追加
  let senderEmails = emails
    .filter((e) => !!(e.smtpHost && e.smtpUser && e.smtpPass))
    .map((e) => ({
      id: e.id,
      email: e.email,
      label: e.label,
      memo: projectEmailMap.get(e.id) ?? null,
      isDefault: e.isDefault,
    }));

  // ProjectEmail テーブルから該当PJのデフォルト送信元を取得
  if (group.projectId) {
    const defaultProjectEmail = projectEmails.find((pe) => pe.isDefault);
    if (defaultProjectEmail) {
      // senderEmails の isDefault をオーバーライド
      senderEmails = senderEmails.map((e) => ({
        ...e,
        isDefault: e.id === defaultProjectEmail.emailId,
      }));
    }
  }

  // STPプロジェクトのIDを取得
  const stpProject = await prisma.masterProject.findFirst({
    where: { code: "stp" },
    select: { id: true },
  });
  const stpProjectId = stpProject?.id ?? null;

  // InvoiceTemplate取得（deletedAt: null, templateType: "sending", STPまたは共通）
  const templateRecords = await prisma.invoiceTemplate.findMany({
    where: {
      operatingCompanyId: group.operatingCompanyId,
      deletedAt: null,
      templateType: "sending",
      OR: [
        { projectId: stpProjectId },
        { projectId: null },
      ],
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
      stellaCompanyId: group.counterparty.companyId,
      operatingCompanyId: group.operatingCompanyId,
      operatingCompanyName: group.operatingCompany.companyName,
      paymentDueDate:
        group.paymentDueDate ? toLocalDateString(group.paymentDueDate) : null,
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
// 送信履歴取得（詳細モーダル用・軽量）
// ============================================

export type MailHistoryItem = {
  id: number;
  sendMethod: string;
  subject: string | null;
  status: string;
  sentAt: string | null;
  sentByName: string | null;
  errorMessage: string | null;
  recipientEmails: string[];
};

export async function getInvoiceGroupMailHistory(
  invoiceGroupId: number
): Promise<MailHistoryItem[]> {
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
  return mails.map((m) => ({
    id: m.id,
    sendMethod: m.sendMethod,
    subject: m.subject,
    status: m.status,
    sentAt: m.sentAt?.toISOString() ?? null,
    sentByName: m.sender?.name ?? null,
    errorMessage: m.errorMessage,
    recipientEmails: m.recipients.map((r) => r.email),
  }));
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
  submitToAccounting?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireEdit("stp");

  // P4: TO宛先が最低1件あるかバリデーション
  const hasTo = data.recipients.some((r) => r.type === "to");
  if (!hasTo) {
    return { success: false, error: "TO宛先を最低1件指定してください" };
  }

  // InvoiceGroupの存在確認とステータスチェック
  const group = await prisma.invoiceGroup.findUnique({
    where: { id: data.invoiceGroupId, deletedAt: null },
  });
  if (!group) {
    return { success: false, error: "請求が見つかりません" };
  }
  // pdf_created または sent（再送扱い）のみ送付可能
  if (!["pdf_created", "sent"].includes(group.status)) {
    return {
      success: false,
      error: "PDF作成済みまたは送付済みの請求のみメール送信できます",
    };
  }

  // OperatingCompanyEmailの取得（SMTP設定含む）
  const senderEmail = await prisma.operatingCompanyEmail.findUnique({
    where: { id: data.senderEmailId, deletedAt: null },
  });
  if (!senderEmail) {
    return { success: false, error: "送信元メールアドレスが見つかりません" };
  }

  // P5: invoiceGroupId/paymentGroupId 排他制約チェック
  // sendInvoiceMailはinvoiceGroup専用のため、paymentGroupIdは設定しない
  if (!data.invoiceGroupId) {
    return { success: false, error: "invoiceGroupIdは必須です" };
  }

  // トランザクションでInvoiceMail + Recipients作成
  const mail = await prisma.$transaction(async (tx) => {
    const created = await tx.invoiceMail.create({
      data: {
        invoiceGroupId: data.invoiceGroupId,
        paymentGroupId: null, // 排他制約: invoiceGroupId設定時はnull
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
      await prisma.invoiceMail.update({
        where: { id: mail.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          sentBy: user.id,
          updatedBy: user.id,
        },
      });

      // pdf_created の場合: submitToAccounting が true なら直接 awaiting_accounting、それ以外は sent に更新
      if (group.status === "pdf_created") {
        const newStatus = data.submitToAccounting ? "awaiting_accounting" : "sent";
        await prisma.invoiceGroup.update({
          where: { id: data.invoiceGroupId },
          data: {
            status: newStatus,
            updatedBy: user.id,
          },
        });
      }

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

      // pdf_created の場合のみ sent に更新（それ以降のステータスを退行させない）
      if (
        mail.invoiceGroupId &&
        mail.invoiceGroup &&
        mail.invoiceGroup.status === "pdf_created"
      ) {
        await prisma.invoiceGroup.update({
          where: { id: mail.invoiceGroupId },
          data: {
            status: "sent",
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
}): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");

  // InvoiceGroupの存在確認とステータスチェック
  const group = await prisma.invoiceGroup.findUnique({
    where: { id: data.invoiceGroupId, deletedAt: null },
  });
  if (!group) return err("請求が見つかりません");

  // pdf_created以降のステータスが必要
  const allowedStatuses = [
    "pdf_created",
    "sent",
    "awaiting_accounting",
    "partially_paid",
    "paid",
  ];
  if (!allowedStatuses.includes(group.status)) {
    return err("PDF作成済み以降のステータスでのみ手動送付を記録できます");
  }

  await prisma.$transaction(async (tx) => {
    // InvoiceMail作成（status: "sent"）
    await tx.invoiceMail.create({
      data: {
        invoiceGroupId: data.invoiceGroupId,
        paymentGroupId: null, // 排他制約: invoiceGroupId設定時はnull
        operatingCompanyId: group.operatingCompanyId,
        sendMethod: data.sendMethod,
        body: data.note ?? null,
        status: "sent",
        sentAt: new Date(),
        sentBy: user.id,
        createdBy: user.id,
      },
    });

    // pdf_created の場合のみ sent に更新（それ以降のステータスを退行させない）
    if (group.status === "pdf_created") {
      await tx.invoiceGroup.update({
        where: { id: data.invoiceGroupId },
        data: {
          status: "sent",
          updatedBy: user.id,
        },
      });
    }
  });

  revalidatePath("/stp/finance/invoices");
  return ok();
 } catch (e) {
  console.error("[recordManualSend] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}
