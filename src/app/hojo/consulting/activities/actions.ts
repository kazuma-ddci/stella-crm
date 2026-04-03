"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

function toDateOrNull(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

export async function addActivity(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const vendorId = data.vendorId ? Number(data.vendorId) : null;
  if (!vendorId) throw new Error("ベンダーを選択してください");

  const activityDate = toDateOrNull(data.activityDate);
  if (!activityDate) throw new Error("活動日を入力してください");

  const contractId = data.contractId ? Number(data.contractId) : null;

  await prisma.hojoConsultingActivity.create({
    data: {
      vendor: { connect: { id: vendorId } },
      ...(contractId ? { contract: { connect: { id: contractId } } } : {}),
      activityDate,
      contactMethod: data.contactMethod ? String(data.contactMethod).trim() : null,
      vendorIssue: data.vendorIssue ? String(data.vendorIssue).trim() : null,
      hearingContent: data.hearingContent ? String(data.hearingContent).trim() : null,
      responseContent: data.responseContent ? String(data.responseContent).trim() : null,
      proposalContent: data.proposalContent ? String(data.proposalContent).trim() : null,
      vendorNextAction: data.vendorNextAction ? String(data.vendorNextAction).trim() : null,
      nextDeadline: toDateOrNull(data.nextDeadline),
      vendorTask: data.vendorTask ? String(data.vendorTask).trim() : null,
      vendorTaskDeadline: toDateOrNull(data.vendorTaskDeadline),
      vendorTaskPriority: data.vendorTaskPriority ? String(data.vendorTaskPriority).trim() : null,
      vendorTaskCompleted: data.vendorTaskCompleted === true || data.vendorTaskCompleted === "true",
      supportTask: data.supportTask ? String(data.supportTask).trim() : null,
      supportTaskDeadline: toDateOrNull(data.supportTaskDeadline),
      supportTaskPriority: data.supportTaskPriority ? String(data.supportTaskPriority).trim() : null,
      supportTaskCompleted: data.supportTaskCompleted === true || data.supportTaskCompleted === "true",
      attachmentUrl: data.attachmentUrl ? String(data.attachmentUrl).trim() : null,
      recordingUrl: data.recordingUrl ? String(data.recordingUrl).trim() : null,
      screenshotUrl: data.screenshotUrl ? String(data.screenshotUrl).trim() : null,
      notes: data.notes ? String(data.notes).trim() : null,
    },
  });

  revalidatePath("/hojo/consulting/activities");
}

export async function updateActivity(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};

  if ("vendorId" in data) {
    const vendorId = data.vendorId ? Number(data.vendorId) : null;
    if (vendorId) {
      updateData.vendor = { connect: { id: vendorId } };
    }
  }
  if ("contractId" in data) {
    const contractId = data.contractId ? Number(data.contractId) : null;
    if (contractId) {
      updateData.contract = { connect: { id: contractId } };
    } else {
      updateData.contract = { disconnect: true };
    }
  }
  if ("activityDate" in data) {
    const d = toDateOrNull(data.activityDate);
    if (d) updateData.activityDate = d;
  }
  if ("contactMethod" in data) updateData.contactMethod = data.contactMethod ? String(data.contactMethod).trim() : null;
  if ("vendorIssue" in data) updateData.vendorIssue = data.vendorIssue ? String(data.vendorIssue).trim() : null;
  if ("hearingContent" in data) updateData.hearingContent = data.hearingContent ? String(data.hearingContent).trim() : null;
  if ("responseContent" in data) updateData.responseContent = data.responseContent ? String(data.responseContent).trim() : null;
  if ("proposalContent" in data) updateData.proposalContent = data.proposalContent ? String(data.proposalContent).trim() : null;
  if ("vendorNextAction" in data) updateData.vendorNextAction = data.vendorNextAction ? String(data.vendorNextAction).trim() : null;
  if ("nextDeadline" in data) updateData.nextDeadline = toDateOrNull(data.nextDeadline);
  if ("vendorTask" in data) updateData.vendorTask = data.vendorTask ? String(data.vendorTask).trim() : null;
  if ("vendorTaskDeadline" in data) updateData.vendorTaskDeadline = toDateOrNull(data.vendorTaskDeadline);
  if ("vendorTaskPriority" in data) updateData.vendorTaskPriority = data.vendorTaskPriority ? String(data.vendorTaskPriority).trim() : null;
  if ("vendorTaskCompleted" in data) updateData.vendorTaskCompleted = data.vendorTaskCompleted === true || data.vendorTaskCompleted === "true";
  if ("supportTask" in data) updateData.supportTask = data.supportTask ? String(data.supportTask).trim() : null;
  if ("supportTaskDeadline" in data) updateData.supportTaskDeadline = toDateOrNull(data.supportTaskDeadline);
  if ("supportTaskPriority" in data) updateData.supportTaskPriority = data.supportTaskPriority ? String(data.supportTaskPriority).trim() : null;
  if ("supportTaskCompleted" in data) updateData.supportTaskCompleted = data.supportTaskCompleted === true || data.supportTaskCompleted === "true";
  if ("attachmentUrl" in data) updateData.attachmentUrl = data.attachmentUrl ? String(data.attachmentUrl).trim() : null;
  if ("recordingUrl" in data) updateData.recordingUrl = data.recordingUrl ? String(data.recordingUrl).trim() : null;
  if ("screenshotUrl" in data) updateData.screenshotUrl = data.screenshotUrl ? String(data.screenshotUrl).trim() : null;
  if ("notes" in data) updateData.notes = data.notes ? String(data.notes).trim() : null;

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoConsultingActivity.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/hojo/consulting/activities");
}

export async function deleteActivity(id: number) {
  await requireProjectMasterDataEditPermission();

  await prisma.hojoConsultingActivity.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/hojo/consulting/activities");
}
