import { prisma } from "@/lib/prisma";
import type { ZoomRecordingPayload } from "@/lib/zoom/recording";
import {
  downloadZoomRecordingFiles,
  fetchRecordingMetadata,
} from "@/lib/zoom/recording";
import {
  deleteZoomRecordingFile,
  getZoomMeetingSummary,
  getPastMeetingParticipants,
} from "@/lib/zoom/meeting";
import { logAutomationError } from "@/lib/automation-error";
import { extractParticipantsForHojoRecording } from "./zoom-ai";
import { appendRecordingMinutesHojo } from "./hojo-meeting-minutes";

// ============================================
// HOJO版 Zoom録画処理
// SLP版(zoom-recording-processor.ts)と同構造、モデル名のみHOJO向け
// ============================================

type RecordingContext = {
  recordingRowId: number;
  contactHistoryId: number;
  hostStaffId: number;
  meetingId: bigint;
  meetingUuid: string | null;
};

async function findExistingRecordingByMeetingId(
  meetingId: bigint
): Promise<RecordingContext | null> {
  const existing = await prisma.hojoZoomRecording.findUnique({
    where: { zoomMeetingId: meetingId },
  });
  if (!existing) return null;

  return {
    recordingRowId: existing.id,
    contactHistoryId: existing.contactHistoryId,
    hostStaffId: existing.hostStaffId ?? 0,
    meetingId: existing.zoomMeetingId,
    meetingUuid: existing.zoomMeetingUuid,
  };
}

// ============================================
// AI Companion 要約取得
// ============================================
export async function fetchAndSaveAiSummary(
  recordingRowId: number
): Promise<{ ok: boolean; updated: boolean }> {
  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { id: recordingRowId },
    include: { contactHistory: true },
  });
  if (!rec) return { ok: false, updated: false };
  if (!rec.hostStaffId || !rec.zoomMeetingUuid) {
    return { ok: false, updated: false };
  }
  if (rec.aiCompanionSummary && rec.summaryNextSteps !== null) {
    return { ok: true, updated: false };
  }

  let summaryResult: Awaited<ReturnType<typeof getZoomMeetingSummary>>;
  try {
    summaryResult = await getZoomMeetingSummary({
      hostStaffId: rec.hostStaffId,
      meetingUuid: rec.zoomMeetingUuid,
    });
  } catch (err) {
    await logAutomationError({
      source: "hojo-zoom-ai-companion-summary",
      message: "AI Companion要約取得失敗",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, updated: false };
  }

  const updates: {
    aiCompanionSummary?: string | null;
    aiCompanionFetchedAt: Date;
    summaryNextSteps?: string | null;
  } = {
    aiCompanionFetchedAt: new Date(),
  };
  let changed = false;
  if (summaryResult.summaryText && !rec.aiCompanionSummary) {
    updates.aiCompanionSummary = summaryResult.summaryText;
    changed = true;
  }
  if (summaryResult.nextSteps && !rec.summaryNextSteps) {
    updates.summaryNextSteps = summaryResult.nextSteps;
    changed = true;
  }

  await prisma.hojoZoomRecording.update({
    where: { id: recordingRowId },
    data: updates,
  });
  if (!changed) return { ok: true, updated: false };

  await appendRecordingMinutesHojo({ recordingId: recordingRowId });

  return { ok: true, updated: true };
}

// ============================================
// 録画ファイル DL
// ============================================
export async function downloadAndSaveRecordingFiles(
  recordingRowId: number,
  payload?: ZoomRecordingPayload
): Promise<{
  ok: boolean;
  mp4: boolean;
  transcript: boolean;
  chat: boolean;
}> {
  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { id: recordingRowId },
  });
  if (!rec) return { ok: false, mp4: false, transcript: false, chat: false };
  if (!rec.hostStaffId) {
    return { ok: false, mp4: false, transcript: false, chat: false };
  }

  let recordingPayload = payload;
  if (!recordingPayload) {
    try {
      const fetched = await fetchRecordingMetadata({
        hostStaffId: rec.hostStaffId,
        meetingId: rec.zoomMeetingId,
      });
      recordingPayload = fetched ?? undefined;
    } catch (err) {
      await logAutomationError({
        source: "hojo-zoom-recording-metadata",
        message: "録画メタデータ取得失敗",
        detail: {
          recordingId: recordingRowId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
  if (!recordingPayload) {
    await prisma.hojoZoomRecording.update({
      where: { id: recordingRowId },
      data: {
        downloadStatus: "no_recording",
        downloadError: "Zoom側に録画が存在しないか削除済みです",
        chatFetchedAt: rec.chatFetchedAt ?? new Date(),
      },
    });
    return { ok: false, mp4: false, transcript: false, chat: false };
  }

  const progressData: {
    downloadStatus: string;
    zoomMeetingUuid?: string;
  } = {
    downloadStatus: "in_progress",
  };
  if (recordingPayload.uuid && !rec.zoomMeetingUuid) {
    progressData.zoomMeetingUuid = recordingPayload.uuid;
  }
  await prisma.hojoZoomRecording.update({
    where: { id: recordingRowId },
    data: progressData,
  });

  const fileSummary = recordingPayload.recording_files.map((f) => ({
    id: f.id ?? null,
    file_type: f.file_type,
    file_extension: f.file_extension ?? null,
    recording_type: (f as unknown as { recording_type?: string }).recording_type ?? null,
    has_download_url: !!f.download_url,
    recording_start: f.recording_start ?? null,
    recording_end: f.recording_end ?? null,
  }));
  await logAutomationError({
    source: "hojo-zoom-debug-payload",
    message: `Zoom payload files: ${fileSummary.length}件`,
    detail: {
      recordingId: recordingRowId,
      meetingId: rec.zoomMeetingId.toString(),
      meetingUuid: recordingPayload.uuid ?? null,
      fileCount: fileSummary.length,
      files: fileSummary,
    },
  });

  let downloaded;
  try {
    downloaded = await downloadZoomRecordingFiles({
      hostStaffId: rec.hostStaffId,
      contactHistoryId: rec.contactHistoryId,
      recordingId: rec.id,
      recording: recordingPayload,
      skipMp4: !!rec.mp4Path,
      skipTranscript: !!rec.transcriptText,
      skipChat: !!rec.chatLogText,
    });
  } catch (err) {
    await prisma.hojoZoomRecording.update({
      where: { id: recordingRowId },
      data: {
        downloadStatus: "failed",
        downloadError: err instanceof Error ? err.message : String(err),
      },
    });
    await logAutomationError({
      source: "hojo-zoom-recording-download",
      message: "録画DL失敗",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, mp4: false, transcript: false, chat: false };
  }

  const updates: Record<string, unknown> = {
    chatFetchedAt: new Date(),
  };
  let mp4Saved = false;
  let transcriptSaved = false;
  let chatSaved = false;
  if (downloaded.mp4RelPath) {
    updates.mp4Path = downloaded.mp4RelPath;
    if (downloaded.mp4Size !== null) {
      updates.mp4SizeBytes = BigInt(downloaded.mp4Size);
    }
    mp4Saved = true;
  }
  if (downloaded.transcriptRelPath) {
    updates.transcriptPath = downloaded.transcriptRelPath;
    updates.transcriptText = downloaded.transcriptText;
    transcriptSaved = true;
  }
  if (downloaded.chatRelPath) {
    updates.chatLogPath = downloaded.chatRelPath;
    updates.chatLogText = downloaded.chatText;
    chatSaved = true;
  }

  const starts: number[] = [];
  const ends: number[] = [];
  for (const f of recordingPayload.recording_files) {
    if (f.recording_start) {
      const t = new Date(f.recording_start);
      if (!isNaN(t.getTime())) starts.push(t.getTime());
    }
    if (f.recording_end) {
      const t = new Date(f.recording_end);
      if (!isNaN(t.getTime())) ends.push(t.getTime());
    }
  }
  if (starts.length > 0) {
    updates.recordingStartAt = new Date(Math.min(...starts));
  }
  if (ends.length > 0) {
    updates.recordingEndAt = new Date(Math.max(...ends));
  }

  const payloadHasMp4 = recordingPayload.recording_files.some(
    (f) => f.file_type === "MP4"
  );
  let finalStatus: string;
  if (payloadHasMp4) {
    finalStatus = mp4Saved || rec.mp4Path ? "completed" : "failed";
  } else {
    finalStatus = "completed";
  }
  updates.downloadStatus = finalStatus;
  updates.downloadError = null;

  await prisma.hojoZoomRecording.update({
    where: { id: recordingRowId },
    data: updates,
  });

  const suffix = rec.isPrimary
    ? ""
    : rec.label
      ? `（${rec.label}）`
      : `（Zoom #${rec.id}）`;
  if (mp4Saved && downloaded.mp4RelPath) {
    const exists = await prisma.hojoContactHistoryFile.findFirst({
      where: { filePath: downloaded.mp4RelPath },
    });
    if (!exists) {
      await prisma.hojoContactHistoryFile.create({
        data: {
          contactHistoryId: rec.contactHistoryId,
          fileName: `商談録画${suffix}.mp4`,
          filePath: downloaded.mp4RelPath,
          fileSize: downloaded.mp4Size,
          mimeType: "video/mp4",
        },
      });
    }
  }
  if (transcriptSaved && downloaded.transcriptRelPath) {
    const exists = await prisma.hojoContactHistoryFile.findFirst({
      where: { filePath: downloaded.transcriptRelPath },
    });
    if (!exists) {
      await prisma.hojoContactHistoryFile.create({
        data: {
          contactHistoryId: rec.contactHistoryId,
          fileName: `文字起こし${suffix}.vtt`,
          mimeType: "text/vtt",
          filePath: downloaded.transcriptRelPath,
        },
      });
    }
  }
  if (chatSaved && downloaded.chatRelPath) {
    const exists = await prisma.hojoContactHistoryFile.findFirst({
      where: { filePath: downloaded.chatRelPath },
    });
    if (!exists) {
      await prisma.hojoContactHistoryFile.create({
        data: {
          contactHistoryId: rec.contactHistoryId,
          fileName: `チャットログ${suffix}.txt`,
          mimeType: "text/plain",
          filePath: downloaded.chatRelPath,
        },
      });
    }
  }

  await deleteFetchedZoomFiles(
    recordingPayload,
    rec.hostStaffId,
    rec.zoomMeetingId,
    rec.zoomMeetingUuid,
    downloaded
  );

  return { ok: true, mp4: mp4Saved, transcript: transcriptSaved, chat: chatSaved };
}

async function deleteFetchedZoomFiles(
  payload: ZoomRecordingPayload,
  hostStaffId: number,
  meetingId: bigint,
  meetingUuid: string | null,
  downloaded: Awaited<ReturnType<typeof downloadZoomRecordingFiles>>
): Promise<void> {
  const fileIdsToDelete = [
    downloaded.mp4FileId,
    downloaded.transcriptFileId,
    downloaded.chatFileId,
  ].filter((id): id is string => !!id);

  const meetingKey = meetingUuid || meetingId;
  let deletedAll = fileIdsToDelete.length > 0;
  for (const fileId of fileIdsToDelete) {
    try {
      await deleteZoomRecordingFile({
        hostStaffId,
        meetingId: meetingKey,
        recordingId: fileId,
        action: "delete",
      });
    } catch (err) {
      deletedAll = false;
      await logAutomationError({
        source: "hojo-zoom-recording-file-delete",
        message: "Zoom側録画ファイル削除失敗",
        detail: {
          error: err instanceof Error ? err.message : String(err),
          meetingId: meetingId.toString(),
          recordingFileId: fileId,
        },
      });
    }
  }
  if (deletedAll) {
    const r = await prisma.hojoZoomRecording.findUnique({
      where: { zoomMeetingId: meetingId },
      select: { id: true },
    });
    if (r) {
      await prisma.hojoZoomRecording.update({
        where: { id: r.id },
        data: { zoomCloudDeletedAt: new Date() },
      });
    }
  }
  void payload;
}

// ============================================
// 参加者情報取得
// ============================================
export async function fetchAndSaveParticipants(
  recordingRowId: number
): Promise<{ ok: boolean; count: number }> {
  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { id: recordingRowId },
  });
  if (!rec) return { ok: false, count: 0 };
  if (!rec.hostStaffId || !rec.zoomMeetingUuid) {
    return { ok: false, count: 0 };
  }
  if (rec.participantsFetchedAt) {
    return { ok: true, count: 0 };
  }

  let participants;
  try {
    participants = await getPastMeetingParticipants({
      hostStaffId: rec.hostStaffId,
      meetingUuid: rec.zoomMeetingUuid,
    });
  } catch (err) {
    await logAutomationError({
      source: "hojo-zoom-participants-fetch",
      message: "参加者情報取得失敗",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, count: 0 };
  }

  await prisma.hojoZoomRecording.update({
    where: { id: recordingRowId },
    data: {
      participantsJson: JSON.stringify(participants),
      participantsFetchedAt: new Date(),
    },
  });

  return { ok: true, count: participants.length };
}

// ============================================
// 全部まとめて取得
// ============================================
export async function fetchAllForRecording(recordingRowId: number): Promise<{
  aiSummary: { ok: boolean; updated: boolean };
  files: { ok: boolean; mp4: boolean; transcript: boolean; chat: boolean };
  participants: { ok: boolean; count: number };
  participantsAi: { ok: boolean; count: number };
  state: string;
}> {
  await prisma.hojoZoomRecording.update({
    where: { id: recordingRowId },
    data: { state: "取得中" },
  });

  try {
    const files = await downloadAndSaveRecordingFiles(recordingRowId);
    const aiSummary = await fetchAndSaveAiSummary(recordingRowId);
    const participants = await fetchAndSaveParticipants(recordingRowId);

    let participantsAi = { ok: false, count: 0 };
    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingRowId },
      include: { contactHistory: true },
    });
    if (rec?.transcriptText && !rec.participantsExtracted) {
      try {
        const names = await extractParticipantsForHojoRecording({
          recordingId: recordingRowId,
        });
        if (names.length > 0 && rec.contactHistory) {
          await prisma.hojoContactHistory.update({
            where: { id: rec.contactHistoryId },
            data: { customerParticipants: names.join(", ").slice(0, 500) },
          });
        }
        participantsAi = { ok: true, count: names.length };
      } catch (err) {
        await logAutomationError({
          source: "hojo-zoom-participants-extract",
          message: "先方参加者抽出失敗",
          detail: {
            recordingId: recordingRowId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    const newState = await finalizeRecordingState(recordingRowId);
    return { aiSummary, files, participants, participantsAi, state: newState };
  } catch (err) {
    await logAutomationError({
      source: "hojo-zoom-fetch-all",
      message: "fetchAllForRecording で想定外の例外",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    try {
      await finalizeRecordingState(recordingRowId);
    } catch {
      await prisma.hojoZoomRecording
        .update({ where: { id: recordingRowId }, data: { state: "失敗" } })
        .catch(() => {});
    }
    throw err;
  }
}

async function finalizeRecordingState(recordingRowId: number): Promise<"予定" | "完了" | "失敗"> {
  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { id: recordingRowId },
    select: {
      downloadStatus: true,
      aiCompanionSummary: true,
      summaryNextSteps: true,
      transcriptText: true,
      mp4Path: true,
      chatLogText: true,
      participantsJson: true,
      recordingEndAt: true,
      scheduledAt: true,
      createdAt: true,
    },
  });
  if (!rec) return "失敗";

  const hasAnyData =
    !!rec.aiCompanionSummary ||
    !!rec.summaryNextSteps ||
    !!rec.transcriptText ||
    !!rec.mp4Path ||
    !!rec.chatLogText ||
    (!!rec.participantsJson && rec.participantsJson !== "[]");

  const meetingEndRef =
    rec.recordingEndAt ?? rec.scheduledAt ?? rec.createdAt;
  const GRACE_PERIOD_MS = 6 * 60 * 60 * 1000;
  const pastGracePeriod =
    Date.now() - meetingEndRef.getTime() > GRACE_PERIOD_MS;

  let newState: "予定" | "完了" | "失敗";
  if (hasAnyData) {
    newState = "完了";
  } else if (rec.downloadStatus === "failed") {
    newState = "失敗";
  } else if (pastGracePeriod) {
    newState = "完了";
  } else {
    newState = "予定";
  }

  await prisma.hojoZoomRecording.update({
    where: { id: recordingRowId },
    data: { state: newState },
  });
  return newState;
}

// ============================================
// Webhook エントリポイント1: recording.completed / recording.transcript_completed
// ============================================
export async function processHojoZoomRecordingCompleted(
  payload: ZoomRecordingPayload
): Promise<void> {
  const meetingIdNum =
    typeof payload.id === "string" ? BigInt(payload.id) : BigInt(payload.id);

  const ctx = await findExistingRecordingByMeetingId(meetingIdNum);
  if (!ctx) return;

  if (payload.uuid && !ctx.meetingUuid) {
    await prisma.hojoZoomRecording.update({
      where: { id: ctx.recordingRowId },
      data: { zoomMeetingUuid: payload.uuid },
    });
  }

  await downloadAndSaveRecordingFiles(ctx.recordingRowId, payload);
  await fetchAndSaveParticipants(ctx.recordingRowId);
  await fetchAndSaveAiSummary(ctx.recordingRowId);

  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { id: ctx.recordingRowId },
  });
  if (rec?.transcriptText && !rec.participantsExtracted) {
    try {
      const names = await extractParticipantsForHojoRecording({
        recordingId: ctx.recordingRowId,
      });
      if (names.length > 0) {
        await prisma.hojoContactHistory.update({
          where: { id: ctx.contactHistoryId },
          data: { customerParticipants: names.join(", ").slice(0, 500) },
        });
      }
    } catch (err) {
      await logAutomationError({
        source: "hojo-zoom-participants-extract",
        message: "先方参加者抽出失敗（続行）",
        detail: {
          error: err instanceof Error ? err.message : String(err),
          recordingId: ctx.recordingRowId,
        },
      });
    }
  }

  await finalizeRecordingState(ctx.recordingRowId);
}

// ============================================
// Webhook エントリポイント2: meeting.summary_completed
// ============================================
export async function processHojoMeetingSummaryCompleted(payload: {
  meetingId: bigint;
  meetingUuid: string;
}): Promise<void> {
  const ctx = await findExistingRecordingByMeetingId(payload.meetingId);
  if (!ctx) return;

  if (payload.meetingUuid) {
    await prisma.hojoZoomRecording.update({
      where: { id: ctx.recordingRowId },
      data: { zoomMeetingUuid: payload.meetingUuid },
    });
  }

  await fetchAndSaveAiSummary(ctx.recordingRowId);
}

// ============================================
// HOJO Zoom recording が存在するかチェック（Webhook振り分け用）
// ============================================
export async function hojoZoomRecordingExists(meetingId: bigint): Promise<boolean> {
  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { zoomMeetingId: meetingId },
    select: { id: true },
  });
  return !!rec;
}
