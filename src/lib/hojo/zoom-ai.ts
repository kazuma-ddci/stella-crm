import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic/client";
import { renderTemplate } from "@/lib/zoom/templates";
import { formatJstDateTime } from "@/lib/zoom/templates";
import { logAutomationError } from "@/lib/automation-error";

// ============================================
// HOJO Zoom議事録要約・参加者抽出
// プロンプトは slp_zoom_ai_prompt_templates (共用)
// ============================================

/**
 * プロジェクト別プロンプトを取得する（HOJO 版）。
 * 指定 projectCode の専用行があればそれを、なければ共通行 (projectCode=null) を返す。
 */
async function getPrompt(templateKey: string, projectCode?: "slp" | "hojo") {
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

export type HojoZoomTaskCandidate = {
  taskType: "vendor" | "consulting_team";
  content: string;
  deadline: string;
  priority: string;
};

function normalizeTaskType(value: unknown): "vendor" | "consulting_team" | null {
  if (value === "vendor" || value === "先方" || value === "先方タスク") {
    return "vendor";
  }
  if (
    value === "consulting_team" ||
    value === "弊社" ||
    value === "弊社タスク" ||
    value === "コンサルチーム"
  ) {
    return "consulting_team";
  }
  return null;
}

function normalizePriority(value: unknown): string {
  const priority = typeof value === "string" ? value.trim() : "";
  return ["高", "中", "低"].includes(priority) ? priority : "";
}

function normalizeDeadline(value: unknown): string {
  if (typeof value !== "string") return "";
  const deadline = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : "";
}

function parseTaskCandidates(text: string): HojoZoomTaskCandidate[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];

  const parsed = JSON.parse(match[0]) as {
    tasks?: unknown[];
    vendorTasks?: unknown[];
    consultingTeamTasks?: unknown[];
  };
  const rawTasks: unknown[] = [];
  if (Array.isArray(parsed.tasks)) rawTasks.push(...parsed.tasks);
  if (Array.isArray(parsed.vendorTasks)) {
    rawTasks.push(
      ...parsed.vendorTasks.map((task) => ({
        ...(typeof task === "object" && task ? task : {}),
        taskType: "vendor",
      }))
    );
  }
  if (Array.isArray(parsed.consultingTeamTasks)) {
    rawTasks.push(
      ...parsed.consultingTeamTasks.map((task) => ({
        ...(typeof task === "object" && task ? task : {}),
        taskType: "consulting_team",
      }))
    );
  }

  return rawTasks
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const taskType = normalizeTaskType(row.taskType ?? row.type ?? row.owner);
      const content =
        typeof row.content === "string"
          ? row.content.trim()
          : typeof row.task === "string"
            ? row.task.trim()
            : "";
      if (!taskType || !content) return null;
      return {
        taskType,
        content,
        deadline: normalizeDeadline(row.deadline),
        priority: normalizePriority(row.priority),
      };
    })
    .filter((task): task is HojoZoomTaskCandidate => task !== null);
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

  const tpl = await getPrompt("summary", "hojo");
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
 * 文字起こしから先方タスク・弊社タスク候補を抽出（HOJO版）
 */
export async function generateTaskCandidatesForHojoRecording(params: {
  recordingId: number;
}): Promise<{ tasks: HojoZoomTaskCandidate[]; promptSnapshot: string; model: string }> {
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
  if (recording.contactHistory?.targetType !== "vendor" || !recording.contactHistory.vendorId) {
    throw new Error("ベンダー接触履歴に紐づくZoomのみタスク候補を生成できます");
  }

  const tpl = await getPrompt("task_extract", "hojo");
  const customerName = recording.contactHistory.vendor?.name || "";
  const dateJst = recording.scheduledAt ?? recording.recordingStartAt ?? null;
  const hostName = recording.hostStaff?.name ?? "";
  const systemPrompt = renderTemplate(tpl.promptBody, {
    事業者名: customerName,
    商談種別: "HOJOベンダー商談",
    日時: dateJst ? formatJstDateTime(dateJst) : "",
    担当者: hostName,
  });

  const { text } = await callClaude({
    model: tpl.model,
    systemPrompt,
    userMessage: `以下が今回の商談の文字起こしです。先方タスクと弊社タスクの候補を抽出してください。\n\n---\n${recording.transcriptText}\n---`,
    maxTokens: tpl.maxTokens,
    temperature: 0.2,
  });

  try {
    return {
      tasks: parseTaskCandidates(text),
      promptSnapshot: systemPrompt,
      model: tpl.model,
    };
  } catch (err) {
    await logAutomationError({
      source: "hojo-zoom-task-extract-parse",
      message: "タスク候補抽出JSONパース失敗",
      detail: {
        recordingId: params.recordingId,
        error: err instanceof Error ? err.message : String(err),
        aiResponsePreview: text.slice(0, 500),
      },
    });
    throw new Error("タスク候補の解析に失敗しました。プロンプトの出力形式を確認してください。");
  }
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
