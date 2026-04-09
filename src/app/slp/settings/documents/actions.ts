"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

// 資料を有効化（切り替え）
export async function activateDocument(documentId: number) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.$transaction([
    prisma.slpDocument.updateMany({
      where: { isActive: true, deletedAt: null },
      data: { isActive: false },
    }),
    prisma.slpDocument.update({
      where: { id: documentId },
      data: { isActive: true },
    }),
  ]);

  revalidatePath("/slp/settings/documents");
}

// 資料を削除（論理削除）
export async function deleteDocument(documentId: number) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.slpDocument.update({
    where: { id: documentId },
    data: { deletedAt: new Date(), isActive: false },
  });

  revalidatePath("/slp/settings/documents");
}

// 動画を有効化（切り替え）
export async function activateVideo(videoId: number) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.$transaction([
    prisma.slpVideo.updateMany({
      where: { isActive: true, deletedAt: null },
      data: { isActive: false },
    }),
    prisma.slpVideo.update({
      where: { id: videoId },
      data: { isActive: true },
    }),
  ]);

  revalidatePath("/slp/settings/documents");
}

// 動画を削除（論理削除）
export async function deleteVideo(videoId: number) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.slpVideo.update({
    where: { id: videoId },
    data: { deletedAt: new Date(), isActive: false },
  });

  revalidatePath("/slp/settings/documents");
}
