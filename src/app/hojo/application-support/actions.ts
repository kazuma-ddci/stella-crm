"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/hojo/application-support";

export async function updateApplicationSupport(id: number, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};

  if (data.vendorId !== undefined) {
    const newVendorId = data.vendorId ? Number(data.vendorId) : null;
    updateData.vendorId = newVendorId;
    // ベンダーを手動で変更した場合はフラグを立てる
    updateData.vendorIdManual = true;
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

/** 同一LINEアカウントの新規レコードを追加（複製） */
export async function addApplicationSupportRecord(lineFriendId: number) {
  await prisma.hojoApplicationSupport.create({
    data: { lineFriendId },
  });
  revalidatePath(REVALIDATE_PATH);
}

/** 申請者管理レコードの論理削除 */
export async function deleteApplicationSupportRecord(id: number) {
  // 同一lineFriendIdのレコードが他にあるか確認
  const record = await prisma.hojoApplicationSupport.findUnique({
    where: { id },
    select: { lineFriendId: true },
  });
  if (!record) return;

  const siblingCount = await prisma.hojoApplicationSupport.count({
    where: { lineFriendId: record.lineFriendId, deletedAt: null, id: { not: id } },
  });

  if (siblingCount === 0) {
    throw new Error("最後の1レコードは削除できません。最低1レコードは必要です。");
  }

  await prisma.hojoApplicationSupport.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath(REVALIDATE_PATH);
}

/** 紹介元ベンダーの不一致を解決する */
export async function resolveVendorMismatch(
  id: number,
  action: "accept" | "keep"
) {
  if (action === "accept") {
    // free1から解決されたベンダーを受け入れる → vendorIdManualをfalseに戻してsyncに任せる
    // resolvedVendorIdはクライアントから受け取る
    // ここでは単にvendorIdManualをfalseにリセットし、syncが次回拾う
    await prisma.hojoApplicationSupport.update({
      where: { id },
      data: { vendorIdManual: false, vendorId: null },
    });
  } else {
    // 現在のベンダーを維持 → vendorIdManualをtrueにして今後の自動変更を防ぐ
    await prisma.hojoApplicationSupport.update({
      where: { id },
      data: { vendorIdManual: true },
    });
  }
  revalidatePath(REVALIDATE_PATH);
}

/** 紹介元ベンダーの不一致を解決する（新しいベンダーを指定して受け入れ） */
export async function acceptResolvedVendor(id: number, newVendorId: number | null) {
  await prisma.hojoApplicationSupport.update({
    where: { id },
    data: { vendorId: newVendorId, vendorIdManual: false },
  });
  revalidatePath(REVALIDATE_PATH);
}
