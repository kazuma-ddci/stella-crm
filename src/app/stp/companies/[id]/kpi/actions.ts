"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { randomBytes } from "crypto";
import { toLocalDateString } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

// KPIシート一覧を取得
export async function getKpiSheets(stpCompanyId: number) {
  const sheets = await prisma.stpKpiSheet.findMany({
    where: { stpCompanyId },
    include: {
      weeklyData: {
        orderBy: { weekStartDate: "asc" },
      },
      shareLinks: {
        where: {
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return sheets.map((sheet) => ({
    id: sheet.id,
    stpCompanyId: sheet.stpCompanyId,
    name: sheet.name,
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString(),
    weeklyData: sheet.weeklyData.map((w) => ({
      id: w.id,
      weekStartDate: toLocalDateString(w.weekStartDate),
      weekEndDate: toLocalDateString(w.weekEndDate),
      targetImpressions: w.targetImpressions,
      targetCpm: w.targetCpm ? Number(w.targetCpm) : null,
      targetClicks: w.targetClicks,
      targetCtr: w.targetCtr ? Number(w.targetCtr) : null,
      targetCpc: w.targetCpc ? Number(w.targetCpc) : null,
      targetApplications: w.targetApplications,
      targetCvr: w.targetCvr ? Number(w.targetCvr) : null,
      targetCpa: w.targetCpa ? Number(w.targetCpa) : null,
      targetCost: w.targetCost,
      actualImpressions: w.actualImpressions,
      actualCpm: w.actualCpm ? Number(w.actualCpm) : null,
      actualClicks: w.actualClicks,
      actualCtr: w.actualCtr ? Number(w.actualCtr) : null,
      actualCpc: w.actualCpc ? Number(w.actualCpc) : null,
      actualApplications: w.actualApplications,
      actualCvr: w.actualCvr ? Number(w.actualCvr) : null,
      actualCpa: w.actualCpa ? Number(w.actualCpa) : null,
      actualCost: w.actualCost,
    })),
    shareLinks: sheet.shareLinks.map((link) => ({
      id: link.id,
      token: link.token,
      expiresAt: link.expiresAt.toISOString(),
      createdAt: link.createdAt.toISOString(),
    })),
  }));
}

// KPIシートを作成
export async function createKpiSheet(stpCompanyId: number, name: string): Promise<ActionResult<{ id: number }>> {
  try {
    await requireEdit("stp");
    const sheet = await prisma.stpKpiSheet.create({
      data: {
        stpCompanyId,
        name,
      },
    });

    revalidatePath(`/stp/companies/${stpCompanyId}/kpi`);

    return ok({ id: sheet.id });
  } catch (e) {
    console.error("[createKpiSheet] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// KPIシートを削除
export async function deleteKpiSheet(sheetId: number): Promise<ActionResult> {
  try {
    await requireEdit("stp");
    const sheet = await prisma.stpKpiSheet.findUnique({
      where: { id: sheetId },
      select: { stpCompanyId: true },
    });

    if (!sheet) {
      return err("KPIシートが見つかりません");
    }

    await prisma.stpKpiSheet.delete({
      where: { id: sheetId },
    });

    revalidatePath(`/stp/companies/${sheet.stpCompanyId}/kpi`);
    return ok();
  } catch (e) {
    console.error("[deleteKpiSheet] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// KPIシート名を更新
export async function updateKpiSheetName(sheetId: number, name: string): Promise<ActionResult> {
  try {
    await requireEdit("stp");
    const sheet = await prisma.stpKpiSheet.update({
      where: { id: sheetId },
      data: { name },
      select: { stpCompanyId: true },
    });

    revalidatePath(`/stp/companies/${sheet.stpCompanyId}/kpi`);
    return ok();
  } catch (e) {
    console.error("[updateKpiSheetName] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 週データを追加
export async function addWeeklyData(
  sheetId: number,
  startDate: string,
  endDate: string
): Promise<ActionResult> {
  try {
    await requireEdit("stp");
    const sheet = await prisma.stpKpiSheet.findUnique({
      where: { id: sheetId },
      select: { stpCompanyId: true },
    });

    if (!sheet) {
      return err("KPIシートが見つかりません");
    }

    await prisma.stpKpiWeeklyData.create({
      data: {
        kpiSheetId: sheetId,
        weekStartDate: new Date(startDate),
        weekEndDate: new Date(endDate),
      },
    });

    revalidatePath(`/stp/companies/${sheet.stpCompanyId}/kpi`);
    return ok();
  } catch (e) {
    console.error("[addWeeklyData] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 週データの開始日を更新
export async function updateWeekStartDate(
  weeklyDataId: number,
  startDate: string
): Promise<ActionResult> {
  try {
    await requireEdit("stp");
    const weeklyData = await prisma.stpKpiWeeklyData.findUnique({
      where: { id: weeklyDataId },
      include: {
        kpiSheet: {
          select: { stpCompanyId: true },
        },
      },
    });

    if (!weeklyData) {
      return err("週データが見つかりません");
    }

    // 新しい開始日から終了日を計算（7日間）
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + 6);

    await prisma.stpKpiWeeklyData.update({
      where: { id: weeklyDataId },
      data: {
        weekStartDate: newStartDate,
        weekEndDate: newEndDate,
      },
    });

    revalidatePath(`/stp/companies/${weeklyData.kpiSheet.stpCompanyId}/kpi`);
    return ok();
  } catch (e) {
    console.error("[updateWeekStartDate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 週データを削除
export async function deleteWeeklyData(weeklyDataId: number): Promise<ActionResult> {
  try {
    await requireEdit("stp");
    const weeklyData = await prisma.stpKpiWeeklyData.findUnique({
      where: { id: weeklyDataId },
      include: {
        kpiSheet: {
          select: { stpCompanyId: true },
        },
      },
    });

    if (!weeklyData) {
      return err("週データが見つかりません");
    }

    await prisma.stpKpiWeeklyData.delete({
      where: { id: weeklyDataId },
    });

    revalidatePath(`/stp/companies/${weeklyData.kpiSheet.stpCompanyId}/kpi`);
    return ok();
  } catch (e) {
    console.error("[deleteWeeklyData] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// セルの値を更新
export async function updateKpiCell(
  weeklyDataId: number,
  field: string,
  value: number | null
): Promise<ActionResult> {
  try {
    await requireEdit("stp");
    // フィールド名のバリデーション
    const allowedFields = [
      "targetImpressions",
      "targetCpm",
      "targetClicks",
      "targetCtr",
      "targetCpc",
      "targetApplications",
      "targetCvr",
      "targetCpa",
      "targetCost",
      "actualImpressions",
      "actualCpm",
      "actualClicks",
      "actualCtr",
      "actualCpc",
      "actualApplications",
      "actualCvr",
      "actualCpa",
      "actualCost",
    ];

    if (!allowedFields.includes(field)) {
      return err(`Invalid field: ${field}`);
    }

    const weeklyData = await prisma.stpKpiWeeklyData.findUnique({
      where: { id: weeklyDataId },
      include: {
        kpiSheet: {
          select: { stpCompanyId: true },
        },
      },
    });

    if (!weeklyData) {
      return err("週データが見つかりません");
    }

    await prisma.stpKpiWeeklyData.update({
      where: { id: weeklyDataId },
      data: {
        [field]: value,
      },
    });

    revalidatePath(`/stp/companies/${weeklyData.kpiSheet.stpCompanyId}/kpi`);
    return ok();
  } catch (e) {
    console.error("[updateKpiCell] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 共有リンクを生成
export async function createShareLink(
  sheetId: number,
  expiresInHours: number = 1
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  try {
    await requireEdit("stp");
    const sheet = await prisma.stpKpiSheet.findUnique({
      where: { id: sheetId },
      select: { stpCompanyId: true },
    });

    if (!sheet) {
      return err("KPIシートが見つかりません");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const shareLink = await prisma.stpKpiShareLink.create({
      data: {
        kpiSheetId: sheetId,
        token,
        expiresAt,
      },
    });

    revalidatePath(`/stp/companies/${sheet.stpCompanyId}/kpi`);

    return ok({
      token: shareLink.token,
      expiresAt: shareLink.expiresAt.toISOString(),
    });
  } catch (e) {
    console.error("[createShareLink] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 共有リンクを削除
export async function deleteShareLink(linkId: number): Promise<ActionResult> {
  try {
    await requireEdit("stp");
    const link = await prisma.stpKpiShareLink.findUnique({
      where: { id: linkId },
      include: {
        kpiSheet: {
          select: { stpCompanyId: true },
        },
      },
    });

    if (!link) {
      return err("共有リンクが見つかりません");
    }

    await prisma.stpKpiShareLink.delete({
      where: { id: linkId },
    });

    revalidatePath(`/stp/companies/${link.kpiSheet.stpCompanyId}/kpi`);
    return ok();
  } catch (e) {
    console.error("[deleteShareLink] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 共有リンクでKPIシートを取得（公開用）
export async function getKpiSheetByToken(token: string) {
  const shareLink = await prisma.stpKpiShareLink.findUnique({
    where: { token },
    include: {
      kpiSheet: {
        include: {
          weeklyData: {
            orderBy: { weekStartDate: "asc" },
          },
          stpCompany: {
            include: {
              company: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!shareLink) {
    return { error: "共有リンクが見つかりません" };
  }

  if (shareLink.expiresAt < new Date()) {
    return { error: "共有リンクの有効期限が切れています" };
  }

  const sheet = shareLink.kpiSheet;

  return {
    sheet: {
      id: sheet.id,
      name: sheet.name,
      companyName: sheet.stpCompany.company.name,
      weeklyData: sheet.weeklyData.map((w) => ({
        id: w.id,
        weekStartDate: toLocalDateString(w.weekStartDate),
        weekEndDate: toLocalDateString(w.weekEndDate),
        targetImpressions: w.targetImpressions,
        targetCpm: w.targetCpm ? Number(w.targetCpm) : null,
        targetClicks: w.targetClicks,
        targetCtr: w.targetCtr ? Number(w.targetCtr) : null,
        targetCpc: w.targetCpc ? Number(w.targetCpc) : null,
        targetApplications: w.targetApplications,
        targetCvr: w.targetCvr ? Number(w.targetCvr) : null,
        targetCpa: w.targetCpa ? Number(w.targetCpa) : null,
        targetCost: w.targetCost,
        actualImpressions: w.actualImpressions,
        actualCpm: w.actualCpm ? Number(w.actualCpm) : null,
        actualClicks: w.actualClicks,
        actualCtr: w.actualCtr ? Number(w.actualCtr) : null,
        actualCpc: w.actualCpc ? Number(w.actualCpc) : null,
        actualApplications: w.actualApplications,
        actualCvr: w.actualCvr ? Number(w.actualCvr) : null,
        actualCpa: w.actualCpa ? Number(w.actualCpa) : null,
        actualCost: w.actualCost,
      })),
    },
    expiresAt: shareLink.expiresAt.toISOString(),
  };
}
