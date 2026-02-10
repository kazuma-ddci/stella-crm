"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";

export async function addCandidate(data: Record<string, unknown>) {
  await requireEdit("stp");
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
      industryType: (data.industryType as string) || null,
      jobMedia: (data.jobMedia as string) || null,
      note: (data.note as string) || null,
      stpCompanyId: data.stpCompanyId ? Number(data.stpCompanyId) : null,
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
  if ("industryType" in data) {
    updateData.industryType = (data.industryType as string) || null;
  }
  if ("jobMedia" in data) {
    updateData.jobMedia = (data.jobMedia as string) || null;
  }
  if ("note" in data) {
    updateData.note = (data.note as string) || null;
  }
  if ("stpCompanyId" in data) {
    updateData.stpCompanyId = data.stpCompanyId
      ? Number(data.stpCompanyId)
      : null;
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
  await prisma.stpCandidate.delete({
    where: { id },
  });
  revalidatePath("/stp/candidates");
}
