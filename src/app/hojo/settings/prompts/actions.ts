"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

async function requireHojoEdit() {
  return requireStaffWithProjectPermission([
    { project: "hojo", level: "edit" },
  ]);
}

// ============================================
// Zoom AI プロンプト（SLP と共用）
// ============================================
// HOJO側では「議事録要約(HOJO用)」「先方参加者抽出(共通)」のみ編集対象とする。
// - summary は project_code=hojo の専用行
// - participants_extract は project_code=null の共通行
// お礼メッセージ系 (thankyou_*) は SLP専用機能なので HOJO 設定画面からは除外する
// （DBからは削除しない。SLP が現役で使用中）。
export async function listZoomAiPromptTemplates() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  return prisma.slpZoomAiPromptTemplate.findMany({
    where: {
      OR: [
        { templateKey: "summary", projectCode: "hojo" },
        { templateKey: "participants_extract", projectCode: null },
      ],
    },
    orderBy: { id: "asc" },
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function updateZoomAiPromptTemplate(
  id: number,
  promptBody: string,
  model: string,
  maxTokens: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireHojoEdit();
  if (!promptBody || promptBody.trim().length === 0) {
    return { ok: false, message: "プロンプト本文は必須です" };
  }
  if (maxTokens < 128 || maxTokens > 32768) {
    return { ok: false, message: "max_tokens は 128〜32768 の範囲で設定してください" };
  }
  try {
    await prisma.slpZoomAiPromptTemplate.update({
      where: { id },
      data: {
        promptBody,
        model,
        maxTokens,
        updatedByStaffId: user.id,
      },
    });
    revalidatePath("/hojo/settings/prompts");
    revalidatePath("/slp/settings/zoom-ai-prompts");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "更新失敗" };
  }
}

// ============================================
// 事業計画書プロンプト（HOJO 専用）
// ============================================
export async function getBusinessPlanPrompt() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  const tpl = await prisma.hojoBusinessPlanPrompt.findFirst({
    orderBy: { id: "asc" },
    include: { updatedBy: { select: { name: true } } },
  });
  return tpl;
}

export async function updateBusinessPlanPrompt(
  id: number,
  promptBody: string,
  model: string,
  maxTokens: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireHojoEdit();
  if (!promptBody || promptBody.trim().length === 0) {
    return { ok: false, message: "プロンプト本文は必須です" };
  }
  if (maxTokens < 128 || maxTokens > 200000) {
    return { ok: false, message: "max_tokens は 128〜200000 の範囲で設定してください" };
  }
  try {
    await prisma.hojoBusinessPlanPrompt.update({
      where: { id },
      data: {
        promptBody,
        model,
        maxTokens,
        updatedByStaffId: user.id,
      },
    });
    revalidatePath("/hojo/settings/prompts");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "更新失敗" };
  }
}
