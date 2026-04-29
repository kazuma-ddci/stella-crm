import { prisma } from "@/lib/prisma";
import { sendSessionNotification } from "./slp-session-notification";
import { getNotifiableCustomerLineFriendIds } from "./session-helper";
import { logAutomationError } from "@/lib/automation-error";
import { SOURCE_TYPE as SLP_V2_SOURCE_TYPE } from "./v2-session-sync";

// 前日10:00 JSTリマインド判定: 「予約日時が明日（JST）かつ 現在JST時刻が10:00-10:59」
// 1時間前リマインド判定: 「予約日時まで 30-89分 の範囲」
// 送信済みフラグ (ContactHistoryMeeting.reminderDaySentAt / reminderHourSentAt) で二重送信を防止。
// cron間隔: 15分おき想定（少し余裕を持たせて "10:00-10:59" の窓で必ずヒットさせる）

const JST_OFFSET_MIN = 9 * 60; // UTC+9

function toJst(d: Date): Date {
  return new Date(d.getTime() + JST_OFFSET_MIN * 60 * 1000);
}

function startOfJstDay(d: Date): Date {
  const j = toJst(d);
  j.setUTCHours(0, 0, 0, 0);
  return new Date(j.getTime() - JST_OFFSET_MIN * 60 * 1000); // UTCに戻す
}

function jstHourOfDay(d: Date): number {
  return toJst(d).getUTCHours();
}

/**
 * V2 ContactHistoryMeeting (primary, zoom) を、紐付く SLP 商談セッションが「予約中」で
 * 指定時間範囲に scheduledStartAt があるものに絞り込む共通クエリ。
 */
async function findV2PrimaryMeetingsForReminder(params: {
  scheduledFrom: Date;
  scheduledTo: Date;
  field: "reminderDaySentAt" | "reminderHourSentAt";
}) {
  return prisma.contactHistoryMeeting.findMany({
    where: {
      isPrimary: true,
      provider: "zoom",
      deletedAt: null,
      joinUrl: { not: null },
      [params.field]: null,
      scheduledStartAt: { gte: params.scheduledFrom, lte: params.scheduledTo },
      contactHistory: {
        deletedAt: null,
        sourceType: SLP_V2_SOURCE_TYPE,
        status: "scheduled",
      },
    },
    select: {
      id: true,
      contactHistory: {
        select: {
          sourceRefId: true,
        },
      },
    },
  });
}

/**
 * 1セッションに対し、getNotifiableCustomerLineFriendIds で解決した全対象へ
 * リマインド通知を送信する。1件でも成功（or skipped）があれば sent=true を返す。
 */
async function sendReminderToAllCustomers(
  sessionId: number,
  trigger: "remind_day_before" | "remind_hour_before",
): Promise<{ sent: boolean }> {
  const lineFriendIds = await getNotifiableCustomerLineFriendIds(sessionId);

  if (lineFriendIds.length === 0) {
    await logAutomationError({
      source: `slp-reminder-${trigger}`,
      message: `リマインド送信対象ゼロ件: sessionId=${sessionId}`,
      detail: {
        reason:
          "予約者未設定、かつ receivesSessionNotifications=true の担当者もLINE紐付けなし。",
      },
    });
    return { sent: false };
  }

  let anySucceeded = false;
  for (const lineFriendId of lineFriendIds) {
    try {
      const r = await sendSessionNotification({
        sessionId,
        recipient: "customer",
        trigger,
        customerLineFriendId: lineFriendId,
      });
      if (r.ok || r.skipped === true) {
        anySucceeded = true;
      } else {
        await logAutomationError({
          source: `slp-reminder-${trigger}`,
          message: `リマインド送信失敗: sessionId=${sessionId}`,
          detail: {
            errorMessage: r.errorMessage,
            customerLineFriendId: lineFriendId,
          },
        });
      }
    } catch (e) {
      await logAutomationError({
        source: `slp-reminder-${trigger}`,
        message: `リマインド呼び出し失敗: sessionId=${sessionId}`,
        detail: {
          error: e instanceof Error ? e.message : String(e),
          customerLineFriendId: lineFriendId,
        },
      });
    }
  }
  return { sent: anySucceeded };
}

/**
 * sourceRefId (string) から sessionId (number) に変換。invalid なら null。
 */
function parseSessionId(sourceRefId: string | null | undefined): number | null {
  if (!sourceRefId) return null;
  // 厳密な整数チェック (parseInt は "12abc" を 12 として返すため文字列一致で検証)
  if (!/^\d+$/.test(sourceRefId)) return null;
  const n = parseInt(sourceRefId, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * 1回のcron実行で:
 *  1) 「前日10:00」リマインド対象を抽出して送信
 *  2) 「開始1時間前」リマインド対象を抽出して送信
 *
 * 抽出対象: 「予約中」セッション × V2 primary ContactHistoryMeeting あり × join_url あり × 未送信
 */
export async function runSlpZoomReminderJob(now: Date = new Date()): Promise<{
  dayBeforeProcessed: number;
  hourBeforeProcessed: number;
}> {
  let dayBeforeProcessed = 0;
  let hourBeforeProcessed = 0;

  // ============================================
  // 前日10:00 リマインド
  // ============================================
  const nowJstHour = jstHourOfDay(now);
  if (nowJstHour === 10) {
    const tomorrowStart = new Date(startOfJstDay(now).getTime() + 24 * 3600 * 1000);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 3600 * 1000 - 1);

    const meetings = await findV2PrimaryMeetingsForReminder({
      scheduledFrom: tomorrowStart,
      scheduledTo: tomorrowEnd,
      field: "reminderDaySentAt",
    });

    for (const m of meetings) {
      const sessionId = parseSessionId(m.contactHistory?.sourceRefId);
      if (!sessionId) continue;
      const { sent } = await sendReminderToAllCustomers(
        sessionId,
        "remind_day_before",
      );
      if (sent) {
        await prisma.contactHistoryMeeting.update({
          where: { id: m.id },
          data: { reminderDaySentAt: new Date() },
        });
        dayBeforeProcessed++;
      }
    }
  }

  // ============================================
  // 1時間前リマインド
  // 条件: 予約日時が (now + 30分) 〜 (now + 89分) の範囲
  // ============================================
  const hourWindowStart = new Date(now.getTime() + 30 * 60 * 1000);
  const hourWindowEnd = new Date(now.getTime() + 89 * 60 * 1000);

  const hourMeetings = await findV2PrimaryMeetingsForReminder({
    scheduledFrom: hourWindowStart,
    scheduledTo: hourWindowEnd,
    field: "reminderHourSentAt",
  });

  for (const m of hourMeetings) {
    const sessionId = parseSessionId(m.contactHistory?.sourceRefId);
    if (!sessionId) continue;
    const { sent } = await sendReminderToAllCustomers(
      sessionId,
      "remind_hour_before",
    );
    if (sent) {
      await prisma.contactHistoryMeeting.update({
        where: { id: m.id },
        data: { reminderHourSentAt: new Date() },
      });
      hourBeforeProcessed++;
    }
  }

  return { dayBeforeProcessed, hourBeforeProcessed };
}
