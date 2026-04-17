import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic/client";
import { renderTemplate } from "@/lib/zoom/templates";
import { formatJstDateTime } from "@/lib/zoom/templates";
import { logAutomationError } from "@/lib/automation-error";

// ============================================
// Zoom議事録要約・参加者抽出・お礼メッセージ生成
// プロンプトは slp_zoom_ai_prompt_templates に保存（編集可能）
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
 * 文字起こしから議事録要約をClaude Sonnet 4.6で生成。
 * プロンプトはDB編集可能。
 */
export async function generateClaudeSummaryForRecording(params: {
  recordingId: number;
}): Promise<{ summary: string; promptSnapshot: string; model: string }> {
  const recording = await prisma.slpZoomRecording.findUnique({
    where: { id: params.recordingId },
    include: {
      contactHistory: {
        include: {
          companyRecord: { select: { companyName: true } },
        },
      },
      hostStaff: { select: { name: true } },
      sessionZoom: {
        select: {
          scheduledAt: true,
          session: { select: { scheduledAt: true } },
        },
      },
    },
  });
  if (!recording) throw new Error("録画レコードが見つかりません");
  if (!recording.transcriptText || recording.transcriptText.trim().length === 0) {
    throw new Error("文字起こしテキストがありません");
  }

  const tpl = await getPrompt("summary");
  const isBriefing = recording.category === "briefing";
  const companyName =
    recording.contactHistory?.companyRecord?.companyName ?? "";
  const dateJst =
    recording.sessionZoom?.scheduledAt ??
    recording.sessionZoom?.session?.scheduledAt ??
    null;
  const hostName = recording.hostStaff?.name ?? "";

  const systemPrompt = renderTemplate(tpl.promptBody, {
    事業者名: companyName,
    商談種別: isBriefing ? "概要案内" : "導入希望商談",
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

  await prisma.slpZoomRecording.update({
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
 * 文字起こしから先方参加者をHaiku 4.5で抽出。
 */
export async function extractParticipantsForRecording(params: {
  recordingId: number;
}): Promise<string[]> {
  const recording = await prisma.slpZoomRecording.findUnique({
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

  // JSONパース（{"participants":[...]}）を試みる
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { participants?: string[] };
      if (Array.isArray(parsed.participants)) {
        const names = parsed.participants
          .filter((n) => typeof n === "string")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);

        await prisma.slpZoomRecording.update({
          where: { id: params.recordingId },
          data: { participantsExtracted: names.join(", ") },
        });
        return names;
      }
    }
    // JSON構造の期待に合わなかった
    await logAutomationError({
      source: "slp-zoom-participants-parse",
      message: "参加者抽出JSONパース: 期待形式と不一致",
      detail: { recordingId: params.recordingId, aiResponsePreview: text.slice(0, 500) },
    });
  } catch (err) {
    await logAutomationError({
      source: "slp-zoom-participants-parse",
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

/**
 * 商談要約を踏まえて お礼メッセージ文案をHaiku 4.5で生成。
 * スタッフが画面で確認・編集してから送信する用。
 */
export async function generateThankYouSuggestion(params: {
  recordingId: number;
}): Promise<{ text: string; model: string }> {
  const recording = await prisma.slpZoomRecording.findUnique({
    where: { id: params.recordingId },
    include: {
      contactHistory: {
        include: {
          companyRecord: {
            select: { companyName: true, prolineUid: true },
          },
        },
      },
    },
  });
  if (!recording) throw new Error("録画レコードが見つかりません");

  const summaryText =
    recording.claudeSummary ||
    recording.aiCompanionSummary ||
    recording.transcriptText?.slice(0, 3000) ||
    "";
  if (!summaryText.trim()) {
    throw new Error("要約または文字起こしがないのでお礼文を生成できません");
  }

  const templateKey =
    recording.category === "briefing"
      ? "thankyou_briefing"
      : "thankyou_consultation";
  const tpl = await getPrompt(templateKey);
  const companyName = recording.contactHistory?.companyRecord?.companyName ?? "";
  const systemPrompt = renderTemplate(tpl.promptBody, {
    事業者名: companyName,
    要約: summaryText,
  });

  const { text } = await callClaude({
    model: tpl.model,
    systemPrompt,
    userMessage: `上記の要約を踏まえてお礼メッセージを作成してください。`,
    maxTokens: tpl.maxTokens,
    temperature: 0.6,
  });

  return { text, model: tpl.model };
}
