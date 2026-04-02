import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { getBots, getRules, getGroups } from "./actions";
import { TelegramNotificationSettings } from "./telegram-notification-settings";

export default async function TelegramNotificationsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [bots, rules, groups] = await Promise.all([getBots(), getRules(), getGroups()]);

  const botsData = bots.map((b) => ({
    id: b.id,
    name: b.name,
    token: b.token,
    isActive: b.isActive,
  }));

  const groupsData = groups.map((g) => ({
    id: g.id,
    name: g.name,
    chatId: g.chatId,
    isActive: g.isActive,
    topics: g.topics.map((t) => ({
      id: t.id,
      name: t.name,
      topicId: t.topicId,
      isActive: t.isActive,
    })),
  }));

  const rulesData = rules.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    name: r.name,
    botId: r.botId,
    botName: r.bot.name,
    groupId: r.groupId,
    groupName: r.group?.name || null,
    eventType: r.eventType,
    bookingPrefix: r.bookingPrefix,
    topicStrategy: r.topicStrategy,
    fixedTopicId: r.fixedTopicId,
    fixedTopicName: r.fixedTopic?.name || null,
    messageTemplate: r.messageTemplate,
    customParams: r.customParams as Array<{ key: string; label: string }> | null,
    includeFormFields: r.includeFormFields as string[] | null,
    duplicateLockSeconds: r.duplicateLockSeconds,
    lineAccountType: r.lineAccountType,
    isActive: r.isActive,
    topicMappings: r.topicMappings.map((m) => ({
      id: m.id,
      staffName: m.staffName,
      telegramTopicId: m.telegramTopicId,
      topicName: m.topic?.name || null,
      telegramMention: m.telegramMention,
      isDefault: m.isDefault,
    })),
    logCount: r._count.logs,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Telegram通知設定</h1>
      <TelegramNotificationSettings
        bots={botsData}
        groups={groupsData}
        rules={rulesData}
        canEdit={canEdit}
      />
    </div>
  );
}
