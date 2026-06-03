"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

async function requireHojoEdit() {
  return requireStaffWithProjectPermission([
    { project: "hojo", level: "edit" },
  ]);
}

const HOJO_TASK_EXTRACT_PROMPT = `あなたは補助金プロジェクトのベンダー商談からタスク候補を抽出する日本語アシスタントです。

商談情報:
- 事業者名: {{事業者名}}
- 商談種別: {{商談種別}}
- 日時: {{日時}}
- 担当者: {{担当者}}

文字起こしから、確定前に人が確認するための「先方タスク」と「弊社タスク」の候補だけを抽出してください。

ルール:
- 実際に依頼・宿題・次回対応として読み取れるものだけを出してください。
- 曖昧な内容は無理に作らず、要確認ならcontent内に「要確認:」と明記してください。
- 期限が明確な場合だけ YYYY-MM-DD で deadline に入れてください。不明なら空文字にしてください。
- priority は高・中・低のいずれか。不明なら空文字にしてください。
- 出力はJSONのみ。説明文やMarkdownを付けないでください。

出力形式:
{"tasks":[{"taskType":"vendor","content":"先方が対応する内容","deadline":"","priority":""},{"taskType":"consulting_team","content":"弊社が対応する内容","deadline":"","priority":""}]}`;

async function ensureHojoTaskExtractPrompt() {
  await prisma.slpZoomAiPromptTemplate.upsert({
    where: {
      projectCode_templateKey: {
        projectCode: "hojo",
        templateKey: "task_extract",
      },
    },
    update: {},
    create: {
      templateKey: "task_extract",
      projectCode: "hojo",
      label: "タスク候補抽出",
      promptBody: HOJO_TASK_EXTRACT_PROMPT,
      model: "claude-sonnet-4-6",
      maxTokens: 4096,
    },
  });
}

// ============================================
// Zoom AI プロンプト（SLP と共用）
// ============================================
// HOJO側では「議事録要約(HOJO用)」「タスク候補抽出(HOJO用)」「先方参加者抽出(共通)」を編集対象とする。
// - summary は project_code=hojo の専用行
// - task_extract は project_code=hojo の専用行
// - participants_extract は project_code=null の共通行
// お礼メッセージ系 (thankyou_*) は SLP専用機能なので HOJO 設定画面からは除外する
// （DBからは削除しない。SLP が現役で使用中）。
export async function listZoomAiPromptTemplates() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  await ensureHojoTaskExtractPrompt();
  const rows = await prisma.slpZoomAiPromptTemplate.findMany({
    where: {
      OR: [
        { templateKey: "summary", projectCode: "hojo" },
        { templateKey: "task_extract", projectCode: "hojo" },
        { templateKey: "participants_extract", projectCode: null },
      ],
    },
    orderBy: { id: "asc" },
    include: { updatedBy: { select: { name: true } } },
  });
  const order = new Map([
    ["hojo:summary", 1],
    ["hojo:task_extract", 2],
    ["common:participants_extract", 3],
  ]);
  return rows.sort((a, b) => {
    const aKey = `${a.projectCode ?? "common"}:${a.templateKey}`;
    const bKey = `${b.projectCode ?? "common"}:${b.templateKey}`;
    return (order.get(aKey) ?? 99) - (order.get(bKey) ?? 99);
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

// ============================================
// 事業計画書のセクション定義（title / targetChars / instruction のみ編集）
// ============================================
export async function listBusinessPlanSections() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  return prisma.hojoBusinessPlanSection.findMany({
    orderBy: { displayOrder: "asc" },
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function updateBusinessPlanSection(
  id: number,
  title: string,
  targetChars: number,
  instruction: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireHojoEdit();
  if (!title.trim()) return { ok: false, message: "タイトルは必須です" };
  if (!instruction.trim()) return { ok: false, message: "指示文は必須です" };
  if (targetChars < 100 || targetChars > 10000) {
    return { ok: false, message: "目安文字数は 100〜10000 の範囲で設定してください" };
  }
  try {
    await prisma.hojoBusinessPlanSection.update({
      where: { id },
      data: {
        title: title.trim(),
        targetChars,
        instruction: instruction.trim(),
        updatedByStaffId: user.id,
      },
    });
    revalidatePath("/hojo/settings/prompts");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "更新失敗" };
  }
}

/** デフォルト値（DEFAULT_SECTIONS_FALLBACK）に1セクションをリセット */
export async function resetBusinessPlanSection(
  id: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireHojoEdit();
  try {
    const { DEFAULT_SECTIONS_FALLBACK } = await import("@/lib/hojo/business-plan-sections");
    const row = await prisma.hojoBusinessPlanSection.findUnique({ where: { id } });
    if (!row) return { ok: false, message: "セクションが見つかりません" };
    const def = DEFAULT_SECTIONS_FALLBACK.find((d) => d.key === row.sectionKey);
    if (!def) return { ok: false, message: "デフォルト定義が見つかりません" };
    await prisma.hojoBusinessPlanSection.update({
      where: { id },
      data: {
        title: def.title,
        targetChars: def.targetChars,
        instruction: def.instruction,
        updatedByStaffId: user.id,
      },
    });
    revalidatePath("/hojo/settings/prompts");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "リセット失敗" };
  }
}
