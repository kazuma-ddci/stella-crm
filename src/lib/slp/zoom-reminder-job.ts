import { prisma } from "@/lib/prisma";
import { sendSessionNotification } from "./slp-session-notification";

// 前日10:00 JSTリマインド判定: 「予約日時が明日（JST）かつ 現在JST時刻が10:00-10:59」
// 1時間前リマインド判定: 「予約日時まで 30-89分 の範囲」
// 送信済みフラグ (SlpMeetingSessionZoom.remindDaySentAt / remindHourSentAt) で二重送信を防止。
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
 * 1回のcron実行で:
 *  1) 「前日10:00」リマインド対象を抽出して送信
 *  2) 「開始1時間前」リマインド対象を抽出して送信
 *
 * 抽出対象: 「予約中」セッション × primary Zoomあり × join_url あり × 未送信
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
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 3600 * 1000);

    const primaryZooms = await prisma.slpMeetingSessionZoom.findMany({
      where: {
        isPrimary: true,
        deletedAt: null,
        remindDaySentAt: null,
        joinUrl: { not: "" },
        session: {
          status: "予約中",
          scheduledAt: { gte: tomorrowStart, lt: tomorrowEnd },
          deletedAt: null,
        },
      },
      select: { id: true, sessionId: true },
    });

    for (const z of primaryZooms) {
      const result = await sendSessionNotification({
        sessionId: z.sessionId,
        recipient: "customer",
        trigger: "remind_day_before",
      });
      if (result.ok || result.skipped === true) {
        await prisma.slpMeetingSessionZoom.update({
          where: { id: z.id },
          data: { remindDaySentAt: new Date() },
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

  const hourZooms = await prisma.slpMeetingSessionZoom.findMany({
    where: {
      isPrimary: true,
      deletedAt: null,
      remindHourSentAt: null,
      joinUrl: { not: "" },
      session: {
        status: "予約中",
        scheduledAt: { gte: hourWindowStart, lte: hourWindowEnd },
        deletedAt: null,
      },
    },
    select: { id: true, sessionId: true },
  });

  for (const z of hourZooms) {
    const result = await sendSessionNotification({
      sessionId: z.sessionId,
      recipient: "customer",
      trigger: "remind_hour_before",
    });
    if (result.ok || result.skipped === true) {
      await prisma.slpMeetingSessionZoom.update({
        where: { id: z.id },
        data: { remindHourSentAt: new Date() },
      });
      hourBeforeProcessed++;
    }
  }

  return { dayBeforeProcessed, hourBeforeProcessed };
}
