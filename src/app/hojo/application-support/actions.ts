"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/hojo/application-support";

export async function addApplicationSupport(data: Record<string, unknown>) {
  const lineFriendId = Number(data.lineFriendId);
  if (!lineFriendId) throw new Error("LINE番号は必須です");

  await prisma.hojoApplicationSupport.create({
    data: {
      lineFriendId,
      vendorId: data.vendorId ? Number(data.vendorId) : null,
      statusId: data.statusId ? Number(data.statusId) : null,
      applicantName: data.applicantName ? String(data.applicantName).trim() : null,
      detailMemo: data.detailMemo ? String(data.detailMemo).trim() : null,
      formAnswerDate: data.formAnswerDate ? new Date(String(data.formAnswerDate)) : null,
      formTranscriptDate: data.formTranscriptDate ? new Date(String(data.formTranscriptDate)) : null,
      applicationFormDate: data.applicationFormDate ? new Date(String(data.applicationFormDate)) : null,
      documentStorageUrl: data.documentStorageUrl ? String(data.documentStorageUrl).trim() : null,
      paymentReceivedDate: data.paymentReceivedDate ? new Date(String(data.paymentReceivedDate)) : null,
      paymentReceivedAmount: data.paymentReceivedAmount ? Number(data.paymentReceivedAmount) : null,
      bbsTransferAmount: data.bbsTransferAmount ? Number(data.bbsTransferAmount) : null,
      bbsTransferDate: data.bbsTransferDate ? new Date(String(data.bbsTransferDate)) : null,
      subsidyReceivedDate: data.subsidyReceivedDate ? new Date(String(data.subsidyReceivedDate)) : null,
    },
  });

  revalidatePath(REVALIDATE_PATH);
}

export async function updateApplicationSupport(id: number, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};

  if (data.lineFriendId !== undefined) {
    updateData.lineFriendId = Number(data.lineFriendId);
  }
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

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoApplicationSupport.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath(REVALIDATE_PATH);
}

export async function deleteApplicationSupport(id: number) {
  await prisma.hojoApplicationSupport.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath(REVALIDATE_PATH);
}
