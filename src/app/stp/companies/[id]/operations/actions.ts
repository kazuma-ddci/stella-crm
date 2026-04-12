"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { toLocalDateString } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";
import type {
  ParsedDailyRow,
  ParsedJobPostingRow,
} from "@/lib/csv/airwork-parser";

// ============================================
// 型定義
// ============================================

export type MediaAdSummary = {
  id: number;
  adNumber: string;
  adName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetLimit: number | null;
  dailyMetricCount: number;
  jobPostingCount: number;
  lastDataDate: string | null;
};

export type ContractWithAds = {
  id: number;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  contractPlan: string;
  ads: MediaAdSummary[];
};

export type DailyMetric = {
  id: number;
  date: string;
  impressions: number;
  clicks: number;
  applicationStarts: number;
  applications: number;
  cost: number;
  ctr: number | null;
  applicationStartRate: number | null;
  applicationCompletionRate: number | null;
  applicationRate: number | null;
  cpc: number | null;
  costPerApplicationStart: number | null;
  cpa: number | null;
};

export type JobPosting = {
  id: number;
  jobNumber: string;
  jobTitle: string;
  jobMemo: string | null;
  impressions: number;
  clicks: number;
  applicationStarts: number;
  applications: number;
  cost: number;
  ctr: number | null;
  applicationStartRate: number | null;
  applicationCompletionRate: number | null;
  applicationRate: number | null;
  cpc: number | null;
  costPerApplicationStart: number | null;
  cpa: number | null;
  employmentType: string | null;
};

export type AdDetail = {
  id: number;
  adNumber: string;
  adName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetLimit: number | null;
  contractJobMedia: string | null;
  contractStartDate: string;
  dailyMetrics: DailyMetric[];
  jobPostings: JobPosting[];
};

// ============================================
// 取得系
// ============================================

/** 企業の全広告を契約ごとにグループ化して取得 */
export async function getMediaAds(
  stpCompanyId: number
): Promise<ActionResult<ContractWithAds[]>> {
  try {
    const stpCompany = await prisma.stpCompany.findUnique({
      where: { id: stpCompanyId },
      select: { companyId: true },
    });
    if (!stpCompany) return err("企業が見つかりません");

    const contracts = await prisma.stpContractHistory.findMany({
      where: { companyId: stpCompany.companyId, deletedAt: null },
      include: {
        mediaAds: {
          include: {
            _count: { select: { dailyMetrics: true, jobPostings: true } },
            dailyMetrics: {
              select: { date: true },
              orderBy: { date: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { contractStartDate: "desc" },
    });

    const result: ContractWithAds[] = contracts.map((c) => ({
      id: c.id,
      jobMedia: c.jobMedia,
      contractStartDate: toLocalDateString(c.contractStartDate),
      contractEndDate: c.contractEndDate
        ? toLocalDateString(c.contractEndDate)
        : null,
      status: c.status,
      contractPlan: c.contractPlan,
      ads: c.mediaAds.map((ad) => ({
        id: ad.id,
        adNumber: ad.adNumber,
        adName: ad.adName,
        status: ad.status,
        startDate: ad.startDate ? toLocalDateString(ad.startDate) : null,
        endDate: ad.endDate ? toLocalDateString(ad.endDate) : null,
        budgetLimit: ad.budgetLimit,
        dailyMetricCount: ad._count.dailyMetrics,
        jobPostingCount: ad._count.jobPostings,
        lastDataDate:
          ad.dailyMetrics.length > 0
            ? toLocalDateString(ad.dailyMetrics[0].date)
            : null,
      })),
    }));

    return ok(result);
  } catch (e) {
    console.error("[getMediaAds] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 広告の詳細+日別/求人データ取得（日付フィルタ対応） */
export async function getMediaAdDetail(
  adId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<ActionResult<AdDetail>> {
  try {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const ad = await prisma.stpMediaAd.findUnique({
      where: { id: adId },
      include: {
        contractHistory: {
          select: { jobMedia: true, contractStartDate: true },
        },
        dailyMetrics: {
          where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {},
          orderBy: { date: "desc" },
        },
        jobPostings: {
          orderBy: { applications: "desc" },
        },
      },
    });

    if (!ad) return err("広告が見つかりません");

    const result: AdDetail = {
      id: ad.id,
      adNumber: ad.adNumber,
      adName: ad.adName,
      status: ad.status,
      startDate: ad.startDate ? toLocalDateString(ad.startDate) : null,
      endDate: ad.endDate ? toLocalDateString(ad.endDate) : null,
      budgetLimit: ad.budgetLimit,
      contractJobMedia: ad.contractHistory.jobMedia,
      contractStartDate: toLocalDateString(
        ad.contractHistory.contractStartDate
      ),
      dailyMetrics: ad.dailyMetrics.map((m) => ({
        id: m.id,
        date: toLocalDateString(m.date),
        impressions: m.impressions,
        clicks: m.clicks,
        applicationStarts: m.applicationStarts,
        applications: m.applications,
        cost: m.cost,
        ctr: m.ctr !== null ? Number(m.ctr) : null,
        applicationStartRate:
          m.applicationStartRate !== null
            ? Number(m.applicationStartRate)
            : null,
        applicationCompletionRate:
          m.applicationCompletionRate !== null
            ? Number(m.applicationCompletionRate)
            : null,
        applicationRate:
          m.applicationRate !== null ? Number(m.applicationRate) : null,
        cpc: m.cpc,
        costPerApplicationStart: m.costPerApplicationStart,
        cpa: m.cpa,
      })),
      jobPostings: ad.jobPostings.map((jp) => ({
        id: jp.id,
        jobNumber: jp.jobNumber,
        jobTitle: jp.jobTitle,
        jobMemo: jp.jobMemo,
        impressions: jp.impressions,
        clicks: jp.clicks,
        applicationStarts: jp.applicationStarts,
        applications: jp.applications,
        cost: jp.cost,
        ctr: jp.ctr !== null ? Number(jp.ctr) : null,
        applicationStartRate:
          jp.applicationStartRate !== null
            ? Number(jp.applicationStartRate)
            : null,
        applicationCompletionRate:
          jp.applicationCompletionRate !== null
            ? Number(jp.applicationCompletionRate)
            : null,
        applicationRate:
          jp.applicationRate !== null ? Number(jp.applicationRate) : null,
        cpc: jp.cpc,
        costPerApplicationStart: jp.costPerApplicationStart,
        cpa: jp.cpa,
        employmentType: jp.employmentType,
      })),
    };

    return ok(result);
  } catch (e) {
    console.error("[getMediaAdDetail] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 広告番号で検索（CSV取込時のマッチング用） */
export async function findAdByNumber(
  adNumber: string
): Promise<
  ActionResult<{
    id: number;
    adName: string;
    contractHistoryId: number;
  } | null>
> {
  try {
    const ad = await prisma.stpMediaAd.findUnique({
      where: { adNumber },
      select: { id: true, adName: true, contractHistoryId: true },
    });
    return ok(ad);
  } catch (e) {
    console.error("[findAdByNumber] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 企業の契約一覧取得（広告登録時の選択肢用） */
export async function getContractsForCompany(
  stpCompanyId: number
): Promise<
  ActionResult<
    Array<{
      id: number;
      jobMedia: string | null;
      contractStartDate: string;
      contractEndDate: string | null;
      status: string;
      contractPlan: string;
    }>
  >
> {
  try {
    const stpCompany = await prisma.stpCompany.findUnique({
      where: { id: stpCompanyId },
      select: { companyId: true },
    });
    if (!stpCompany) return err("企業が見つかりません");

    const contracts = await prisma.stpContractHistory.findMany({
      where: { companyId: stpCompany.companyId, deletedAt: null },
      select: {
        id: true,
        jobMedia: true,
        contractStartDate: true,
        contractEndDate: true,
        status: true,
        contractPlan: true,
      },
      orderBy: { contractStartDate: "desc" },
    });

    return ok(
      contracts.map((c) => ({
        id: c.id,
        jobMedia: c.jobMedia,
        contractStartDate: toLocalDateString(c.contractStartDate),
        contractEndDate: c.contractEndDate
          ? toLocalDateString(c.contractEndDate)
          : null,
        status: c.status,
        contractPlan: c.contractPlan,
      }))
    );
  } catch (e) {
    console.error("[getContractsForCompany] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// CRUD
// ============================================

/** 広告を作成 */
export async function createMediaAd(data: {
  contractHistoryId: number;
  adNumber: string;
  adName: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  budgetLimit?: number | null;
}): Promise<ActionResult<{ id: number }>> {
  try {
    await requireEdit("stp");

    if (!data.adNumber.trim()) return err("広告番号は必須です");
    if (!data.adName.trim()) return err("広告名は必須です");

    // 重複チェック
    const existing = await prisma.stpMediaAd.findUnique({
      where: { adNumber: data.adNumber.trim() },
    });
    if (existing)
      return err(`広告番号 ${data.adNumber} は既に登録されています`);

    const ad = await prisma.stpMediaAd.create({
      data: {
        contractHistoryId: data.contractHistoryId,
        adNumber: data.adNumber.trim(),
        adName: data.adName.trim(),
        status: data.status || "active",
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        budgetLimit: data.budgetLimit ?? null,
      },
    });

    revalidatePath("/stp/companies", "layout");
    return ok({ id: ad.id });
  } catch (e) {
    console.error("[createMediaAd] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 広告を更新 */
export async function updateMediaAd(
  adId: number,
  data: {
    adName?: string;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    budgetLimit?: number | null;
  }
): Promise<ActionResult> {
  try {
    await requireEdit("stp");

    const updateData: Record<string, unknown> = {};
    if (data.adName !== undefined) updateData.adName = data.adName.trim();
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startDate !== undefined)
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.budgetLimit !== undefined)
      updateData.budgetLimit = data.budgetLimit;

    await prisma.stpMediaAd.update({
      where: { id: adId },
      data: updateData,
    });

    revalidatePath("/stp/companies", "layout");
    return ok();
  } catch (e) {
    console.error("[updateMediaAd] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 広告を削除 */
export async function deleteMediaAd(adId: number): Promise<ActionResult> {
  try {
    await requireEdit("stp");

    await prisma.stpMediaAd.delete({ where: { id: adId } });

    revalidatePath("/stp/companies", "layout");
    return ok();
  } catch (e) {
    console.error("[deleteMediaAd] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// CSVインポート
// ============================================

export type CsvImportItem = {
  adId: number;
  adNameFromCsv?: string; // CSVから取得した広告名（既存と異なれば更新）
  dailyMetrics?: ParsedDailyRow[];
  jobPostings?: ParsedJobPostingRow[];
};

/** CSVデータ一括インポート（既存データを入れ替え） */
export async function importCsvData(
  imports: CsvImportItem[]
): Promise<ActionResult<{ importedCount: number }>> {
  try {
    await requireEdit("stp");

    let totalImported = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of imports) {
        // 広告名がCSVと異なれば更新
        if (item.adNameFromCsv) {
          const currentAd = await tx.stpMediaAd.findUnique({
            where: { id: item.adId },
            select: { adName: true },
          });
          if (currentAd && currentAd.adName !== item.adNameFromCsv) {
            await tx.stpMediaAd.update({
              where: { id: item.adId },
              data: { adName: item.adNameFromCsv },
            });
          }
        }

        // 日別データの入れ替え
        if (item.dailyMetrics && item.dailyMetrics.length > 0) {
          await tx.stpMediaAdDailyMetric.deleteMany({
            where: { adId: item.adId },
          });
          await tx.stpMediaAdDailyMetric.createMany({
            data: item.dailyMetrics.map((m) => ({
              adId: item.adId,
              date: new Date(m.date),
              impressions: m.impressions,
              clicks: m.clicks,
              applicationStarts: m.applicationStarts,
              applications: m.applications,
              cost: m.cost,
              ctr: m.ctr,
              applicationStartRate: m.applicationStartRate,
              applicationCompletionRate: m.applicationCompletionRate,
              applicationRate: m.applicationRate,
              cpc: m.cpc,
              costPerApplicationStart: m.costPerApplicationStart,
              cpa: m.cpa,
            })),
          });
          totalImported += item.dailyMetrics.length;
        }

        // 求人別データの入れ替え
        if (item.jobPostings && item.jobPostings.length > 0) {
          await tx.stpMediaAdJobPosting.deleteMany({
            where: { adId: item.adId },
          });
          await tx.stpMediaAdJobPosting.createMany({
            data: item.jobPostings.map((jp) => ({
              adId: item.adId,
              jobNumber: jp.jobNumber,
              jobTitle: jp.jobTitle,
              jobMemo: jp.jobMemo,
              impressions: jp.impressions,
              clicks: jp.clicks,
              applicationStarts: jp.applicationStarts,
              applications: jp.applications,
              cost: jp.cost,
              ctr: jp.ctr,
              applicationStartRate: jp.applicationStartRate,
              applicationCompletionRate: jp.applicationCompletionRate,
              applicationRate: jp.applicationRate,
              cpc: jp.cpc,
              costPerApplicationStart: jp.costPerApplicationStart,
              cpa: jp.cpa,
              employmentType: jp.employmentType,
            })),
          });
          totalImported += item.jobPostings.length;
        }
      }
    });

    revalidatePath("/stp/companies", "layout");
    return ok({ importedCount: totalImported });
  } catch (e) {
    console.error("[importCsvData] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
