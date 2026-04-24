import { prisma } from "@/lib/prisma";
import type { ZoomRecordingPayload } from "@/lib/zoom/recording";
import { downloadZoomRecordingFiles } from "@/lib/zoom/recording";
import {
  getZoomMeetingSummary,
  getPastMeetingParticipants,
} from "@/lib/zoom/meeting";
import { logAutomationError } from "@/lib/automation-error";

/**
 * V1 レコード (slpZoomRecording / hojoZoomRecording) を経由せず、V2
 * ContactHistoryMeeting に直接紐付いた録画・要約・参加者を書き込む processor。
 *
 * V2 フォームから発行された Zoom 会議 (V1 併走レコードを作らない場合) の
 * Webhook / 手動取得は、このモジュールが受け持つ。
 *
 * Webhook route 側の呼び出し順:
 *   1. V1 scope を探す → 見つかれば V1 processor + sync-from-v1 (既存経路)
 *   2. V1 scope が null の場合 → 本モジュールで V2 meeting を探して直接処理
 */

export type V2MeetingContext = {
  meetingRowId: number;
  contactHistoryId: number;
  hostStaffId: number | null;
  externalMeetingUuid: string | null;
};

export async function findV2MeetingByZoomId(
  meetingId: bigint,
): Promise<V2MeetingContext | null> {
  const m = await prisma.contactHistoryMeeting.findFirst({
    where: {
      provider: "zoom",
      externalMeetingId: meetingId.toString(),
      deletedAt: null,
    },
    select: {
      id: true,
      contactHistoryId: true,
      hostStaffId: true,
      externalMeetingUuid: true,
    },
  });
  if (!m) return null;
  return {
    meetingRowId: m.id,
    contactHistoryId: m.contactHistoryId,
    hostStaffId: m.hostStaffId,
    externalMeetingUuid: m.externalMeetingUuid,
  };
}

/**
 * recording.completed 相当。録画ファイル DL + AI要約 + 参加者取得 をまとめて実行。
 */
export async function processZoomRecordingForV2(
  payload: ZoomRecordingPayload,
): Promise<{ ok: boolean; found: boolean }> {
  const meetingIdBig =
    typeof payload.id === "string" ? BigInt(payload.id) : BigInt(payload.id);
  const ctx = await findV2MeetingByZoomId(meetingIdBig);
  if (!ctx) return { ok: false, found: false };
  if (!ctx.hostStaffId) {
    await prisma.contactHistoryMeeting.update({
      where: { id: ctx.meetingRowId },
      data: {
        apiError: "ホストスタッフが未設定のため録画取得できません",
        apiErrorAt: new Date(),
      },
    });
    return { ok: false, found: true };
  }

  // UUID メタ反映
  if (payload.uuid && !ctx.externalMeetingUuid) {
    await prisma.contactHistoryMeeting.update({
      where: { id: ctx.meetingRowId },
      data: { externalMeetingUuid: payload.uuid },
    });
    ctx.externalMeetingUuid = payload.uuid;
  }

  // MeetingRecord を in_progress で準備
  const existingRecord = await prisma.contactHistoryMeetingRecord.findUnique({
    where: { meetingId: ctx.meetingRowId },
  });
  const meetingRecordId = existingRecord
    ? existingRecord.id
    : (
        await prisma.contactHistoryMeetingRecord.create({
          data: { meetingId: ctx.meetingRowId, downloadStatus: "in_progress" },
          select: { id: true },
        })
      ).id;

  await prisma.contactHistoryMeeting.update({
    where: { id: ctx.meetingRowId },
    data: { state: "取得中" },
  });

  try {
    const downloaded = await downloadZoomRecordingFiles({
      hostStaffId: ctx.hostStaffId,
      contactHistoryId: ctx.contactHistoryId,
      recordingId: meetingRecordId,
      recording: payload,
      skipMp4: !!existingRecord?.recordingPath,
      skipTranscript: !!existingRecord?.transcriptText,
      skipChat: !!existingRecord?.chatLogText,
    });

    const starts: number[] = [];
    const ends: number[] = [];
    for (const f of payload.recording_files) {
      if (f.recording_start) {
        const t = new Date(f.recording_start);
        if (!isNaN(t.getTime())) starts.push(t.getTime());
      }
      if (f.recording_end) {
        const t = new Date(f.recording_end);
        if (!isNaN(t.getTime())) ends.push(t.getTime());
      }
    }

    const payloadHasMp4 = payload.recording_files.some(
      (f) => f.file_type === "MP4",
    );
    const finalStatus = payloadHasMp4
      ? downloaded.mp4RelPath || existingRecord?.recordingPath
        ? "completed"
        : "failed"
      : "completed";

    await prisma.contactHistoryMeetingRecord.update({
      where: { id: meetingRecordId },
      data: {
        recordingPath: downloaded.mp4RelPath ?? existingRecord?.recordingPath ?? null,
        recordingSizeBytes:
          downloaded.mp4Size != null
            ? BigInt(downloaded.mp4Size)
            : existingRecord?.recordingSizeBytes ?? null,
        transcriptText: downloaded.transcriptText ?? existingRecord?.transcriptText ?? null,
        chatLogText: downloaded.chatText ?? existingRecord?.chatLogText ?? null,
        recordingStartAt:
          starts.length > 0
            ? new Date(Math.min(...starts))
            : existingRecord?.recordingStartAt ?? null,
        recordingEndAt:
          ends.length > 0
            ? new Date(Math.max(...ends))
            : existingRecord?.recordingEndAt ?? null,
        downloadStatus: finalStatus,
        downloadError: null,
      },
    });

    const uuid = payload.uuid || ctx.externalMeetingUuid;
    if (uuid) {
      try {
        const participants = await getPastMeetingParticipants({
          hostStaffId: ctx.hostStaffId,
          meetingUuid: uuid,
        });
        await prisma.contactHistoryMeetingRecord.update({
          where: { id: meetingRecordId },
          data: { attendanceJson: participants as unknown as object },
        });
      } catch (err) {
        await logAutomationError({
          source: "contact-history-v2-zoom-participants",
          message: "V2 参加者取得失敗 (recording.completed)",
          detail: {
            meetingId: ctx.meetingRowId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }

      try {
        const summary = await getZoomMeetingSummary({
          hostStaffId: ctx.hostStaffId,
          meetingUuid: uuid,
        });
        if (summary.summaryText) {
          await saveZoomAiCompanionSummary({
            meetingRecordId,
            summaryText: summary.summaryText,
            nextSteps: summary.nextSteps ?? null,
          });
        }
      } catch (err) {
        await logAutomationError({
          source: "contact-history-v2-zoom-ai-companion",
          message: "V2 AI Companion要約取得失敗 (recording.completed)",
          detail: {
            meetingId: ctx.meetingRowId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    await finalizeV2MeetingState(ctx.meetingRowId, meetingRecordId);
    return { ok: true, found: true };
  } catch (err) {
    await prisma.contactHistoryMeetingRecord.update({
      where: { id: meetingRecordId },
      data: {
        downloadStatus: "failed",
        downloadError: err instanceof Error ? err.message : String(err),
      },
    });
    await prisma.contactHistoryMeeting.update({
      where: { id: ctx.meetingRowId },
      data: { state: "失敗" },
    });
    await logAutomationError({
      source: "contact-history-v2-zoom-recording",
      message: "V2 録画処理失敗",
      detail: {
        meetingId: ctx.meetingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, found: true };
  }
}

/**
 * meeting.summary_completed 相当。AI Companion要約のみ取得。
 */
export async function processMeetingSummaryForV2(payload: {
  meetingId: bigint;
  meetingUuid: string;
}): Promise<{ ok: boolean; found: boolean }> {
  const ctx = await findV2MeetingByZoomId(payload.meetingId);
  if (!ctx) return { ok: false, found: false };
  if (!ctx.hostStaffId) return { ok: false, found: true };

  if (payload.meetingUuid && !ctx.externalMeetingUuid) {
    await prisma.contactHistoryMeeting.update({
      where: { id: ctx.meetingRowId },
      data: { externalMeetingUuid: payload.meetingUuid },
    });
  }

  const meetingRecordId =
    (
      await prisma.contactHistoryMeetingRecord.findUnique({
        where: { meetingId: ctx.meetingRowId },
        select: { id: true },
      })
    )?.id ??
    (
      await prisma.contactHistoryMeetingRecord.create({
        data: { meetingId: ctx.meetingRowId, downloadStatus: "pending" },
        select: { id: true },
      })
    ).id;

  try {
    const summary = await getZoomMeetingSummary({
      hostStaffId: ctx.hostStaffId,
      meetingUuid: payload.meetingUuid,
    });
    if (summary.summaryText) {
      await saveZoomAiCompanionSummary({
        meetingRecordId,
        summaryText: summary.summaryText,
        nextSteps: summary.nextSteps ?? null,
      });
    }
    return { ok: true, found: true };
  } catch (err) {
    await logAutomationError({
      source: "contact-history-v2-zoom-summary",
      message: "V2 AI Companion要約取得失敗 (summary_completed)",
      detail: {
        meetingId: ctx.meetingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, found: true };
  }
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

async function saveZoomAiCompanionSummary(params: {
  meetingRecordId: number;
  summaryText: string;
  nextSteps: string | null;
}): Promise<void> {
  const combined = params.nextSteps
    ? `${params.summaryText}\n\n【ネクストステップ】\n${params.nextSteps}`
    : params.summaryText;

  const hasClaude = await prisma.meetingRecordSummary.findFirst({
    where: { meetingRecordId: params.meetingRecordId, source: "claude" },
    select: { id: true },
  });

  await prisma.meetingRecordSummary.upsert({
    where: {
      meetingRecordId_version: {
        meetingRecordId: params.meetingRecordId,
        version: 1,
      },
    },
    create: {
      meetingRecordId: params.meetingRecordId,
      version: 1,
      summaryText: combined,
      source: "zoom_ai_companion",
      model: null,
      promptSnapshot: null,
      generatedAt: new Date(),
      isCurrent: !hasClaude,
    },
    update: {
      summaryText: combined,
      generatedAt: new Date(),
      // 既存バージョンが Claude を isCurrent にしている場合は上書きしない
      ...(hasClaude ? {} : { isCurrent: true }),
    },
  });

  // MeetingRecord 側の「現行版キャッシュ」を更新 (Claude がいなければ)
  if (!hasClaude) {
    await prisma.contactHistoryMeetingRecord.update({
      where: { id: params.meetingRecordId },
      data: {
        aiSummary: combined,
        aiSummarySource: "zoom_ai_companion",
        aiSummaryGeneratedAt: new Date(),
      },
    });
  }
}

async function finalizeV2MeetingState(
  meetingRowId: number,
  meetingRecordId: number,
): Promise<void> {
  const rec = await prisma.contactHistoryMeetingRecord.findUnique({
    where: { id: meetingRecordId },
    select: {
      downloadStatus: true,
      transcriptText: true,
      recordingPath: true,
      chatLogText: true,
      aiSummary: true,
      attendanceJson: true,
    },
  });
  if (!rec) return;

  const hasAnyData =
    !!rec.transcriptText ||
    !!rec.recordingPath ||
    !!rec.chatLogText ||
    !!rec.aiSummary ||
    rec.attendanceJson !== null;

  const newState = hasAnyData
    ? "完了"
    : rec.downloadStatus === "failed"
      ? "失敗"
      : "予定";

  await prisma.contactHistoryMeeting.update({
    where: { id: meetingRowId },
    data: { state: newState },
  });
}
