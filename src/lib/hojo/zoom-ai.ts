import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic/client";
import { renderTemplate } from "@/lib/zoom/templates";
import { formatJstDateTime } from "@/lib/zoom/templates";
import { logAutomationError } from "@/lib/automation-error";

// ============================================
// HOJO Zoom議事録要約・参加者抽出
// プロンプトは slp_zoom_ai_prompt_templates (共用)
// ============================================

async function getPrompt(templateKey: string) {
  const tpl = await prisma.slpZoomAiPromptTemplate.findUnique({
    where: { templateKey },
  });
  if (!tpl) {
    throw new Error(`AIプロンプトテンプレートが存在しません: ${templateKey}`);
  }
  return tpl;
}

/**
 * 文字起こしから議事録要約をClaude Sonnet 4.6で生成（HOJO版）
 */
export async function generateClaudeSummaryForHojoRecording(params: {
  recordingId: number;
}): Promise<{ summary: string; promptSnapshot: string; model: string }> {
  const recording = await prisma.hojoZoomRecording.findUnique({
    where: { id: params.recordingId },
    include: {
      contactHistory: {
        include: {
          vendor: { select: { name: true } },
        },
      },
      hostStaff: { select: { name: true } },
    },
  });
  if (!recording) throw new Error("録画レコードが見つかりません");
  if (!recording.transcriptText || recording.transcriptText.trim().length === 0) {
    throw new Error("文字起こしテキストがありません");
  }

  const tpl = await getPrompt("summary");
  // ベンダーなら名称、BBS/貸金業社/その他は customerParticipants をそのまま利用
  const customerName =
    recording.contactHistory?.vendor?.name ||
    recording.contactHistory?.customerParticipants ||
    "";
  const dateJst = recording.scheduledAt ?? null;
  const hostName = recording.hostStaff?.name ?? "";

  const systemPrompt = renderTemplate(tpl.promptBody, {
    事業者名: customerName,
    商談種別: "HOJO商談",
    日時: dateJst ? formatJstDateTime(dateJst) : "",
    担当者: hostName,
  });

  const { text } = await callClaude({
    model: tpl.model,
    systemPrompt,
    userMessage: `以下が今回の商談の文字起こしです。これをもとに議事録を作成してください。\n\n---\n${recording.transcriptText}\n---`,
    maxTokens: tpl.maxTokens,
    temperature: 0.3,
  });

  await prisma.hojoZoomRecording.update({
    where: { id: params.recordingId },
    data: {
      claudeSummary: text,
      claudeSummaryGeneratedAt: new Date(),
      claudeSummaryPromptSnapshot: systemPrompt,
      claudeSummaryModel: tpl.model,
    },
  });

  return { summary: text, promptSnapshot: systemPrompt, model: tpl.model };
}

/**
 * 文字起こしから先方参加者をHaiku 4.5で抽出（HOJO版）
 */
export async function extractParticipantsForHojoRecording(params: {
  recordingId: number;
}): Promise<string[]> {
  const recording = await prisma.hojoZoomRecording.findUnique({
    where: { id: params.recordingId },
    include: { hostStaff: { select: { name: true } } },
  });
  if (!recording) throw new Error("録画レコードが見つかりません");
  if (!recording.transcriptText) return [];

  const tpl = await getPrompt("participants_extract");
  const staffList = recording.hostStaff?.name ?? "";
  const systemPrompt = renderTemplate(tpl.promptBody, {
    弊社スタッフ一覧: staffList,
  });

  const { text } = await callClaude({
    model: tpl.model,
    systemPrompt,
    userMessage: `以下が商談文字起こしです。先方参加者名を抽出してください。\n\n---\n${recording.transcriptText}\n---`,
    maxTokens: tpl.maxTokens,
    temperature: 0.2,
  });

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { participants?: string[] };
      if (Array.isArray(parsed.participants)) {
        const names = parsed.participants
          .filter((n) => typeof n === "string")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);

        await prisma.hojoZoomRecording.update({
          where: { id: params.recordingId },
          data: { participantsExtracted: names.join(", ") },
        });
        return names;
      }
    }
    await logAutomationError({
      source: "hojo-zoom-participants-parse",
      message: "参加者抽出JSONパース: 期待形式と不一致",
      detail: { recordingId: params.recordingId, aiResponsePreview: text.slice(0, 500) },
    });
  } catch (err) {
    await logAutomationError({
      source: "hojo-zoom-participants-parse",
      message: "参加者抽出JSONパース失敗",
      detail: {
        recordingId: params.recordingId,
        error: err instanceof Error ? err.message : String(err),
        aiResponsePreview: text.slice(0, 500),
      },
    });
  }
  return [];
}
