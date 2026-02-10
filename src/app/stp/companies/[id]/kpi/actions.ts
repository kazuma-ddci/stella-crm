"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { randomBytes } from "crypto";

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
      weekStartDate: w.weekStartDate.toISOString().split("T")[0],
      weekEndDate: w.weekEndDate.toISOString().split("T")[0],
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
export async function createKpiSheet(stpCompanyId: number, name: string) {
  await requireEdit("stp");
  const sheet = await prisma.stpKpiSheet.create({
    data: {
      stpCompanyId,
      name,
    },
  });

  revalidatePath(`/stp/companies/${stpCompanyId}/kpi`);

  return { id: sheet.id };
}

// KPIシートを削除
export async function deleteKpiSheet(sheetId: number) {
  await requireEdit("stp");
  const sheet = await prisma.stpKpiSheet.findUnique({
    where: { id: sheetId },
    select: { stpCompanyId: true },
  });

  if (!sheet) {
    throw new Error("KPIシートが見つかりません");
  }

  await prisma.stpKpiSheet.delete({
    where: { id: sheetId },
  });

  revalidatePath(`/stp/companies/${sheet.stpCompanyId}/kpi`);
}

// KPIシート名を更新
export async function updateKpiSheetName(sheetId: number, name: string) {
  await requireEdit("stp");
  const sheet = await prisma.stpKpiSheet.update({
    where: { id: sheetId },
    data: { name },
    select: { stpCompanyId: true },
  });

  revalidatePath(`/stp/companies/${sheet.stpCompanyId}/kpi`);
}

// 週データを追加
export async function addWeeklyData(
  sheetId: number,
  startDate: string,
  endDate: string
) {
  await requireEdit("stp");
  const sheet = await prisma.stpKpiSheet.findUnique({
    where: { id: sheetId },
    select: { stpCompanyId: true },
  });

  if (!sheet) {
    throw new Error("KPIシートが見つかりません");
  }

  await prisma.stpKpiWeeklyData.create({
    data: {
      kpiSheetId: sheetId,
      weekStartDate: new Date(startDate),
      weekEndDate: new Date(endDate),
    },
  });

  revalidatePath(`/stp/companies/${sheet.stpCompanyId}/kpi`);
}

// 週データの開始日を更新
export async function updateWeekStartDate(
  weeklyDataId: number,
  startDate: string
) {
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
    throw new Error("週データが見つかりません");
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
}

// 週データを削除
export async function deleteWeeklyData(weeklyDataId: number) {
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
    throw new Error("週データが見つかりません");
  }

  await prisma.stpKpiWeeklyData.delete({
    where: { id: weeklyDataId },
  });

  revalidatePath(`/stp/companies/${weeklyData.kpiSheet.stpCompanyId}/kpi`);
}

// セルの値を更新
export async function updateKpiCell(
  weeklyDataId: number,
  field: string,
  value: number | null
) {
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
    throw new Error(`Invalid field: ${field}`);
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
    throw new Error("週データが見つかりません");
  }

  await prisma.stpKpiWeeklyData.update({
    where: { id: weeklyDataId },
    data: {
      [field]: value,
    },
  });

  revalidatePath(`/stp/companies/${weeklyData.kpiSheet.stpCompanyId}/kpi`);
}

// 共有リンクを生成
export async function createShareLink(
  sheetId: number,
  expiresInHours: number = 1
) {
  await requireEdit("stp");
  const sheet = await prisma.stpKpiSheet.findUnique({
    where: { id: sheetId },
    select: { stpCompanyId: true },
  });

  if (!sheet) {
    throw new Error("KPIシートが見つかりません");
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

  return {
    token: shareLink.token,
    expiresAt: shareLink.expiresAt.toISOString(),
  };
}

// 共有リンクを削除
export async function deleteShareLink(linkId: number) {
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
    throw new Error("共有リンクが見つかりません");
  }

  await prisma.stpKpiShareLink.delete({
    where: { id: linkId },
  });

  revalidatePath(`/stp/companies/${link.kpiSheet.stpCompanyId}/kpi`);
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
        weekStartDate: w.weekStartDate.toISOString().split("T")[0],
        weekEndDate: w.weekEndDate.toISOString().split("T")[0],
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
