"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canApprove } from "@/lib/auth";
import { recordChangeLog } from "@/app/accounting/changelog/actions";

// ============================================
// 型定義
// ============================================

export type NotificationRow = {
  id: number;
  recipientId: number;
  senderType: string;
  senderId: number | null;
  category: string;
  title: string;
  message: string;
  linkUrl: string | null;
  status: string;
  statusChangedAt: Date | null;
  statusChangedBy: number | null;
  actionType: string | null;
  actionTargetId: number | null;
  createdAt: Date;
  sender: { id: number; name: string } | null;
  statusChanger: { id: number; name: string } | null;
};

// ============================================
// 定数
// ============================================

const VALID_STATUSES = ["unread", "read", "in_progress", "completed"] as const;
const VALID_CATEGORIES = ["finance", "accounting", "kpi", "system", "other"] as const;

// ============================================
// Server Actions
// ============================================

/**
 * 通知一覧を取得（自分宛のみ）
 */
export async function listNotifications(): Promise<NotificationRow[]> {
  const session = await getSession();

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: session.id,
    },
    include: {
      sender: { select: { id: true, name: true } },
      statusChanger: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return notifications;
}

/**
 * 通知ステータスを更新
 */
export async function updateNotificationStatus(
  id: number,
  newStatus: string
): Promise<void> {
  const session = await getSession();

  // バリデーション
  if (!(VALID_STATUSES as readonly string[]).includes(newStatus)) {
    throw new Error(`無効なステータスです: ${newStatus}`);
  }

  // 自分宛の通知かチェック
  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { recipientId: true },
  });

  if (!notification) {
    throw new Error("通知が見つかりません");
  }

  if (notification.recipientId !== session.id) {
    throw new Error("この通知を操作する権限がありません");
  }

  await prisma.notification.update({
    where: { id },
    data: {
      status: newStatus,
      statusChangedAt: new Date(),
      statusChangedBy: session.id,
    },
  });

  revalidatePath("/notifications");
}

/**
 * 通知を一括既読にする
 */
export async function markAllAsRead(): Promise<void> {
  const session = await getSession();

  await prisma.notification.updateMany({
    where: {
      recipientId: session.id,
      status: "unread",
    },
    data: {
      status: "read",
      statusChangedAt: new Date(),
      statusChangedBy: session.id,
    },
  });

  revalidatePath("/notifications");
}

/**
 * 通知を作成（Server Action版 — 直接呼び出し用）
 */
export async function createNotification(data: {
  recipientId: number;
  senderType: "system" | "staff";
  senderId?: number;
  category: string;
  title: string;
  message: string;
  linkUrl?: string;
}): Promise<void> {
  // カテゴリバリデーション
  if (!(VALID_CATEGORIES as readonly string[]).includes(data.category)) {
    throw new Error(`無効なカテゴリです: ${data.category}`);
  }

  await prisma.notification.create({
    data: {
      recipientId: data.recipientId,
      senderType: data.senderType,
      senderId: data.senderId ?? null,
      category: data.category,
      title: data.title,
      message: data.message,
      linkUrl: data.linkUrl ?? null,
    },
  });

  revalidatePath("/notifications");
}

/**
 * 未読通知件数を取得（ヘッダーバッジ用）
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getSession();

  const count = await prisma.notification.count({
    where: {
      recipientId: session.id,
      status: "unread",
    },
  });

  return count;
}

// ============================================
// アクション付き通知
// ============================================

/**
 * 支払グループの概要を取得（通知内表示用）
 */
export type PaymentGroupSummary = {
  id: number;
  counterpartyName: string;
  operatingCompanyName: string;
  totalAmount: number | null;
  taxAmount: number | null;
  transactionCount: number;
  status: string;
  createdByName: string;
};

export async function getPaymentGroupSummary(
  groupId: number
): Promise<PaymentGroupSummary | null> {
  const group = await prisma.paymentGroup.findUnique({
    where: { id: groupId, deletedAt: null },
    include: {
      counterparty: { select: { name: true } },
      operatingCompany: { select: { companyName: true } },
      transactions: { where: { deletedAt: null }, select: { id: true } },
      creator: { select: { name: true } },
    },
  });
  if (!group) return null;

  return {
    id: group.id,
    counterpartyName: group.counterparty.name,
    operatingCompanyName: group.operatingCompany.companyName,
    totalAmount: group.totalAmount,
    taxAmount: group.taxAmount,
    transactionCount: group.transactions.length,
    status: group.status,
    createdByName: group.creator.name,
  };
}

/**
 * 通知からの支払グループ承認
 */
export async function approvePaymentGroupFromNotification(
  notificationId: number
): Promise<void> {
  const session = await getSession();

  // 承認権限チェック
  if (!canApprove(session.permissions, "stp")) {
    throw new Error("承認権限がありません");
  }

  // 通知を取得
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) throw new Error("通知が見つかりません");
  if (notification.recipientId !== session.id) {
    throw new Error("この通知を操作する権限がありません");
  }
  if (notification.actionType !== "payment_group_approval" || !notification.actionTargetId) {
    throw new Error("この通知にはアクションがありません");
  }

  // 支払グループを承認
  const group = await prisma.paymentGroup.findUnique({
    where: { id: notification.actionTargetId, deletedAt: null },
  });
  if (!group) throw new Error("支払グループが見つかりません");
  if (group.status !== "pending_approval") {
    throw new Error("既に承認済みまたはステータスが変更されています");
  }

  await prisma.$transaction(async (tx) => {
    // 支払グループを承認
    await tx.paymentGroup.update({
      where: { id: group.id },
      data: {
        status: "before_request",
        confirmedBy: session.id,
        confirmedAt: new Date(),
        updatedBy: session.id,
      },
    });

    // 通知を完了に更新
    await tx.notification.update({
      where: { id: notificationId },
      data: {
        status: "completed",
        statusChangedAt: new Date(),
        statusChangedBy: session.id,
      },
    });

    // 同じ支払グループの承認通知を他の承認者にも完了にする
    await tx.notification.updateMany({
      where: {
        actionType: "payment_group_approval",
        actionTargetId: group.id,
        id: { not: notificationId },
        status: { not: "completed" },
      },
      data: {
        status: "completed",
        statusChangedAt: new Date(),
        statusChangedBy: session.id,
      },
    });

    await recordChangeLog({
      tableName: "PaymentGroup",
      recordId: group.id,
      changeType: "update",
      oldData: { status: "pending_approval" },
      newData: { status: "before_request", approvedBy: session.id },
    }, session.id, tx);
  });

  revalidatePath("/notifications");
  revalidatePath("/stp/finance/payment-groups");
}
