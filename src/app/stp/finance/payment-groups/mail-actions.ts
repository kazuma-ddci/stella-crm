"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { sendInvoiceEmail } from "@/lib/email/invoice-email";
import { toLocalDateString } from "@/lib/utils";

// ============================================
// 型定義
// ============================================

export type PaymentGroupMailFormData = {
  paymentGroup: {
    id: number;
    counterpartyId: number | null;
    counterpartyName: string;
    stellaCompanyId: number | null;
    operatingCompanyId: number;
    operatingCompanyName: string;
    targetMonth: string | null; // YYYY-MM
    expectedPaymentDate: string | null;
    totalAmount: number | null;
    referenceCode: string | null;
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
    body: string | null;
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

export async function getPaymentGroupMailData(
  paymentGroupId: number
): Promise<PaymentGroupMailFormData> {
  // PaymentGroup取得（counterparty + operatingCompany含む）
  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null },
    include: {
      counterparty: true,
      operatingCompany: true,
    },
  });
  if (!group) throw new Error("支払が見つかりません");

  // counterpartyに紐づくMasterStellaCompanyの担当者を取得
  // Counterparty.companyId → MasterStellaCompany.id
  // StellaCompanyContact.companyId → MasterStellaCompany.id
  let contacts: PaymentGroupMailFormData["contacts"] = [];
  if (group.counterparty?.companyId) {
    const companyContacts = await prisma.stellaCompanyContact.findMany({
      where: {
        companyId: group.counterparty!.companyId,
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

  // OperatingCompanyEmailを取得（deletedAt: null、個別SMTP設定ありのみ）
  const emails = await prisma.operatingCompanyEmail.findMany({
    where: {
      operatingCompanyId: group.operatingCompanyId,
      deletedAt: null,
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });
  const senderEmails = emails
    .filter((e) => !!(e.smtpHost && e.smtpUser && e.smtpPass))
    .map((e) => ({
      id: e.id,
      email: e.email,
      label: e.label,
      memo: null as string | null,
      isDefault: e.isDefault,
    }));

  // STPプロジェクトのIDを取得
  const stpProject = await prisma.masterProject.findFirst({
    where: { code: "stp" },
    select: { id: true },
  });
  const stpProjectId = stpProject?.id ?? null;

  // InvoiceTemplate取得（deletedAt: null, templateType: "request", STPまたは共通）
  const templateRecords = await prisma.invoiceTemplate.findMany({
    where: {
      operatingCompanyId: group.operatingCompanyId,
      deletedAt: null,
      templateType: "request",
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

  // 過去のInvoiceMail一覧を取得（paymentGroupIdで検索）
  const mails = await prisma.invoiceMail.findMany({
    where: {
      paymentGroupId,
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
    body: m.body,
    status: m.status,
    sentAt: m.sentAt?.toISOString() ?? null,
    sentByName: m.sender?.name ?? null,
    errorMessage: m.errorMessage,
    recipientEmails: m.recipients.map((r) => r.email),
  }));

  return {
    paymentGroup: {
      id: group.id,
      counterpartyId: group.counterpartyId,
      counterpartyName: group.counterparty?.name ?? "（未設定）",
      stellaCompanyId: group.counterparty?.companyId ?? null,
      operatingCompanyId: group.operatingCompanyId,
      operatingCompanyName: group.operatingCompany.companyName,
      targetMonth: group.targetMonth ? toLocalDateString(group.targetMonth).slice(0, 7) : null, // YYYY-MM
      expectedPaymentDate:
        group.expectedPaymentDate ? toLocalDateString(group.expectedPaymentDate) : null,
      totalAmount: group.totalAmount,
      referenceCode: group.referenceCode,
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
  body: string | null;
  status: string;
  sentAt: string | null;
  sentByName: string | null;
  errorMessage: string | null;
  recipientEmails: string[];
};

export async function getPaymentGroupMailHistory(
  paymentGroupId: number
): Promise<MailHistoryItem[]> {
  const mails = await prisma.invoiceMail.findMany({
    where: {
      paymentGroupId,
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
    body: m.body,
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

export async function sendPaymentGroupMail(data: {
  paymentGroupId: number;
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

  // TO宛先が最低1件あるかバリデーション
  const hasTo = data.recipients.some((r) => r.type === "to");
  if (!hasTo) {
    return { success: false, error: "TO宛先を最低1件指定してください" };
  }

  // PaymentGroupの存在確認とステータスチェック
  const group = await prisma.paymentGroup.findUnique({
    where: { id: data.paymentGroupId, deletedAt: null },
  });
  if (!group) {
    return { success: false, error: "支払が見つかりません" };
  }

  // directタイプはメール送信不可
  if (group.paymentType === "direct") {
    return { success: false, error: "即時支払いタイプの支払にはメール送信できません" };
  }

  // before_request | requested | rejected | re_requested のみ送信可能
  if (
    !["before_request", "requested", "rejected", "re_requested"].includes(
      group.status
    )
  ) {
    return {
      success: false,
      error:
        "依頼前・依頼済み・差し戻し・再依頼のステータスのみメール送信できます",
    };
  }

  // OperatingCompanyEmailの取得（SMTP設定含む）
  const senderEmail = await prisma.operatingCompanyEmail.findUnique({
    where: { id: data.senderEmailId, deletedAt: null },
  });
  if (!senderEmail) {
    return { success: false, error: "送信元メールアドレスが見つかりません" };
  }

  // referenceCode がメール本文に含まれていない場合、末尾に自動追記（DB保存・送信とも同一テキスト）
  let finalBody = data.body;
  if (group.referenceCode && !data.body.includes(group.referenceCode)) {
    finalBody += `\n---\n※ 請求書PDFのファイル名末尾に「${group.referenceCode}」を含めてください。\n例: 請求書_2026年3月_${group.referenceCode}.pdf`;
  }

  // トランザクションでInvoiceMail + Recipients作成
  const mail = await prisma.$transaction(async (tx) => {
    const created = await tx.invoiceMail.create({
      data: {
        invoiceGroupId: null, // 排他制約: paymentGroupId設定時はnull
        paymentGroupId: data.paymentGroupId,
        operatingCompanyId: group.operatingCompanyId,
        senderEmailId: data.senderEmailId,
        sendMethod: "email",
        subject: data.subject,
        body: finalBody,
        pdfPath: null, // 支払グループにはPDF添付なし
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
      body: finalBody,
      pdfPath: null, // 支払グループにはPDF添付なし
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

      // ステータス遷移（退行防止）
      // before_request → requested
      // rejected → re_requested
      // それ以外はステータス変更しない
      const statusUpdateData: Record<string, unknown> = { updatedBy: user.id };

      if (group.status === "before_request") {
        statusUpdateData.status = "requested";
      } else if (group.status === "rejected") {
        statusUpdateData.status = "re_requested";
      }

      // expectedInboundEmailId が null の場合のみ初回自動設定
      if (!group.expectedInboundEmailId && data.senderEmailId) {
        statusUpdateData.expectedInboundEmailId = data.senderEmailId;
      }

      if (Object.keys(statusUpdateData).length > 1) {
        await prisma.paymentGroup.update({
          where: { id: data.paymentGroupId },
          data: statusUpdateData,
        });
      }

      revalidatePath("/stp/finance/payment-groups");
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

      revalidatePath("/stp/finance/payment-groups");
      return {
        success: false,
        error: result.error ?? "メール送信に失敗しました",
      };
    }
  } catch (error) {
    // 予期しないエラー
    const errorMessage =
      error instanceof Error
        ? error.message
        : "メール送信中にエラーが発生しました";

    await prisma.invoiceMail.update({
      where: { id: mail.id },
      data: {
        status: "failed",
        errorMessage,
        updatedBy: user.id,
      },
    });

    revalidatePath("/stp/finance/payment-groups");
    return { success: false, error: errorMessage };
  }
}

// ============================================
// メール再送
// ============================================

export async function resendPaymentGroupMail(
  mailId: number
): Promise<{ success: boolean; error?: string }> {
  const user = await requireEdit("stp");

  // InvoiceMailを取得（paymentGroupId不null。include recipients, senderEmail, paymentGroup）
  const mail = await prisma.invoiceMail.findUnique({
    where: { id: mailId, deletedAt: null },
    include: {
      recipients: true,
      senderEmail: true,
      paymentGroup: true,
    },
  });
  if (!mail) {
    return { success: false, error: "メール送信履歴が見つかりません" };
  }

  // paymentGroupIdが設定されていることを確認
  if (!mail.paymentGroupId || !mail.paymentGroup) {
    return {
      success: false,
      error: "支払に紐づくメールではありません",
    };
  }

  // directタイプはメール送信不可
  if (mail.paymentGroup.paymentType === "direct") {
    return { success: false, error: "即時支払いタイプの支払にはメール送信できません" };
  }

  // failed または sent ステータスのもののみ再送可能
  if (!["failed", "sent"].includes(mail.status)) {
    return {
      success: false,
      error: "失敗または送付済みのメールのみ再送できます",
    };
  }

  if (!mail.senderEmail) {
    return {
      success: false,
      error: "送信元メールアドレスが設定されていません",
    };
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
      pdfPath: null, // 支払グループにはPDF添付なし
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

      // ステータス遷移（退行防止）
      // before_request → requested
      // rejected → re_requested
      // それ以外はステータス変更しない
      if (mail.paymentGroup.status === "before_request") {
        await prisma.paymentGroup.update({
          where: { id: mail.paymentGroupId! },
          data: {
            status: "requested",
            updatedBy: user.id,
          },
        });
      } else if (mail.paymentGroup.status === "rejected") {
        await prisma.paymentGroup.update({
          where: { id: mail.paymentGroupId! },
          data: {
            status: "re_requested",
            updatedBy: user.id,
          },
        });
      }

      revalidatePath("/stp/finance/payment-groups");
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

      revalidatePath("/stp/finance/payment-groups");
      return {
        success: false,
        error: result.error ?? "メール送信に失敗しました",
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "メール送信中にエラーが発生しました";

    await prisma.invoiceMail.update({
      where: { id: mail.id },
      data: {
        status: "failed",
        errorMessage,
        updatedBy: user.id,
      },
    });

    revalidatePath("/stp/finance/payment-groups");
    return { success: false, error: errorMessage };
  }
}

// ============================================
// 手動送付記録
// ============================================

export async function recordManualPaymentGroupSend(data: {
  paymentGroupId: number;
  sendMethod: "line" | "postal" | "other";
  note?: string;
}): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id: data.paymentGroupId, deletedAt: null },
  });
  if (!group) throw new Error("支払が見つかりません");

  if (group.paymentType === "direct") {
    throw new Error("即時支払いタイプの支払には手動記録できません");
  }

  if (!["before_request", "rejected"].includes(group.status)) {
    throw new Error("依頼前・差し戻しのステータスでのみ手動記録できます");
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceMail.create({
      data: {
        invoiceGroupId: null,
        paymentGroupId: data.paymentGroupId,
        operatingCompanyId: group.operatingCompanyId,
        sendMethod: data.sendMethod,
        body: data.note ?? null,
        status: "sent",
        sentAt: new Date(),
        sentBy: user.id,
        createdBy: user.id,
      },
    });

    // ステータス遷移: before_request → requested, rejected → re_requested
    const newStatus =
      group.status === "before_request" ? "requested" : "re_requested";
    await tx.paymentGroup.update({
      where: { id: data.paymentGroupId },
      data: {
        status: newStatus,
        updatedBy: user.id,
      },
    });
  });

  revalidatePath("/stp/finance/payment-groups");
}
