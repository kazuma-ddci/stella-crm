import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { getBots, getRules } from "./actions";
import { TelegramNotificationSettings } from "./telegram-notification-settings";

export default async function TelegramNotificationsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [bots, rules] = await Promise.all([getBots(), getRules()]);

  const botsData = bots.map((b) => ({
    id: b.id,
    name: b.name,
    token: b.token,
    chatId: b.chatId,
    isActive: b.isActive,
  }));

  const rulesData = rules.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    name: r.name,
    botId: r.botId,
    botName: r.bot.name,
    eventType: r.eventType,
    bookingPrefix: r.bookingPrefix,
    topicStrategy: r.topicStrategy,
    fixedTopicId: r.fixedTopicId,
    messageTemplate: r.messageTemplate,
    customParams: r.customParams as Array<{ key: string; label: string }> | null,
    includeFormFields: r.includeFormFields as string[] | null,
    duplicateLockSeconds: r.duplicateLockSeconds,
    lineAccountType: r.lineAccountType,
    isActive: r.isActive,
    topicMappings: r.topicMappings.map((m) => ({
      id: m.id,
      staffName: m.staffName,
      topicId: m.topicId,
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
        rules={rulesData}
        canEdit={canEdit}
      />
    </div>
  );
}
