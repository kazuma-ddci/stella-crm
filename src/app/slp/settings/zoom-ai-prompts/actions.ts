"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

async function requireSlpEdit() {
  return requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);
}

// SLP 側では以下を編集対象とする:
// - summary: projectCode=slp の専用行
// - participants_extract / thankyou_* : projectCode=null の共通行
// HOJO 専用の summary (projectCode=hojo) は除外。
export async function listZoomAiPromptTemplates() {
  await requireSlpEdit();
  return prisma.slpZoomAiPromptTemplate.findMany({
    where: {
      OR: [
        { templateKey: "summary", projectCode: "slp" },
        { projectCode: null },
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
  const user = await requireSlpEdit();
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
    revalidatePath("/slp/settings/zoom-ai-prompts");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "更新失敗" };
  }
}
