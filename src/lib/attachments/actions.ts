"use server";

import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { recordChangeLog } from "@/app/accounting/changelog/actions";
import {
  generateAttachmentFileName,
  getFileExtension,
} from "@/lib/attachments/constants";
import { revalidatePath } from "next/cache";

/**
 * 証憑の表示名（displayName）を変更し、generatedName を再生成する。
 * 変更履歴は ChangeLog に記録される。
 */
export async function updateAttachmentDisplayName(
  attachmentId: number,
  newDisplayName: string
) {
  const session = await requireEdit("stp");

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId, deletedAt: null },
    select: {
      id: true,
      attachmentType: true,
      displayName: true,
      generatedName: true,
      fileName: true,
      filePath: true,
      invoiceGroupId: true,
      paymentGroupId: true,
      createdAt: true,
    },
  });
  if (!attachment) throw new Error("証憑が見つかりません");

  // 拡張子をfilePathから取得
  const ext = getFileExtension(attachment.filePath);
  // 生成ファイル名を再生成（タイムスタンプは元のcreatedAtを使用）
  const newGeneratedName = generateAttachmentFileName(
    attachment.attachmentType,
    newDisplayName,
    ext,
    attachment.createdAt
  );

  await prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      displayName: newDisplayName,
      generatedName: newGeneratedName,
      fileName: newGeneratedName, // ダウンロード時のファイル名としても更新
    },
  });

  // ChangeLogに変更を記録
  await recordChangeLog(
    {
      tableName: "Attachment",
      recordId: attachmentId,
      changeType: "update",
      oldData: {
        displayName: attachment.displayName,
        generatedName: attachment.generatedName,
      },
      newData: {
        displayName: newDisplayName,
        generatedName: newGeneratedName,
      },
    },
    session.id
  );

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");
}

/**
 * 証憑の変更履歴を取得する
 */
export async function getAttachmentHistory(attachmentId: number) {
  await requireEdit("stp");

  const logs = await prisma.changeLog.findMany({
    where: {
      tableName: "Attachment",
      recordId: attachmentId,
      changeType: "update",
    },
    include: {
      changer: {
        select: { name: true },
      },
    },
    orderBy: { changedAt: "desc" },
  });

  return logs.map((log) => {
    const oldData = log.oldData as Record<string, unknown> | null;
    const newData = log.newData as Record<string, unknown> | null;
    return {
      id: log.id,
      changedAt: log.changedAt.toISOString(),
      changedByName: log.changer.name,
      oldDisplayName: (oldData?.displayName as string) ?? null,
      newDisplayName: (newData?.displayName as string) ?? null,
      oldGeneratedName: (oldData?.generatedName as string) ?? null,
      newGeneratedName: (newData?.generatedName as string) ?? null,
    };
  });
}
