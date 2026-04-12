import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { verifyCronAuth } from "@/lib/cron-auth";

// CoinGecko market_chart APIから直近180日の日次平均データを取得し、
// DB未登録の日付をバックフィルする。
// 当日と前日は日次データが確定していない可能性があるため除外し、
// 前々日までのデータのみ保存する。
// （AM1:00実行を想定 → 前日分は0:00~23:59のデータが揃った状態で取得可能）
async function backfillUsdtRates(): Promise<{ inserted: number; total: number }> {
  // 180日分の日次データを取得（days>90 → 日次粒度で返る）
  const response = await fetch(
    "https://api.coingecko.com/api/v3/coins/tether/market_chart?vs_currency=jpy&days=180",
    { next: { revalidate: 0 } }
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API returned ${response.status}`);
  }

  const data = await response.json();
  const prices: [number, number][] = data?.prices;

  if (!Array.isArray(prices) || prices.length === 0) {
    throw new Error("CoinGeckoから有効なデータを取得できませんでした");
  }

  // 当日（UTC）を算出 → 当日は除外（日次平均が未確定）
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // 日付ごとにデータポイントをグループ化して平均を計算
  const dailyMap = new Map<string, number[]>();
  for (const [timestamp, price] of prices) {
    const dateStr = new Date(timestamp).toISOString().split("T")[0];
    if (dateStr === todayStr) continue;
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, []);
    }
    dailyMap.get(dateStr)!.push(price);
  }

  // 日次平均レートを計算
  const dailyRates: { date: Date; rate: number }[] = [];
  for (const [dateStr, values] of dailyMap) {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const date = new Date(dateStr);
    date.setUTCHours(0, 0, 0, 0);
    dailyRates.push({ date, rate: Math.round(avg * 10000) / 10000 });
  }

  // DB に既存の日付を取得
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
  sixMonthsAgo.setUTCHours(0, 0, 0, 0);

  const existingRates = await prisma.usdtDailyRate.findMany({
    where: { date: { gte: sixMonthsAgo } },
    select: { date: true },
  });
  const existingDates = new Set(
    existingRates.map((r) => r.date.toISOString().split("T")[0])
  );

  // 未登録の日付だけ挿入
  const toInsert = dailyRates.filter(
    (r) => !existingDates.has(r.date.toISOString().split("T")[0])
  );

  if (toInsert.length > 0) {
    await prisma.usdtDailyRate.createMany({
      data: toInsert.map((r) => ({
        date: r.date,
        rate: r.rate,
        source: "coingecko",
      })),
      skipDuplicates: true,
    });
  }

  return { inserted: toInsert.length, total: dailyRates.length };
}

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const result = await backfillUsdtRates();

    console.log(
      `[Cron] USDT/JPY rates backfilled: ${result.inserted} new / ${result.total} total days`
    );

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      totalDays: result.total,
    });
  } catch (err) {
    console.error("[Cron] fetch-usdt-rate failed:", err);
    await logAutomationError({
      source: "cron/fetch-usdt-rate",
      message: err instanceof Error ? err.message : "不明なエラー",
      detail: { error: String(err) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
