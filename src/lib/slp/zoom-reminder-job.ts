import { prisma } from "@/lib/prisma";
import { sendZoomMessageViaProline } from "./zoom-proline-sender";

// 前日10:00 JSTリマインド判定: 「予約日時が明日（JST）かつ 現在JST時刻が10:00-10:59」
// 1時間前リマインド判定: 「予約日時まで 30-89分 の範囲」
// 送信済みフラグで二重送信を防止。
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
 * 1回のcron実行で：
 *  1) 「前日10:00」リマインド対象を抽出して送信
 *  2) 「開始1時間前」リマインド対象を抽出して送信
 * 抽出条件の詳細はコード内コメント参照。
 */
export async function runSlpZoomReminderJob(now: Date = new Date()): Promise<{
  dayBeforeProcessed: number;
  hourBeforeProcessed: number;
}> {
  let dayBeforeProcessed = 0;
  let hourBeforeProcessed = 0;

  // ============================================
  // 前日10:00 リマインド
  // 条件: 現在JST時刻が 10:00 台 かつ 予約日時が明日（JST）
  //       かつ ZoomJoinUrl あり かつ まだ送っていない
  // ============================================
  const nowJstHour = jstHourOfDay(now);
  if (nowJstHour === 10) {
    // 明日のJST日付の開始・終了 (UTC)
    const tomorrowStart = new Date(startOfJstDay(now).getTime() + 24 * 3600 * 1000);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 3600 * 1000);

    // briefing 前日10:00
    const briefingRows = await prisma.slpCompanyRecord.findMany({
      where: {
        briefingDate: { gte: tomorrowStart, lt: tomorrowEnd },
        briefingZoomJoinUrl: { not: null },
        briefingZoomRemindDaySentAt: null,
        briefingCanceledAt: null,
        deletedAt: null,
        prolineUid: { not: null },
      },
      include: {
        briefingZoomHost: { select: { name: true } },
      },
    });
    for (const r of briefingRows) {
      await processReminder({
        companyRecordId: r.id,
        uid: r.prolineUid!,
        category: "briefing",
        trigger: "remind_day_before",
        companyName: r.companyName,
        staffName: r.briefingZoomHost?.name ?? r.briefingStaff ?? null,
        dateJst: r.briefingDate,
        url: r.briefingZoomJoinUrl,
        updateField: "briefingZoomRemindDaySentAt",
      });
      dayBeforeProcessed++;
    }

    // consultation 前日10:00
    const consultRows = await prisma.slpCompanyRecord.findMany({
      where: {
        consultationDate: { gte: tomorrowStart, lt: tomorrowEnd },
        consultationZoomJoinUrl: { not: null },
        consultationZoomRemindDaySentAt: null,
        consultationCanceledAt: null,
        deletedAt: null,
        prolineUid: { not: null },
      },
      include: {
        consultationZoomHost: { select: { name: true } },
      },
    });
    for (const r of consultRows) {
      await processReminder({
        companyRecordId: r.id,
        uid: r.prolineUid!,
        category: "consultation",
        trigger: "remind_day_before",
        companyName: r.companyName,
        staffName: r.consultationZoomHost?.name ?? r.consultationStaff ?? null,
        dateJst: r.consultationDate,
        url: r.consultationZoomJoinUrl,
        updateField: "consultationZoomRemindDaySentAt",
      });
      dayBeforeProcessed++;
    }
  }

  // ============================================
  // 1時間前リマインド
  // 条件: 予約日時が (now + 30分) 〜 (now + 89分) の範囲
  //       この窓はcron15分間隔を想定（59分幅で必ず1回ヒット）
  // ============================================
  const hourWindowStart = new Date(now.getTime() + 30 * 60 * 1000);
  const hourWindowEnd = new Date(now.getTime() + 89 * 60 * 1000);

  const briefingHourRows = await prisma.slpCompanyRecord.findMany({
    where: {
      briefingDate: { gte: hourWindowStart, lte: hourWindowEnd },
      briefingZoomJoinUrl: { not: null },
      briefingZoomRemindHourSentAt: null,
      briefingCanceledAt: null,
      deletedAt: null,
      prolineUid: { not: null },
    },
    include: {
      briefingZoomHost: { select: { name: true } },
    },
  });
  for (const r of briefingHourRows) {
    await processReminder({
      companyRecordId: r.id,
      uid: r.prolineUid!,
      category: "briefing",
      trigger: "remind_hour_before",
      companyName: r.companyName,
      staffName: r.briefingZoomHost?.name ?? r.briefingStaff ?? null,
      dateJst: r.briefingDate,
      url: r.briefingZoomJoinUrl,
      updateField: "briefingZoomRemindHourSentAt",
    });
    hourBeforeProcessed++;
  }

  const consultHourRows = await prisma.slpCompanyRecord.findMany({
    where: {
      consultationDate: { gte: hourWindowStart, lte: hourWindowEnd },
      consultationZoomJoinUrl: { not: null },
      consultationZoomRemindHourSentAt: null,
      consultationCanceledAt: null,
      deletedAt: null,
      prolineUid: { not: null },
    },
    include: {
      consultationZoomHost: { select: { name: true } },
    },
  });
  for (const r of consultHourRows) {
    await processReminder({
      companyRecordId: r.id,
      uid: r.prolineUid!,
      category: "consultation",
      trigger: "remind_hour_before",
      companyName: r.companyName,
      staffName: r.consultationZoomHost?.name ?? r.consultationStaff ?? null,
      dateJst: r.consultationDate,
      url: r.consultationZoomJoinUrl,
      updateField: "consultationZoomRemindHourSentAt",
    });
    hourBeforeProcessed++;
  }

  return { dayBeforeProcessed, hourBeforeProcessed };
}

async function processReminder(params: {
  companyRecordId: number;
  uid: string;
  category: "briefing" | "consultation";
  trigger: "remind_day_before" | "remind_hour_before";
  companyName: string | null;
  staffName: string | null;
  dateJst: Date | null;
  url: string | null;
  updateField:
    | "briefingZoomRemindDaySentAt"
    | "briefingZoomRemindHourSentAt"
    | "consultationZoomRemindDaySentAt"
    | "consultationZoomRemindHourSentAt";
}): Promise<void> {
  const result = await sendZoomMessageViaProline({
    companyRecordId: params.companyRecordId,
    uid: params.uid,
    category: params.category,
    trigger: params.trigger,
    ctx: {
      companyName: params.companyName,
      staffName: params.staffName,
      dateJst: params.dateJst,
      url: params.url,
    },
  });
  // 送信成功時のみフラグを立てる（失敗時は次cronで再試行されるように未送信のまま）
  if (result.ok) {
    await prisma.slpCompanyRecord.update({
      where: { id: params.companyRecordId },
      data: { [params.updateField]: new Date() },
    });
  }
}
