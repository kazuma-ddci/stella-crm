"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { ok, err, type ActionResult } from "@/lib/action-result";

const REVALIDATE_PATH = "/hojo/settings/telegram-notifications";

// ============================================
// Bot CRUD
// ============================================

export async function getBots() {
  return prisma.hojoTelegramBot.findMany({ orderBy: { id: "asc" } });
}

export async function createBot(data: { name: string; token: string }): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramBot.create({ data });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[createBot] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateBot(id: number, data: { name?: string; token?: string; isActive?: boolean }): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramBot.update({ where: { id }, data });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[updateBot] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteBot(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramBot.delete({ where: { id } });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[deleteBot] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function testBot(id: number, chatId: string): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const bot = await prisma.hojoTelegramBot.findUnique({ where: { id } });
    if (!bot) return err("Bot not found");
    if (!chatId.trim()) return err("チャットIDを入力してください");

    const payload: Record<string, string> = {
      chat_id: chatId.trim(),
      text: `[テスト] Stella CRM からのテスト通知です (${new Date().toLocaleString("ja-JP")})`,
    };

    const res = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result.ok) {
      return err(`Telegram API error: ${result.description || "Unknown error"}`);
    }
    return ok();
  } catch (e) {
    console.error("[testBot] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// Group CRUD
// ============================================

export async function getGroups() {
  return prisma.hojoTelegramGroup.findMany({
    orderBy: { id: "asc" },
    include: { topics: { orderBy: { id: "asc" } } },
  });
}

export async function createGroup(data: { name: string; chatId: string }): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramGroup.create({ data });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[createGroup] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateGroup(id: number, data: { name?: string; chatId?: string }): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramGroup.update({ where: { id }, data });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[updateGroup] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteGroup(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramGroup.delete({ where: { id } });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[deleteGroup] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// Topic CRUD
// ============================================

export async function createTopic(data: { groupId: number; name: string; topicId: string }): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramTopic.create({ data });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[createTopic] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateTopic(id: number, data: { name?: string; topicId?: string }): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramTopic.update({ where: { id }, data });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[updateTopic] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteTopic(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramTopic.delete({ where: { id } });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[deleteTopic] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// Rule CRUD
// ============================================

export async function getRules() {
  return prisma.hojoTelegramNotificationRule.findMany({
    orderBy: { id: "asc" },
    include: {
      bot: { select: { id: true, name: true } },
      group: { select: { id: true, name: true, chatId: true } },
      fixedTopic: { select: { id: true, name: true, topicId: true } },
      topicMappings: {
        orderBy: { id: "asc" },
        include: { topic: { select: { id: true, name: true, topicId: true, groupId: true } } },
      },
      _count: { select: { logs: true } },
    },
  });
}

export type TopicMappingInput = {
  staffName: string;
  telegramTopicId: number | null;
  telegramMention?: string;
  isDefault: boolean;
};

export type RuleInput = {
  name: string;
  botId: number;
  groupId?: number;
  eventType: string;
  bookingPrefix?: string;
  topicStrategy: string;
  fixedTopicId?: number;
  messageTemplate: string;
  customParams?: Array<{ key: string; label: string }>;
  includeFormFields?: string[];
  duplicateLockSeconds?: number;
  lineAccountType?: string;
  topicMappings: TopicMappingInput[];
};

export async function createRule(input: RuleInput): Promise<ActionResult<{ id: number }>> {
  try {
  await requireProjectMasterDataEditPermission();

  const { topicMappings, ...ruleData } = input;

  const rule = await prisma.hojoTelegramNotificationRule.create({
    data: {
      name: ruleData.name,
      botId: ruleData.botId,
      groupId: ruleData.groupId || null,
      eventType: ruleData.eventType,
      bookingPrefix: ruleData.bookingPrefix || null,
      topicStrategy: ruleData.topicStrategy,
      fixedTopicId: ruleData.fixedTopicId || null,
      messageTemplate: ruleData.messageTemplate,
      customParams: ruleData.customParams || undefined,
      includeFormFields: ruleData.includeFormFields || undefined,
      duplicateLockSeconds: ruleData.duplicateLockSeconds || 180,
      lineAccountType: ruleData.lineAccountType || null,
      topicMappings: {
        create: topicMappings.map((m) => ({
          staffName: m.staffName,
          telegramTopicId: m.telegramTopicId,
          telegramMention: m.telegramMention || null,
          isDefault: m.isDefault,
        })),
      },
    },
  });

  revalidatePath(REVALIDATE_PATH);
  return ok({ id: rule.id });
  } catch (e) {
    console.error("[createRule] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateRule(id: number, input: RuleInput): Promise<ActionResult<{ id: number }>> {
  try {
  await requireProjectMasterDataEditPermission();

  const { topicMappings, ...ruleData } = input;

  await prisma.hojoTelegramTopicMapping.deleteMany({ where: { ruleId: id } });

  const rule = await prisma.hojoTelegramNotificationRule.update({
    where: { id },
    data: {
      name: ruleData.name,
      botId: ruleData.botId,
      groupId: ruleData.groupId || null,
      eventType: ruleData.eventType,
      bookingPrefix: ruleData.bookingPrefix || null,
      topicStrategy: ruleData.topicStrategy,
      fixedTopicId: ruleData.fixedTopicId || null,
      messageTemplate: ruleData.messageTemplate,
      customParams: ruleData.customParams || undefined,
      includeFormFields: ruleData.includeFormFields || undefined,
      duplicateLockSeconds: ruleData.duplicateLockSeconds || 180,
      lineAccountType: ruleData.lineAccountType || null,
      topicMappings: {
        create: topicMappings.map((m) => ({
          staffName: m.staffName,
          telegramTopicId: m.telegramTopicId,
          telegramMention: m.telegramMention || null,
          isDefault: m.isDefault,
        })),
      },
    },
  });

  revalidatePath(REVALIDATE_PATH);
  return ok({ id: rule.id });
  } catch (e) {
    console.error("[updateRule] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteRule(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramNotificationRule.delete({ where: { id } });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[deleteRule] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function toggleRule(id: number, isActive: boolean): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoTelegramNotificationRule.update({
      where: { id },
      data: { isActive },
    });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[toggleRule] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
