"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

const REVALIDATE_PATH = "/hojo/settings/telegram-notifications";

// ============================================
// Bot CRUD
// ============================================

export async function getBots() {
  return prisma.hojoTelegramBot.findMany({ orderBy: { id: "asc" } });
}

export async function createBot(data: { name: string; token: string; chatId: string }) {
  await requireProjectMasterDataEditPermission();
  await prisma.hojoTelegramBot.create({ data });
  revalidatePath(REVALIDATE_PATH);
}

export async function updateBot(id: number, data: { name?: string; token?: string; chatId?: string; isActive?: boolean }) {
  await requireProjectMasterDataEditPermission();
  await prisma.hojoTelegramBot.update({ where: { id }, data });
  revalidatePath(REVALIDATE_PATH);
}

export async function deleteBot(id: number) {
  await requireProjectMasterDataEditPermission();
  await prisma.hojoTelegramBot.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}

export async function testBot(id: number) {
  await requireProjectMasterDataEditPermission();
  const bot = await prisma.hojoTelegramBot.findUnique({ where: { id } });
  if (!bot) throw new Error("Bot not found");

  const payload: Record<string, string> = {
    chat_id: bot.chatId,
    text: `[テスト] Stella CRM からのテスト通知です (${new Date().toLocaleString("ja-JP")})`,
  };

  const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!result.ok) {
    throw new Error(`Telegram API error: ${result.description || "Unknown error"}`);
  }
  return { success: true };
}

// ============================================
// Rule CRUD
// ============================================

export async function getRules() {
  return prisma.hojoTelegramNotificationRule.findMany({
    orderBy: { id: "asc" },
    include: {
      bot: { select: { id: true, name: true } },
      topicMappings: { orderBy: { id: "asc" } },
      _count: { select: { logs: true } },
    },
  });
}

export type TopicMappingInput = {
  staffName: string;
  topicId: string;
  telegramMention?: string;
  isDefault: boolean;
};

export type RuleInput = {
  name: string;
  botId: number;
  eventType: string;
  bookingPrefix?: string;
  topicStrategy: string;
  fixedTopicId?: string;
  messageTemplate: string;
  customParams?: Array<{ key: string; label: string }>;
  includeFormFields?: string[];
  duplicateLockSeconds?: number;
  lineAccountType?: string;
  topicMappings: TopicMappingInput[];
};

export async function createRule(input: RuleInput) {
  await requireProjectMasterDataEditPermission();

  const { topicMappings, ...ruleData } = input;

  const rule = await prisma.hojoTelegramNotificationRule.create({
    data: {
      ...ruleData,
      bookingPrefix: ruleData.bookingPrefix || null,
      fixedTopicId: ruleData.fixedTopicId || null,
      customParams: ruleData.customParams || undefined,
      includeFormFields: ruleData.includeFormFields || undefined,
      duplicateLockSeconds: ruleData.duplicateLockSeconds || 180,
      lineAccountType: ruleData.lineAccountType || null,
      topicMappings: {
        create: topicMappings.map((m) => ({
          staffName: m.staffName,
          topicId: m.topicId,
          telegramMention: m.telegramMention || null,
          isDefault: m.isDefault,
        })),
      },
    },
    include: { topicMappings: true },
  });

  revalidatePath(REVALIDATE_PATH);
  return rule;
}

export async function updateRule(id: number, input: RuleInput) {
  await requireProjectMasterDataEditPermission();

  const { topicMappings, ...ruleData } = input;

  // トピックマッピングを差し替え
  await prisma.hojoTelegramTopicMapping.deleteMany({ where: { ruleId: id } });

  const rule = await prisma.hojoTelegramNotificationRule.update({
    where: { id },
    data: {
      ...ruleData,
      bookingPrefix: ruleData.bookingPrefix || null,
      fixedTopicId: ruleData.fixedTopicId || null,
      customParams: ruleData.customParams || undefined,
      includeFormFields: ruleData.includeFormFields || undefined,
      duplicateLockSeconds: ruleData.duplicateLockSeconds || 180,
      lineAccountType: ruleData.lineAccountType || null,
      topicMappings: {
        create: topicMappings.map((m) => ({
          staffName: m.staffName,
          topicId: m.topicId,
          telegramMention: m.telegramMention || null,
          isDefault: m.isDefault,
        })),
      },
    },
    include: { topicMappings: true },
  });

  revalidatePath(REVALIDATE_PATH);
  return rule;
}

export async function deleteRule(id: number) {
  await requireProjectMasterDataEditPermission();
  await prisma.hojoTelegramNotificationRule.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}

export async function toggleRule(id: number, isActive: boolean) {
  await requireProjectMasterDataEditPermission();
  await prisma.hojoTelegramNotificationRule.update({
    where: { id },
    data: { isActive },
  });
  revalidatePath(REVALIDATE_PATH);
}

// ============================================
// ログ取得
// ============================================

export async function getRuleLogs(ruleId: number, limit = 50) {
  return prisma.hojoTelegramNotificationLog.findMany({
    where: { ruleId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
