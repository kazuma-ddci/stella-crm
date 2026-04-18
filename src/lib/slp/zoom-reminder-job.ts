import { prisma } from "@/lib/prisma";
import { sendSessionNotification } from "./slp-session-notification";
import { getNotifiableCustomerLineFriendIds } from "./session-helper";
import { logAutomationError } from "@/lib/automation-error";

// 前日10:00 JSTリマインド判定: 「予約日時が明日（JST）かつ 現在JST時刻が10:00-10:59」
// 1時間前リマインド判定: 「予約日時まで 30-89分 の範囲」
// 送信済みフラグ (SlpZoomRecording.remindDaySentAt / remindHourSentAt) で二重送信を防止。
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
 * primary Recording を ContactHistory → Session 経由で絞り込むための共通クエリ。
 */
async function findPrimaryRecordingsForReminder(params: {
  scheduledFrom: Date;
  scheduledTo: Date;
  field: "remindDaySentAt" | "remindHourSentAt";
}) {
  return prisma.slpZoomRecording.findMany({
    where: {
      isPrimary: true,
      deletedAt: null,
      joinUrl: { not: "" },
      [params.field]: null,
      contactHistory: {
        deletedAt: null,
        session: {
          status: "予約中",
          scheduledAt: { gte: params.scheduledFrom, lte: params.scheduledTo },
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      contactHistory: {
        select: {
          sessionId: true,
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
  trigger: "remind_day_before" | "remind_hour_before"
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
 * 1回のcron実行で:
 *  1) 「前日10:00」リマインド対象を抽出して送信
 *  2) 「開始1時間前」リマインド対象を抽出して送信
 *
 * 抽出対象: 「予約中」セッション × primary Recording あり × join_url あり × 未送信
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

    const recordings = await findPrimaryRecordingsForReminder({
      scheduledFrom: tomorrowStart,
      scheduledTo: tomorrowEnd,
      field: "remindDaySentAt",
    });

    for (const r of recordings) {
      const sessionId = r.contactHistory?.sessionId;
      if (!sessionId) continue;
      const { sent } = await sendReminderToAllCustomers(
        sessionId,
        "remind_day_before"
      );
      if (sent) {
        await prisma.slpZoomRecording.update({
          where: { id: r.id },
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

  const hourRecordings = await findPrimaryRecordingsForReminder({
    scheduledFrom: hourWindowStart,
    scheduledTo: hourWindowEnd,
    field: "remindHourSentAt",
  });

  for (const r of hourRecordings) {
    const sessionId = r.contactHistory?.sessionId;
    if (!sessionId) continue;
    const { sent } = await sendReminderToAllCustomers(
      sessionId,
      "remind_hour_before"
    );
    if (sent) {
      await prisma.slpZoomRecording.update({
        where: { id: r.id },
        data: { remindHourSentAt: new Date() },
      });
      hourBeforeProcessed++;
    }
  }

  return { dayBeforeProcessed, hourBeforeProcessed };
}
