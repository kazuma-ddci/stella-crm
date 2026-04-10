"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { ok, err, type ActionResult } from "@/lib/action-result";

// 資料を有効化（切り替え）
export async function activateDocument(documentId: number): Promise<ActionResult> {
  try {
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
    return ok();
  } catch (e) {
    console.error("[activateDocument] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 資料を削除（論理削除）
export async function deleteDocument(documentId: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    await prisma.slpDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath("/slp/settings/documents");
    return ok();
  } catch (e) {
    console.error("[deleteDocument] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 動画を有効化（切り替え）
export async function activateVideo(videoId: number): Promise<ActionResult> {
  try {
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
    return ok();
  } catch (e) {
    console.error("[activateVideo] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 動画を削除（論理削除）
export async function deleteVideo(videoId: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    await prisma.slpVideo.update({
      where: { id: videoId },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath("/slp/settings/documents");
    return ok();
  } catch (e) {
    console.error("[deleteVideo] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
