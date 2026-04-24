import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

/**
 * V1 (slpZoomRecording / hojoZoomRecording) → V2 (ContactHistoryMeetingRecord +
 * MeetingRecordSummary) への同期。
 *
 * V1 併走期間中は V1 が真実のソースであり、V1 processor が録画DL・AI要約取得を
 * 担う。本モジュールはその結果を V2 側に転記し、V2 単体で情報が完結する状態を
 * 保つためのもの。
 *
 * 起動タイミング:
 *   - Webhook 受信時 (recording.completed / meeting.summary_completed) で
 *     V1 processor 完了後に fire-and-forget で呼ばれる
 *   - 手動「取得」ボタン経由でも同様
 *
 * 冪等性: V2 ContactHistoryMeetingRecord は meetingId ユニーク制約のため upsert。
 *         MeetingRecordSummary は (meetingRecordId, version) ユニークで upsert。
 */

type LegacyScope = "slp" | "hojo";

type SyncResult = {
  ok: boolean;
  meetingFound: boolean;
  meetingId?: number;
  recordId?: number;
  summariesWritten?: number;
  reason?: string;
};

/** V1 recording ID から V2 ContactHistoryMeeting を外部ID経由で解決 */
async function resolveV2MeetingFromV1Recording(
  scope: LegacyScope,
  legacyRecording: {
    zoomMeetingId: bigint;
    zoomMeetingUuid: string | null;
  },
): Promise<{ meetingRowId: number } | null> {
  const externalMeetingId = legacyRecording.zoomMeetingId.toString();
  const meeting = await prisma.contactHistoryMeeting.findFirst({
    where: {
      provider: "zoom",
      externalMeetingId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (meeting) return { meetingRowId: meeting.id };

  // UUID でもフォールバック検索 (externalMeetingId が移行時に空だったデータ対策)
  if (legacyRecording.zoomMeetingUuid) {
    const meetingByUuid = await prisma.contactHistoryMeeting.findFirst({
      where: {
        provider: "zoom",
        externalMeetingUuid: legacyRecording.zoomMeetingUuid,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (meetingByUuid) return { meetingRowId: meetingByUuid.id };
  }

  void scope;
  return null;
}

/**
 * 指定 V1 recording のデータを V2 側 (MeetingRecord + Summaries) に転記する。
 * V1 併走期間中にのみ呼ばれる。
 */
export async function syncMeetingRecordFromV1(params: {
  scope: LegacyScope;
  legacyRecordingId: number;
}): Promise<SyncResult> {
  const { scope, legacyRecordingId } = params;

  try {
    if (scope === "slp") {
      return await syncFromSlp(legacyRecordingId);
    } else {
      return await syncFromHojo(legacyRecordingId);
    }
  } catch (err) {
    await logAutomationError({
      source: "contact-history-v2-zoom-sync",
      message: `V1→V2 sync 失敗 (${scope})`,
      detail: {
        legacyRecordingId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, meetingFound: false, reason: "exception" };
  }
}

async function syncFromSlp(legacyRecordingId: number): Promise<SyncResult> {
  const rec = await prisma.slpZoomRecording.findUnique({
    where: { id: legacyRecordingId },
  });
  if (!rec) return { ok: false, meetingFound: false, reason: "legacy_not_found" };

  const resolved = await resolveV2MeetingFromV1Recording("slp", rec);
  if (!resolved) {
    // V2 meeting がまだ作成されていない(新規Zoomを手動追加した直後 等) → スキップ
    return { ok: false, meetingFound: false, reason: "v2_meeting_not_found" };
  }

  const recordId = await upsertMeetingRecord({
    meetingRowId: resolved.meetingRowId,
    recordingStartAt: rec.recordingStartAt ?? null,
    recordingEndAt: rec.recordingEndAt ?? null,
    recordingPath: rec.mp4Path ?? null,
    recordingSizeBytes: rec.mp4SizeBytes ?? null,
    transcriptText: rec.transcriptText ?? null,
    chatLogText: rec.chatLogText ?? null,
    attendanceJson: rec.participantsJson ?? null,
    downloadStatus: rec.downloadStatus,
    downloadError: rec.downloadError ?? null,
    aiSummary: rec.aiCompanionSummary ?? rec.claudeSummary ?? null,
    aiSummarySource: rec.claudeSummary
      ? "claude"
      : rec.aiCompanionSummary
        ? "zoom_ai_companion"
        : null,
    aiSummaryModel: rec.claudeSummary ? rec.claudeSummaryModel ?? null : null,
    aiSummaryGeneratedAt:
      rec.claudeSummaryGeneratedAt ?? rec.aiCompanionFetchedAt ?? null,
    providerRawData: {
      legacyScope: "slp",
      legacyRecordingId: rec.id,
      summaryNextSteps: rec.summaryNextSteps ?? null,
      participantsExtracted: rec.participantsExtracted ?? null,
      claudeSummaryPromptSnapshot: rec.claudeSummaryPromptSnapshot ?? null,
    },
  });

  // サマリーのバージョン管理 (V1 は Zoom AI Companion と Claude の2種類)
  let summariesWritten = 0;
  if (rec.aiCompanionSummary) {
    await upsertMeetingSummary({
      meetingRecordId: recordId,
      version: 1,
      summaryText: rec.aiCompanionSummary,
      source: "zoom_ai_companion",
      model: null,
      promptSnapshot: null,
      generatedAt: rec.aiCompanionFetchedAt ?? new Date(),
      generatedByStaffId: null,
      isCurrent: !rec.claudeSummary, // Claude がなければ現行版
    });
    summariesWritten++;
  }
  if (rec.claudeSummary) {
    await upsertMeetingSummary({
      meetingRecordId: recordId,
      version: 2,
      summaryText: rec.claudeSummary,
      source: "claude",
      model: rec.claudeSummaryModel ?? null,
      promptSnapshot: rec.claudeSummaryPromptSnapshot ?? null,
      generatedAt: rec.claudeSummaryGeneratedAt ?? new Date(),
      generatedByStaffId: null,
      isCurrent: true, // Claude があれば現行版
    });
    summariesWritten++;
  }

  return {
    ok: true,
    meetingFound: true,
    meetingId: resolved.meetingRowId,
    recordId,
    summariesWritten,
  };
}

async function syncFromHojo(legacyRecordingId: number): Promise<SyncResult> {
  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { id: legacyRecordingId },
  });
  if (!rec) return { ok: false, meetingFound: false, reason: "legacy_not_found" };

  const resolved = await resolveV2MeetingFromV1Recording("hojo", rec);
  if (!resolved) {
    return { ok: false, meetingFound: false, reason: "v2_meeting_not_found" };
  }

  const recordId = await upsertMeetingRecord({
    meetingRowId: resolved.meetingRowId,
    recordingStartAt: rec.recordingStartAt ?? null,
    recordingEndAt: rec.recordingEndAt ?? null,
    recordingPath: rec.mp4Path ?? null,
    recordingSizeBytes: rec.mp4SizeBytes ?? null,
    transcriptText: rec.transcriptText ?? null,
    chatLogText: rec.chatLogText ?? null,
    attendanceJson: rec.participantsJson ?? null,
    downloadStatus: rec.downloadStatus,
    downloadError: rec.downloadError ?? null,
    aiSummary: rec.aiCompanionSummary ?? rec.claudeSummary ?? null,
    aiSummarySource: rec.claudeSummary
      ? "claude"
      : rec.aiCompanionSummary
        ? "zoom_ai_companion"
        : null,
    aiSummaryModel: rec.claudeSummary ? rec.claudeSummaryModel ?? null : null,
    aiSummaryGeneratedAt:
      rec.claudeSummaryGeneratedAt ?? rec.aiCompanionFetchedAt ?? null,
    providerRawData: {
      legacyScope: "hojo",
      legacyRecordingId: rec.id,
      summaryNextSteps: rec.summaryNextSteps ?? null,
      participantsExtracted: rec.participantsExtracted ?? null,
      claudeSummaryPromptSnapshot: rec.claudeSummaryPromptSnapshot ?? null,
    },
  });

  let summariesWritten = 0;
  if (rec.aiCompanionSummary) {
    await upsertMeetingSummary({
      meetingRecordId: recordId,
      version: 1,
      summaryText: rec.aiCompanionSummary,
      source: "zoom_ai_companion",
      model: null,
      promptSnapshot: null,
      generatedAt: rec.aiCompanionFetchedAt ?? new Date(),
      generatedByStaffId: null,
      isCurrent: !rec.claudeSummary,
    });
    summariesWritten++;
  }
  if (rec.claudeSummary) {
    await upsertMeetingSummary({
      meetingRecordId: recordId,
      version: 2,
      summaryText: rec.claudeSummary,
      source: "claude",
      model: rec.claudeSummaryModel ?? null,
      promptSnapshot: rec.claudeSummaryPromptSnapshot ?? null,
      generatedAt: rec.claudeSummaryGeneratedAt ?? new Date(),
      generatedByStaffId: null,
      isCurrent: true,
    });
    summariesWritten++;
  }

  return {
    ok: true,
    meetingFound: true,
    meetingId: resolved.meetingRowId,
    recordId,
    summariesWritten,
  };
}

// ============================================================
// Upsert helpers
// ============================================================

type MeetingRecordUpsertData = {
  meetingRowId: number;
  recordingStartAt: Date | null;
  recordingEndAt: Date | null;
  recordingPath: string | null;
  recordingSizeBytes: bigint | number | null;
  transcriptText: string | null;
  chatLogText: string | null;
  attendanceJson: string | null;
  downloadStatus: string;
  downloadError: string | null;
  aiSummary: string | null;
  aiSummarySource: string | null;
  aiSummaryModel: string | null;
  aiSummaryGeneratedAt: Date | null;
  providerRawData: Record<string, unknown>;
};

async function upsertMeetingRecord(data: MeetingRecordUpsertData): Promise<number> {
  const attendanceJsonParsed = parseJsonField(data.attendanceJson);
  const recordingSize =
    data.recordingSizeBytes == null
      ? null
      : typeof data.recordingSizeBytes === "bigint"
        ? data.recordingSizeBytes
        : BigInt(data.recordingSizeBytes);

  const upserted = await prisma.contactHistoryMeetingRecord.upsert({
    where: { meetingId: data.meetingRowId },
    create: {
      meetingId: data.meetingRowId,
      recordingStartAt: data.recordingStartAt,
      recordingEndAt: data.recordingEndAt,
      recordingPath: data.recordingPath,
      recordingSizeBytes: recordingSize,
      transcriptText: data.transcriptText,
      chatLogText: data.chatLogText,
      attendanceJson: attendanceJsonParsed ?? undefined,
      downloadStatus: data.downloadStatus,
      downloadError: data.downloadError,
      aiSummary: data.aiSummary,
      aiSummarySource: data.aiSummarySource,
      aiSummaryModel: data.aiSummaryModel,
      aiSummaryGeneratedAt: data.aiSummaryGeneratedAt,
      providerRawData: data.providerRawData as object,
    },
    update: {
      recordingStartAt: data.recordingStartAt,
      recordingEndAt: data.recordingEndAt,
      recordingPath: data.recordingPath,
      recordingSizeBytes: recordingSize,
      transcriptText: data.transcriptText,
      chatLogText: data.chatLogText,
      attendanceJson: attendanceJsonParsed ?? undefined,
      downloadStatus: data.downloadStatus,
      downloadError: data.downloadError,
      aiSummary: data.aiSummary,
      aiSummarySource: data.aiSummarySource,
      aiSummaryModel: data.aiSummaryModel,
      aiSummaryGeneratedAt: data.aiSummaryGeneratedAt,
      providerRawData: data.providerRawData as object,
    },
    select: { id: true },
  });
  return upserted.id;
}

type MeetingSummaryUpsertData = {
  meetingRecordId: number;
  version: number;
  summaryText: string;
  source: string;
  model: string | null;
  promptSnapshot: string | null;
  generatedAt: Date;
  generatedByStaffId: number | null;
  isCurrent: boolean;
};

async function upsertMeetingSummary(data: MeetingSummaryUpsertData): Promise<void> {
  // 他バージョンの isCurrent を落とす (本バージョンが isCurrent=true のとき)
  if (data.isCurrent) {
    await prisma.meetingRecordSummary.updateMany({
      where: {
        meetingRecordId: data.meetingRecordId,
        version: { not: data.version },
        isCurrent: true,
      },
      data: { isCurrent: false },
    });
  }

  await prisma.meetingRecordSummary.upsert({
    where: {
      meetingRecordId_version: {
        meetingRecordId: data.meetingRecordId,
        version: data.version,
      },
    },
    create: {
      meetingRecordId: data.meetingRecordId,
      version: data.version,
      summaryText: data.summaryText,
      source: data.source,
      model: data.model,
      promptSnapshot: data.promptSnapshot,
      generatedAt: data.generatedAt,
      generatedByStaffId: data.generatedByStaffId,
      isCurrent: data.isCurrent,
    },
    update: {
      summaryText: data.summaryText,
      source: data.source,
      model: data.model,
      promptSnapshot: data.promptSnapshot,
      generatedAt: data.generatedAt,
      generatedByStaffId: data.generatedByStaffId,
      isCurrent: data.isCurrent,
    },
  });
}

function parseJsonField(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
