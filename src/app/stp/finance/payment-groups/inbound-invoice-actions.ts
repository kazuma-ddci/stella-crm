"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { requireStpProjectId } from "@/lib/project-context";
import { recordChangeLog } from "@/app/finance/changelog/actions";

// ============================================
// 承認待ち＋未マッチの受信請求書一覧取得
// ============================================

export async function getPendingInboundInvoices() {
  await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const invoices = await prisma.inboundInvoice.findMany({
    where: {
      status: { in: ["pending", "unmatched"] },
      OR: [
        // マッチ済み: STPプロジェクトスコープ内のみ
        { paymentGroup: { projectId: stpProjectId } },
        // 未マッチ: STPプロジェクトに紐づくメールアドレスで受信したもののみ
        {
          paymentGroupId: null,
          receivedByEmail: {
            projectEmails: { some: { projectId: stpProjectId } },
          },
        },
      ],
    },
    include: {
      paymentGroup: {
        include: {
          counterparty: { include: { company: true } },
        },
      },
      receivedByEmail: true,
    },
    orderBy: { receivedAt: "desc" },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    messageId: inv.messageId,
    attachmentIndex: inv.attachmentIndex,
    fromEmail: inv.fromEmail,
    fromName: inv.fromName,
    subject: inv.subject,
    emailBody: inv.emailBody,
    receivedAt: inv.receivedAt.toISOString(),
    paymentGroupId: inv.paymentGroupId,
    matchConfidence: inv.matchConfidence,
    referenceCode: inv.referenceCode,
    attachmentFileName: inv.attachmentFileName,
    attachmentPath: inv.attachmentPath,
    attachmentSize: inv.attachmentSize,
    attachmentMimeType: inv.attachmentMimeType,
    status: inv.status,
    paymentGroup: inv.paymentGroup
      ? {
          id: inv.paymentGroup.id,
          referenceCode: inv.paymentGroup.referenceCode,
          counterpartyName:
            inv.paymentGroup.counterparty?.company?.name ??
            inv.paymentGroup.counterparty?.name ??
            "不明",
          totalAmount: inv.paymentGroup.totalAmount,
          status: inv.paymentGroup.status,
        }
      : null,
    receivedByEmail: inv.receivedByEmail.email,
  }));
}

export type PendingInboundInvoice = Awaited<
  ReturnType<typeof getPendingInboundInvoices>
>[number];

// ============================================
// 承認して添付
// ============================================

export async function confirmInboundInvoice(inboundInvoiceId: number) {
  const session = await requireEdit("stp");
  const staffId = session.id;
  const stpProjectId = await requireStpProjectId();

  try {
    const invoice = await prisma.inboundInvoice.findUnique({
      where: { id: inboundInvoiceId },
      include: { paymentGroup: true },
    });

    if (!invoice) {
      return { success: false, error: "請求書が見つかりません" };
    }
    if (invoice.status !== "pending") {
      return { success: false, error: "この請求書は承認待ち状態ではありません" };
    }
    if (!invoice.paymentGroupId || !invoice.paymentGroup) {
      return { success: false, error: "支払グループが紐付けられていません" };
    }

    // PJスコープ検証
    const pg = invoice.paymentGroup;
    if (pg.projectId !== stpProjectId) {
      return { success: false, error: "この支払グループは現在のプロジェクトに属していません" };
    }

    // 競合防止: updateMany で pending→processing を原子的に確保してから処理
    const result = await prisma.$transaction(async (tx) => {
      // pending を原子的に確保（並列リクエストで1つだけ成功する）
      const claimed = await tx.inboundInvoice.updateMany({
        where: { id: inboundInvoiceId, status: "pending" },
        data: { status: "processing" },
      });
      if (claimed.count === 0) {
        return { claimed: false as const, transitioned: false };
      }

      // Attachment保存
      if (invoice.attachmentPath && invoice.attachmentFileName) {
        await tx.attachment.createMany({
          data: [
            {
              paymentGroupId: invoice.paymentGroupId!,
              filePath: invoice.attachmentPath,
              fileName: invoice.attachmentFileName,
              fileSize: invoice.attachmentSize ?? 0,
              mimeType: invoice.attachmentMimeType ?? "application/pdf",
              attachmentType: "invoice",
              uploadedBy: staffId,
            },
          ],
        });
      }

      // PaymentGroup.status を条件付き更新（DB側で requested/re_requested を原子的に評価）
      const pgUpdated = await tx.paymentGroup.updateMany({
        where: {
          id: pg.id,
          status: { in: ["requested", "re_requested"] },
        },
        data: { status: "invoice_received", updatedBy: staffId },
      });

      // InboundInvoice を confirmed に確定
      await tx.inboundInvoice.update({
        where: { id: inboundInvoiceId },
        data: {
          status: "confirmed",
          processedBy: staffId,
          processedAt: new Date(),
        },
      });

      return { claimed: true as const, transitioned: pgUpdated.count > 0 };
    });

    if (!result.claimed) {
      return { success: false, error: "この請求書は既に処理済みです" };
    }

    // changeLog はトランザクション外（既存パターン踏襲、失敗しても承認自体は確定済み）
    if (invoice.attachmentPath && invoice.attachmentFileName) {
      await recordChangeLog({
        tableName: "PaymentGroup",
        recordId: invoice.paymentGroupId!,
        changeType: "update",
        newData: { addedAttachments: [invoice.attachmentFileName] },
      }, staffId).catch((err) => {
        console.error("confirmInboundInvoice: changeLog recording failed:", err);
      });
    }

    revalidatePath("/stp/finance/payment-groups");
    return {
      success: true,
      warning: result.transitioned
        ? undefined
        : `支払グループのステータスが遷移対象外のため、添付ファイルのみ保存しました（ステータスは変更されていません）`,
    };
  } catch (error) {
    console.error("confirmInboundInvoice error:", error);
    return { success: false, error: "承認処理中にエラーが発生しました" };
  }
}

// ============================================
// 却下
// ============================================

export async function rejectInboundInvoice(inboundInvoiceId: number) {
  const session = await requireEdit("stp");
  const staffId = session.id;
  const stpProjectId = await requireStpProjectId();

  try {
    const invoice = await prisma.inboundInvoice.findUnique({
      where: { id: inboundInvoiceId },
      include: {
        paymentGroup: true,
        receivedByEmail: { include: { projectEmails: true } },
      },
    });

    if (!invoice) {
      return { success: false, error: "請求書が見つかりません" };
    }
    if (invoice.status !== "pending" && invoice.status !== "unmatched") {
      return { success: false, error: "この請求書は処理可能な状態ではありません" };
    }

    // PJスコープ検証
    if (invoice.status === "pending" && invoice.paymentGroup) {
      // pending: PG経由でスコープ検証
      if (invoice.paymentGroup.projectId !== stpProjectId) {
        return { success: false, error: "この支払グループは現在のプロジェクトに属していません" };
      }
    } else if (invoice.status === "unmatched") {
      // unmatched: 受信メールアドレスのprojectEmails経由でスコープ検証
      const inScope = invoice.receivedByEmail.projectEmails.some(
        (pe) => pe.projectId === stpProjectId
      );
      if (!inScope) {
        return { success: false, error: "この請求書は現在のプロジェクトのスコープ外です" };
      }
    }

    await prisma.inboundInvoice.update({
      where: { id: inboundInvoiceId },
      data: {
        status: "rejected",
        processedBy: staffId,
        processedAt: new Date(),
      },
    });

    revalidatePath("/stp/finance/payment-groups");
    return { success: true };
  } catch (error) {
    console.error("rejectInboundInvoice error:", error);
    return { success: false, error: "却下処理中にエラーが発生しました" };
  }
}

// ============================================
// 手動マッチ（unmatched → pending）
// ============================================

export async function matchInboundInvoiceToGroup(
  inboundInvoiceId: number,
  paymentGroupId: number
) {
  await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  try {
    const invoice = await prisma.inboundInvoice.findUnique({
      where: { id: inboundInvoiceId },
      include: {
        receivedByEmail: { include: { projectEmails: true } },
      },
    });

    if (!invoice) {
      return { success: false, error: "請求書が見つかりません" };
    }
    if (invoice.status !== "unmatched") {
      return { success: false, error: "この請求書は未マッチ状態ではありません" };
    }

    // invoice側のPJスコープ検証（受信メールアドレスがSTPプロジェクトに紐づいているか）
    const invoiceInScope = invoice.receivedByEmail.projectEmails.some(
      (pe) => pe.projectId === stpProjectId
    );
    if (!invoiceInScope) {
      return { success: false, error: "この請求書は現在のプロジェクトのスコープ外です" };
    }

    // PG側のPJスコープ検証
    const pg = await prisma.paymentGroup.findUnique({
      where: { id: paymentGroupId },
    });
    if (!pg || pg.deletedAt) {
      return { success: false, error: "指定された支払グループが見つかりません" };
    }
    if (pg.projectId !== stpProjectId) {
      return { success: false, error: "指定された支払グループは現在のプロジェクトに属していません" };
    }
    if (pg.status !== "requested" && pg.status !== "re_requested") {
      return { success: false, error: "依頼済みまたは再依頼のステータスの支払グループのみマッチできます" };
    }

    await prisma.inboundInvoice.update({
      where: { id: inboundInvoiceId },
      data: {
        paymentGroupId,
        status: "pending",
      },
    });

    revalidatePath("/stp/finance/payment-groups");
    return { success: true };
  } catch (error) {
    console.error("matchInboundInvoiceToGroup error:", error);
    return { success: false, error: "マッチ処理中にエラーが発生しました" };
  }
}

// ============================================
// マッチ先候補のPaymentGroup一覧（requested/re_requested）
// ============================================

export async function getMatchablePaymentGroups() {
  await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const groups = await prisma.paymentGroup.findMany({
    where: {
      deletedAt: null,
      projectId: stpProjectId,
      status: { in: ["requested", "re_requested"] },
    },
    include: {
      counterparty: { include: { company: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return groups.map((g) => ({
    id: g.id,
    referenceCode: g.referenceCode,
    counterpartyName:
      g.counterparty?.company?.name ?? g.counterparty?.name ?? "不明",
    totalAmount: g.totalAmount,
    status: g.status,
  }));
}

export type MatchablePaymentGroup = Awaited<
  ReturnType<typeof getMatchablePaymentGroups>
>[number];
