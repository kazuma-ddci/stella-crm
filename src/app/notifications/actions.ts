"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
