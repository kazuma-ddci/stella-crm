import { prisma } from "@/lib/prisma";

// ============================================
// 型定義
// ============================================

type NotificationCategory = "finance" | "accounting" | "kpi" | "system" | "other";

type CreateNotificationParams = {
  recipientId: number;
  senderType: "system" | "staff";
  senderId?: number;
  category: NotificationCategory;
  title: string;
  message: string;
  linkUrl?: string;
  actionType?: string;
  actionTargetId?: number;
};

// ============================================
// 通知発行ヘルパー関数（設計書 8.5）
// ============================================

/**
 * 通知を1件作成する。
 * 各業務アクション（差し戻し、入金完了、按分確定依頼等）から呼び出す。
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  await prisma.notification.create({
    data: {
      recipientId: params.recipientId,
      senderType: params.senderType,
      senderId: params.senderId ?? null,
      category: params.category,
      title: params.title,
      message: params.message,
      linkUrl: params.linkUrl ?? null,
      actionType: params.actionType ?? null,
      actionTargetId: params.actionTargetId ?? null,
    },
  });
}

/**
 * 同じ通知を複数の宛先に一括送信する。
 */
export async function createNotificationBulk(
  recipientIds: number[],
  params: Omit<CreateNotificationParams, "recipientId">
): Promise<void> {
  if (recipientIds.length === 0) return;

  await prisma.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      senderType: params.senderType,
      senderId: params.senderId ?? null,
      category: params.category,
      title: params.title,
      message: params.message,
      linkUrl: params.linkUrl ?? null,
      actionType: params.actionType ?? null,
      actionTargetId: params.actionTargetId ?? null,
    })),
  });
}
