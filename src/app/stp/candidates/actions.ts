"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { isInvalidJobMedia } from "@/lib/stp/job-media";
import { logActivity } from "@/lib/activity-log/log";
import { calcChanges } from "@/lib/activity-log/utils";

export async function addCandidate(data: Record<string, unknown>) {
  const user = await requireEdit("stp");

  if (!data.stpCompanyId) {
    throw new Error("企業は必須です");
  }

  const result = await prisma.stpCandidate.create({
    data: {
      lastName: (data.lastName as string) || "",
      firstName: (data.firstName as string) || "",
      interviewDate: data.interviewDate
        ? new Date(data.interviewDate as string)
        : null,
      interviewAttendance: (data.interviewAttendance as string) || null,
      selectionStatus: (data.selectionStatus as string) || null,
      offerDate: data.offerDate
        ? new Date(data.offerDate as string)
        : null,
      joinDate: data.joinDate
        ? new Date(data.joinDate as string)
        : null,
      sendDate: data.sendDate
        ? new Date(data.sendDate as string)
        : null,
      industryType: (data.industryType as string) || null,
      jobMedia: (data.jobMedia as string) || null,
      note: (data.note as string) || null,
      stpCompanyId: Number(data.stpCompanyId),
    },
  });

  await logActivity({
    model: "StpCandidate",
    recordId: result.id,
    action: "create",
    summary: `求職者「${data.lastName as string} ${data.firstName as string}」を作成`,
    changes: {
      姓: { old: null, new: data.lastName ?? "" },
      名: { old: null, new: data.firstName ?? "" },
      選考ステータス: { old: null, new: data.selectionStatus ?? null },
      業種: { old: null, new: data.industryType ?? null },
      求人媒体: { old: null, new: data.jobMedia ?? null },
    },
    userId: user.id,
  });
  revalidatePath("/stp/candidates");
}

// updateCandidate用のフィールドラベルマッピング
const UPDATE_CANDIDATE_FIELD_LABELS: Record<string, string> = {
  lastName: "姓",
  firstName: "名",
  interviewDate: "面接日",
  interviewAttendance: "面接出席",
  selectionStatus: "選考ステータス",
  offerDate: "内定日",
  joinDate: "入社日",
  sendDate: "送客日",
  industryType: "業種",
  jobMedia: "求人媒体",
  note: "メモ",
  stpCompanyId: "企業",
};

export async function updateCandidate(
  id: number,
  data: Record<string, unknown>
) {
  const user = await requireEdit("stp");
  const updateData: Record<string, unknown> = {};

  if ("lastName" in data) {
    updateData.lastName = (data.lastName as string) || "";
  }
  if ("firstName" in data) {
    updateData.firstName = (data.firstName as string) || "";
  }
  if ("interviewDate" in data) {
    updateData.interviewDate = data.interviewDate
      ? new Date(data.interviewDate as string)
      : null;
  }
  if ("interviewAttendance" in data) {
    updateData.interviewAttendance =
      (data.interviewAttendance as string) || null;
  }
  if ("selectionStatus" in data) {
    updateData.selectionStatus = (data.selectionStatus as string) || null;
  }
  if ("offerDate" in data) {
    updateData.offerDate = data.offerDate
      ? new Date(data.offerDate as string)
      : null;
  }
  if ("joinDate" in data) {
    updateData.joinDate = data.joinDate
      ? new Date(data.joinDate as string)
      : null;
  }
  if ("sendDate" in data) {
    updateData.sendDate = data.sendDate
      ? new Date(data.sendDate as string)
      : null;
  }
  if ("industryType" in data) {
    updateData.industryType = (data.industryType as string) || null;
  }
  if ("jobMedia" in data) {
    const jobMediaValue = (data.jobMedia as string) || null;
    if (isInvalidJobMedia(jobMediaValue)) {
      throw new Error("無効な求人媒体が指定されています");
    }
    updateData.jobMedia = jobMediaValue;
  }
  if ("note" in data) {
    updateData.note = (data.note as string) || null;
  }
  if ("stpCompanyId" in data) {
    updateData.stpCompanyId = data.stpCompanyId
      ? Number(data.stpCompanyId)
      : undefined;
  }

  // calcChanges用: 更新前のデータを取得
  const updateKeys = Object.keys(updateData);
  const selectForBefore: Record<string, boolean> = { lastName: true, firstName: true };
  for (const k of updateKeys) selectForBefore[k] = true;
  const beforeRecord = await prisma.stpCandidate.findUnique({ where: { id }, select: selectForBefore });
  const beforeUpdateData: Record<string, unknown> = beforeRecord ?? {};

  if (updateKeys.length > 0) {
    await prisma.stpCandidate.update({
      where: { id },
      data: updateData,
    });
  }

  const candidateName = `${beforeRecord?.lastName ?? ""}${beforeRecord?.firstName ?? ""}`.trim() || String(id);
  const changes = calcChanges(beforeUpdateData, updateData, UPDATE_CANDIDATE_FIELD_LABELS);
  await logActivity({
    model: "StpCandidate",
    recordId: id,
    action: "update",
    summary: `求職者「${candidateName}」を更新`,
    changes,
    userId: user.id,
  });
  revalidatePath("/stp/candidates");
}

export async function deleteCandidate(id: number) {
  const user = await requireEdit("stp");
  const candidateForLog = await prisma.stpCandidate.findUnique({ where: { id }, select: { lastName: true, firstName: true } });
  const candidateName = `${candidateForLog?.lastName ?? ""}${candidateForLog?.firstName ?? ""}`.trim() || String(id);
  await prisma.stpCandidate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await logActivity({
    model: "StpCandidate",
    recordId: id,
    action: "delete",
    summary: `求職者「${candidateName}」を削除`,
    userId: user.id,
  });
  revalidatePath("/stp/candidates");
}

export async function restoreCandidate(id: number) {
  await requireEdit("stp");
  await prisma.stpCandidate.update({
    where: { id },
    data: { deletedAt: null },
  });
  revalidatePath("/stp/candidates");
}
