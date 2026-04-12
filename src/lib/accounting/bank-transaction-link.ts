"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  recalcInvoiceGroupActualPaymentDate,
  recalcPaymentGroupActualPaymentDate,
} from "@/lib/accounting/sync-payment-date";
import { ok, err, type ActionResult } from "@/lib/action-result";

// ============================================
// 銀行入出金履歴 (BankTransaction) ↔ 請求/支払グループ の分割紐付けシステム
//
// - 1つの BankTransaction を複数のグループに分割紐付け可能 (M:N)
// - 紐付けを作成すると、対応する InvoiceGroupReceipt / PaymentGroupPayment を自動生成
// - 紐付け解除時に対応する記録も削除
// - 「紐付け完了」は経理が手動で BankTransaction.linkCompleted を切替
// ============================================

export type LinkAllocation = {
  groupType: "invoice" | "payment";
  groupId: number;
  amount: number; // 税込（このリンクで割り当てる金額）
  comment?: string | null;
};

export type BankTxLinkView = {
  id: number;
  bankTransactionId: number;
  groupType: "invoice" | "payment";
  groupId: number;
  groupLabel: string | null;       // "INV-0001" / "PG-0001" 等
  groupTotalAmount: number | null;
  amount: number;
  note: string | null;
  createdAt: Date;
  createdByName: string;
};

// ============================================
// 1. getBankTransactionLinks — 銀行取引に紐づくリンク一覧取得
// ============================================
export async function getBankTransactionLinks(
  bankTransactionId: number
): Promise<BankTxLinkView[]> {
  // 経理プロジェクトの閲覧権限以上を要求
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithProjectPermission([
    { project: "accounting", level: "view" },
  ]);

  const links = await prisma.bankTransactionGroupLink.findMany({
    where: { bankTransactionId },
    orderBy: { createdAt: "asc" },
    include: {
      invoiceGroup: {
        select: { id: true, invoiceNumber: true, totalAmount: true },
      },
      paymentGroup: {
        select: { id: true, referenceCode: true, totalAmount: true },
      },
      creator: { select: { name: true } },
    },
  });

  return links.map((l) => {
    const isInvoice = l.invoiceGroupId !== null;
    return {
      id: l.id,
      bankTransactionId: l.bankTransactionId,
      groupType: isInvoice ? "invoice" : "payment",
      groupId: isInvoice ? (l.invoiceGroupId ?? 0) : (l.paymentGroupId ?? 0),
      groupLabel: isInvoice
        ? (l.invoiceGroup?.invoiceNumber ?? `INV-${l.invoiceGroupId}`)
        : (l.paymentGroup?.referenceCode ?? `PG-${l.paymentGroupId}`),
      groupTotalAmount: isInvoice
        ? (l.invoiceGroup?.totalAmount ?? null)
        : (l.paymentGroup?.totalAmount ?? null),
      amount: l.amount,
      note: l.note,
      createdAt: l.createdAt,
      createdByName: l.creator.name,
    };
  });
}

// ============================================
// 2. checkManualReceiptsExist — 既存の手動記録有無をチェック
// ============================================
//
// 指定グループに、銀行履歴由来ではない「手動入力」の記録が存在するか確認する
// (紐付け前に重複警告ダイアログを出すために使う)
//
export async function checkManualReceiptsExist(
  groupType: "invoice" | "payment",
  groupId: number
): Promise<{ exists: boolean; count: number }> {
  await requireStaffWithProjectPermission([
    { project: "accounting", level: "view" },
  ]);

  if (groupType === "invoice") {
    const count = await prisma.invoiceGroupReceipt.count({
      where: { invoiceGroupId: groupId, bankTransactionLinkId: null },
    });
    return { exists: count > 0, count };
  }
  const count = await prisma.paymentGroupPayment.count({
    where: { paymentGroupId: groupId, bankTransactionLinkId: null },
  });
  return { exists: count > 0, count };
}

// ============================================
// 3. linkBankTransactionToGroups — 分割紐付け（複数グループに同時割当）
// ============================================
//
// 銀行取引を複数グループに同時に紐付ける。各行に金額とコメント。
// options.replaceManualReceipts が true の場合、対象グループの手動記録を全削除してから紐付け
//
export async function linkBankTransactionToGroups(
  bankTransactionId: number,
  allocations: LinkAllocation[],
  options?: { replaceManualReceipts?: boolean }
): Promise<ActionResult> {
  // 経理プロジェクトの編集権限以上を要求(write操作)
  // requireEdit は redirect でなく Error を throw するので try/catch 内で OK
  const session = await requireEdit("accounting");
  const staffId = session.id;
  try {
  if (allocations.length === 0) {
    return err("紐付け先が1つも指定されていません");
  }

  // バリデーション
  for (const a of allocations) {
    if (!Number.isFinite(a.amount) || a.amount <= 0) {
      return err("割当金額は1以上の数値で入力してください");
    }
  }

  // 銀行取引の存在確認
  const bankTx = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, deletedAt: null },
    select: { id: true, transactionDate: true },
  });
  if (!bankTx) return err("銀行入出金履歴が見つかりません");

  await prisma.$transaction(async (tx) => {
    // replaceManualReceipts = true の場合、対象グループの手動記録を削除
    if (options?.replaceManualReceipts) {
      const invoiceGroupIds = allocations
        .filter((a) => a.groupType === "invoice")
        .map((a) => a.groupId);
      const paymentGroupIds = allocations
        .filter((a) => a.groupType === "payment")
        .map((a) => a.groupId);

      if (invoiceGroupIds.length > 0) {
        await tx.invoiceGroupReceipt.deleteMany({
          where: {
            invoiceGroupId: { in: invoiceGroupIds },
            bankTransactionLinkId: null, // 手動記録のみ削除
          },
        });
      }
      if (paymentGroupIds.length > 0) {
        await tx.paymentGroupPayment.deleteMany({
          where: {
            paymentGroupId: { in: paymentGroupIds },
            bankTransactionLinkId: null,
          },
        });
      }
    }

    // 各 allocation に対してリンクと記録を作成
    for (const a of allocations) {
      const link = await tx.bankTransactionGroupLink.create({
        data: {
          bankTransactionId,
          invoiceGroupId: a.groupType === "invoice" ? a.groupId : null,
          paymentGroupId: a.groupType === "payment" ? a.groupId : null,
          amount: Math.round(a.amount),
          note: a.comment?.trim() || null,
          createdBy: staffId,
        },
      });

      if (a.groupType === "invoice") {
        await tx.invoiceGroupReceipt.create({
          data: {
            invoiceGroupId: a.groupId,
            receivedDate: bankTx.transactionDate,
            amount: Math.round(a.amount),
            comment: a.comment?.trim() || null,
            createdById: staffId,
            bankTransactionLinkId: link.id,
          },
        });
        await recalcInvoiceGroupActualPaymentDate(tx, a.groupId);
      } else {
        await tx.paymentGroupPayment.create({
          data: {
            paymentGroupId: a.groupId,
            paidDate: bankTx.transactionDate,
            amount: Math.round(a.amount),
            comment: a.comment?.trim() || null,
            createdById: staffId,
            bankTransactionLinkId: link.id,
          },
        });
        await recalcPaymentGroupActualPaymentDate(tx, a.groupId);
      }
    }
  });

  revalidatePath("/accounting/bank-transactions");
  revalidatePath("/accounting/workflow");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
  return ok();
  } catch (e) {
    console.error("[linkBankTransactionToGroups] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 4. unlinkBankTransactionLink — 個別リンクを解除
// ============================================
//
// 1つのリンクを解除し、対応する InvoiceGroupReceipt / PaymentGroupPayment も削除する
//
export async function unlinkBankTransactionLink(
  linkId: number
): Promise<ActionResult> {
  await requireEdit("accounting");
  try {
  const link = await prisma.bankTransactionGroupLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      invoiceGroupId: true,
      paymentGroupId: true,
    },
  });
  if (!link) return err("紐付けが見つかりません");

  await prisma.$transaction(async (tx) => {
    // 対応する入金/支払記録を先に削除（onDelete: SetNull により自動削除されないため手動）
    if (link.invoiceGroupId) {
      await tx.invoiceGroupReceipt.deleteMany({
        where: { bankTransactionLinkId: linkId },
      });
    }
    if (link.paymentGroupId) {
      await tx.paymentGroupPayment.deleteMany({
        where: { bankTransactionLinkId: linkId },
      });
    }

    // リンクを削除
    await tx.bankTransactionGroupLink.delete({ where: { id: linkId } });

    // 親グループの actualPaymentDate を再計算
    if (link.invoiceGroupId) {
      await recalcInvoiceGroupActualPaymentDate(tx, link.invoiceGroupId);
    }
    if (link.paymentGroupId) {
      await recalcPaymentGroupActualPaymentDate(tx, link.paymentGroupId);
    }
  });

  revalidatePath("/accounting/bank-transactions");
  revalidatePath("/accounting/workflow");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
  return ok();
  } catch (e) {
    console.error("[unlinkBankTransactionLink] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 5. setBankTransactionLinkCompleted — 紐付け完了フラグの切替
// ============================================
//
// 経理担当者が手動で「この銀行履歴の紐付けは完了」と判断したときにフラグを立てる
// 金額一致は強制しない (振込手数料等で差が出るため)
//
export async function setBankTransactionLinkCompleted(
  bankTransactionId: number,
  completed: boolean
): Promise<ActionResult> {
  await requireEdit("accounting");
  try {
    const bankTx = await prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, deletedAt: null },
      select: { id: true },
    });
    if (!bankTx) return err("銀行入出金履歴が見つかりません");

    await prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { linkCompleted: completed },
    });

    revalidatePath("/accounting/bank-transactions");
    return ok();
  } catch (e) {
    console.error("[setBankTransactionLinkCompleted] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 6. replaceBankTransactionLinks — 既存リンクを全て解除してから新しい割当で置換
// ============================================
//
// モーダルの保存時に使う：既存リンクを一掃してから新しいリンク群で置き換える。
//
export async function replaceBankTransactionLinks(
  bankTransactionId: number,
  allocations: LinkAllocation[],
  options?: { replaceManualReceipts?: boolean }
): Promise<ActionResult> {
  const session = await requireEdit("accounting");
  const staffId = session.id;
  try {
  const bankTx = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, deletedAt: null },
    select: { id: true, transactionDate: true },
  });
  if (!bankTx) return err("銀行入出金履歴が見つかりません");

  // バリデーション
  for (const a of allocations) {
    if (!Number.isFinite(a.amount) || a.amount <= 0) {
      return err("割当金額は1以上の数値で入力してください");
    }
  }

  await prisma.$transaction(async (tx) => {
    // 既存リンクを取得
    const existingLinks = await tx.bankTransactionGroupLink.findMany({
      where: { bankTransactionId },
      select: { id: true, invoiceGroupId: true, paymentGroupId: true },
    });

    // 既存リンクに紐づく自動生成記録を削除
    for (const l of existingLinks) {
      if (l.invoiceGroupId) {
        await tx.invoiceGroupReceipt.deleteMany({
          where: { bankTransactionLinkId: l.id },
        });
      }
      if (l.paymentGroupId) {
        await tx.paymentGroupPayment.deleteMany({
          where: { bankTransactionLinkId: l.id },
        });
      }
    }

    // 既存リンク自体を削除
    await tx.bankTransactionGroupLink.deleteMany({
      where: { bankTransactionId },
    });

    // 影響を受けたグループのIDを集めて actualPaymentDate を再計算
    const affectedInvoiceGroupIds = new Set(
      existingLinks.map((l) => l.invoiceGroupId).filter((x): x is number => !!x)
    );
    const affectedPaymentGroupIds = new Set(
      existingLinks.map((l) => l.paymentGroupId).filter((x): x is number => !!x)
    );

    // replaceManualReceipts = true の場合、新しく紐付けるグループの手動記録も削除
    if (options?.replaceManualReceipts) {
      const newInvoiceGroupIds = allocations
        .filter((a) => a.groupType === "invoice")
        .map((a) => a.groupId);
      const newPaymentGroupIds = allocations
        .filter((a) => a.groupType === "payment")
        .map((a) => a.groupId);

      if (newInvoiceGroupIds.length > 0) {
        await tx.invoiceGroupReceipt.deleteMany({
          where: {
            invoiceGroupId: { in: newInvoiceGroupIds },
            bankTransactionLinkId: null,
          },
        });
      }
      if (newPaymentGroupIds.length > 0) {
        await tx.paymentGroupPayment.deleteMany({
          where: {
            paymentGroupId: { in: newPaymentGroupIds },
            bankTransactionLinkId: null,
          },
        });
      }
    }

    // 新しい allocations で再作成
    for (const a of allocations) {
      const link = await tx.bankTransactionGroupLink.create({
        data: {
          bankTransactionId,
          invoiceGroupId: a.groupType === "invoice" ? a.groupId : null,
          paymentGroupId: a.groupType === "payment" ? a.groupId : null,
          amount: Math.round(a.amount),
          note: a.comment?.trim() || null,
          createdBy: staffId,
        },
      });

      if (a.groupType === "invoice") {
        await tx.invoiceGroupReceipt.create({
          data: {
            invoiceGroupId: a.groupId,
            receivedDate: bankTx.transactionDate,
            amount: Math.round(a.amount),
            comment: a.comment?.trim() || null,
            createdById: staffId,
            bankTransactionLinkId: link.id,
          },
        });
        affectedInvoiceGroupIds.add(a.groupId);
      } else {
        await tx.paymentGroupPayment.create({
          data: {
            paymentGroupId: a.groupId,
            paidDate: bankTx.transactionDate,
            amount: Math.round(a.amount),
            comment: a.comment?.trim() || null,
            createdById: staffId,
            bankTransactionLinkId: link.id,
          },
        });
        affectedPaymentGroupIds.add(a.groupId);
      }
    }

    // 影響を受けたグループの actualPaymentDate を再計算
    for (const gid of affectedInvoiceGroupIds) {
      await recalcInvoiceGroupActualPaymentDate(tx, gid);
    }
    for (const gid of affectedPaymentGroupIds) {
      await recalcPaymentGroupActualPaymentDate(tx, gid);
    }
  });

  revalidatePath("/accounting/bank-transactions");
  revalidatePath("/accounting/workflow");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
  return ok();
  } catch (e) {
    console.error("[replaceBankTransactionLinks] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
