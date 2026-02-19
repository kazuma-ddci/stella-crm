"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { isInvalidJobMedia } from "@/lib/stp/job-media";

export async function addCandidate(data: Record<string, unknown>) {
  await requireEdit("stp");

  if (!data.stpCompanyId) {
    throw new Error("企業は必須です");
  }

  await prisma.stpCandidate.create({
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

  revalidatePath("/stp/candidates");
}

export async function updateCandidate(
  id: number,
  data: Record<string, unknown>
) {
  await requireEdit("stp");
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

  if (Object.keys(updateData).length > 0) {
    await prisma.stpCandidate.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/stp/candidates");
}

export async function deleteCandidate(id: number) {
  await requireEdit("stp");
  await prisma.stpCandidate.update({
    where: { id },
    data: { deletedAt: new Date() },
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
