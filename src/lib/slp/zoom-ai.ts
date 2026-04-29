import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic/client";
import { renderTemplate } from "@/lib/zoom/templates";
import { formatJstDateTime } from "@/lib/zoom/templates";
import { logAutomationError } from "@/lib/automation-error";

// ============================================
// Zoom議事録要約・参加者抽出・お礼メッセージ生成
// プロンプトは slp_zoom_ai_prompt_templates に保存（編集可能）
// ============================================

/**
 * プロジェクト別プロンプトを取得する。
 * 指定 projectCode の専用行があればそれを返し、なければ共通行 (projectCode=null) を返す。
 */
async function getPrompt(templateKey: string, projectCode?: "slp" | "hojo") {
  // プロジェクト別を優先、なければ共通
  if (projectCode) {
    const projectSpecific = await prisma.slpZoomAiPromptTemplate.findUnique({
      where: { projectCode_templateKey: { projectCode, templateKey } },
    });
    if (projectSpecific) return projectSpecific;
  }
  const shared = await prisma.slpZoomAiPromptTemplate.findFirst({
    where: { projectCode: null, templateKey },
  });
  if (!shared) {
    throw new Error(
      `AIプロンプトテンプレートが存在しません: ${templateKey} (projectCode=${projectCode ?? "null"})`,
    );
  }
  return shared;
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
          session: { select: { scheduledAt: true } },
        },
      },
      hostStaff: { select: { name: true } },
    },
  });
  if (!recording) throw new Error("録画レコードが見つかりません");
  if (!recording.transcriptText || recording.transcriptText.trim().length === 0) {
    throw new Error("文字起こしテキストがありません");
  }

  const tpl = await getPrompt("summary", "slp");
  const isBriefing = recording.category === "briefing";
  const companyName =
    recording.contactHistory?.companyRecord?.companyName ?? "";
  // 日時は Recording.scheduledAt > Session.scheduledAt の順で採用
  const dateJst =
    recording.scheduledAt ??
    recording.contactHistory?.session?.scheduledAt ??
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

  // 精度順: Claude生成議事録 > 全文書き起こし > Zoom AI Companion要約
  // （Zoom AI Companion 要約は精度が低めのため最終フォールバック）
  const summaryText =
    recording.claudeSummary ||
    recording.transcriptText?.slice(0, 5000) ||
    recording.aiCompanionSummary ||
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

/**
 * セッションに紐付く全ての Zoom 録画の議事録を集約して、Claude でお礼メッセージ文案を生成。
 * 商談完了モーダルから呼ばれる。
 *
 * 精度の優先順位（録画単位）:
 *   Claude生成議事録 > 全文書き起こし（5000字まで） > Zoom AI Companion 要約
 *
 * 複数録画がある場合は全て結合して一つのお礼文に。
 */
export async function generateThankYouSuggestionForSession(params: {
  sessionId: number;
}): Promise<
  | { ok: true; text: string; model: string; recordingCount: number }
  | { ok: false; reason: "no_recording" | "no_data"; message: string }
> {
  // V2 ContactHistoryV2 経由で session に紐付く meetings を取得 (sourceRefId で逆引き)
  const ch = await prisma.contactHistoryV2.findFirst({
    where: {
      sourceType: "slp_meeting_session",
      sourceRefId: String(params.sessionId),
      deletedAt: null,
    },
    include: {
      meetings: {
        where: { deletedAt: null },
        include: {
          record: {
            include: {
              summaries: {
                where: { source: "claude" },
                orderBy: { version: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!ch || ch.meetings.length === 0) {
    return {
      ok: false,
      reason: "no_recording",
      message: "このセッションに紐付くZoom録画がまだありません。",
    };
  }

  // 商談セッションから companyName / category を取得
  const session = await prisma.slpMeetingSession.findUnique({
    where: { id: params.sessionId },
    include: { companyRecord: { select: { companyName: true } } },
  });
  if (!session) {
    return {
      ok: false,
      reason: "no_recording",
      message: "セッションが見つかりません。",
    };
  }

  // 各 meeting について最良データを抽出
  // 優先順位: Claude生成議事録 (MeetingRecordSummary source="claude")
  //         > 全文書き起こし (transcriptText 5000字まで)
  //         > 既存 aiSummary (AI Companion / fallback)
  const summaryParts: string[] = [];
  let recordingCount = 0;
  for (const m of ch.meetings) {
    if (!m.record) continue;
    recordingCount++;
    const claudeSummary = m.record.summaries?.[0]?.summaryText;
    const aiSummary = m.record.aiSummary;
    const transcriptText = m.record.transcriptText;
    const best =
      claudeSummary || transcriptText?.slice(0, 5000) || aiSummary || "";
    if (!best.trim()) continue;
    const label = m.label ? m.label : m.isPrimary ? "メイン録画" : `追加録画 #${m.id}`;
    summaryParts.push(`【${label}】\n${best}`);
  }

  if (recordingCount === 0) {
    return {
      ok: false,
      reason: "no_recording",
      message: "このセッションに紐付くZoom録画がまだありません。",
    };
  }

  if (summaryParts.length === 0) {
    return {
      ok: false,
      reason: "no_data",
      message:
        "Zoom録画の議事録・文字起こし・要約のいずれもまだ生成されていません。会議終了から時間を置いて再度お試しください。",
    };
  }

  const combined = summaryParts.join("\n\n---\n\n");

  const templateKey =
    session.category === "briefing"
      ? "thankyou_briefing"
      : "thankyou_consultation";
  const tpl = await getPrompt(templateKey);
  const companyName = session.companyRecord.companyName ?? "";
  const systemPrompt = renderTemplate(tpl.promptBody, {
    事業者名: companyName,
    要約: combined,
  });

  const { text } = await callClaude({
    model: tpl.model,
    systemPrompt,
    userMessage: `上記の要約を踏まえてお礼メッセージを作成してください。`,
    maxTokens: tpl.maxTokens,
    temperature: 0.6,
  });

  return {
    ok: true,
    text,
    model: tpl.model,
    recordingCount,
  };
}
