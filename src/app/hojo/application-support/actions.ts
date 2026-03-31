"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/hojo/application-support";

export async function updateApplicationSupport(id: number, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};

  if (data.vendorId !== undefined) {
    updateData.vendorId = data.vendorId ? Number(data.vendorId) : null;
  }
  if (data.statusId !== undefined) {
    updateData.statusId = data.statusId ? Number(data.statusId) : null;
  }
  if (data.applicantName !== undefined) {
    updateData.applicantName = data.applicantName ? String(data.applicantName).trim() : null;
  }
  if (data.detailMemo !== undefined) {
    updateData.detailMemo = data.detailMemo ? String(data.detailMemo).trim() : null;
  }
  if (data.alkesMemo !== undefined) {
    updateData.alkesMemo = data.alkesMemo ? String(data.alkesMemo).trim() : null;
  }

  // vendorMemo, subsidyDesiredDate, subsidyAmount はベンダー専用ページのみ変更可

  const dateFields = [
    "formAnswerDate", "formTranscriptDate", "applicationFormDate",
    "paymentReceivedDate", "bbsTransferDate", "subsidyReceivedDate",
  ];
  for (const field of dateFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field] ? new Date(String(data[field])) : null;
    }
  }

  const numberFields = ["paymentReceivedAmount", "bbsTransferAmount"];
  for (const field of numberFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field] ? Number(data[field]) : null;
    }
  }

  if (data.documentStorageUrl !== undefined) {
    updateData.documentStorageUrl = data.documentStorageUrl ? String(data.documentStorageUrl).trim() : null;
  }

  // bbsStatus, bbsMemo はこのページからは変更不可（BBS専用ページのみ）

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoApplicationSupport.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath(REVALIDATE_PATH);
}
