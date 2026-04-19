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
import { extractParticipantsForRecording } from "./zoom-ai";
import { appendRecordingMinutes } from "./slp-meeting-minutes";

// ============================================
// 型定義
// ============================================

type RecordingContext = {
  recordingRowId: number;
  contactHistoryId: number;
  category: "briefing" | "consultation";
  hostStaffId: number;
  meetingId: bigint;
  meetingUuid: string | null;
};

// ============================================
// meeting_id で既存Recording を探す（CRM無関係の会議はスキップ用）
//
// 新構造では Zoom URL発行・手動追加の時点で Recording が作成されるため、
// Webhook 到着時は必ず既存レコードが見つかる想定。見つからない＝CRM管理外の会議。
// ============================================

async function findExistingRecordingByMeetingId(
  meetingId: bigint
): Promise<RecordingContext | null> {
  const existing = await prisma.slpZoomRecording.findUnique({
    where: { zoomMeetingId: meetingId },
  });
  if (!existing) return null;

  return {
    recordingRowId: existing.id,
    contactHistoryId: existing.contactHistoryId,
    category: existing.category as "briefing" | "consultation",
    hostStaffId: existing.hostStaffId ?? 0,
    meetingId: existing.zoomMeetingId,
    meetingUuid: existing.zoomMeetingUuid,
  };
}

// ============================================
// AI Companion 要約取得 + DB保存
// ============================================

export async function fetchAndSaveAiSummary(
  recordingRowId: number
): Promise<{ ok: boolean; updated: boolean }> {
  const rec = await prisma.slpZoomRecording.findUnique({
    where: { id: recordingRowId },
    include: { contactHistory: true },
  });
  if (!rec) return { ok: false, updated: false };
  if (!rec.hostStaffId || !rec.zoomMeetingUuid) {
    return { ok: false, updated: false };
  }
  // 既に取得済みかつ next_steps もある → スキップ
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
      source: "slp-zoom-ai-companion-summary",
      message: "AI Companion要約取得失敗",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, updated: false };
  }

  // 取得試行は常に記録（要約が生成されない会議でも UI で「試行済み」と判別するため）
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

  await prisma.slpZoomRecording.update({
    where: { id: recordingRowId },
    data: updates,
  });
  if (!changed) return { ok: true, updated: false };

  // 議事録を区切り線付きで接触履歴に追記（AI要約優先、二重追記は minutesAppendedAt で防止）
  await appendRecordingMinutes({ recordingId: recordingRowId });

  return { ok: true, updated: true };
}

// ============================================
// 録画ファイル DL + DB保存
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
  const rec = await prisma.slpZoomRecording.findUnique({
    where: { id: recordingRowId },
  });
  if (!rec) return { ok: false, mp4: false, transcript: false, chat: false };
  if (!rec.hostStaffId) {
    return { ok: false, mp4: false, transcript: false, chat: false };
  }

  // payload無ければZoom APIから取得
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
        source: "slp-zoom-recording-metadata",
        message: "録画メタデータ取得失敗",
        detail: {
          recordingId: recordingRowId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
  if (!recordingPayload) {
    // Zoom側に録画が存在しない/削除済み → "no_recording" 確定状態に
    await prisma.slpZoomRecording.update({
      where: { id: recordingRowId },
      data: {
        downloadStatus: "no_recording",
        downloadError: "Zoom側に録画が存在しないか削除済みです",
        chatFetchedAt: rec.chatFetchedAt ?? new Date(),
      },
    });
    return { ok: false, mp4: false, transcript: false, chat: false };
  }

  // payload から取得した UUID を DB に保存（未保存の場合）
  // AI要約・参加者取得は UUID が必要なので、ここで埋めておくと後続処理が動くようになる
  const progressData: {
    downloadStatus: string;
    zoomMeetingUuid?: string;
  } = {
    downloadStatus: "in_progress",
  };
  if (recordingPayload.uuid && !rec.zoomMeetingUuid) {
    progressData.zoomMeetingUuid = recordingPayload.uuid;
  }
  await prisma.slpZoomRecording.update({
    where: { id: recordingRowId },
    data: progressData,
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
    await prisma.slpZoomRecording.update({
      where: { id: recordingRowId },
      data: {
        downloadStatus: "failed",
        downloadError: err instanceof Error ? err.message : String(err),
      },
    });
    await logAutomationError({
      source: "slp-zoom-recording-download",
      message: "録画DL失敗",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, mp4: false, transcript: false, chat: false };
  }

  // DB更新（チャット試行は録画ファイル一覧に CHAT が無くても「試行済み」として記録）
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

  // 録画開始・終了時刻を recording_files の各ファイルから抽出
  // （複数ファイルがある場合は最小startと最大endを全体の録画時間とみなす）
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

  // payload に MP4 が含まれていれば（DL試行した）成功扱い、含まれない時は会議仕様（音声のみ等）として completed 扱い
  const payloadHasMp4 = recordingPayload.recording_files.some(
    (f) => f.file_type === "MP4"
  );
  let finalStatus: string;
  if (payloadHasMp4) {
    finalStatus = mp4Saved || rec.mp4Path ? "completed" : "failed";
  } else {
    // MP4 が無い会議（音声のみ等）→ DL試行は完了
    finalStatus = "completed";
  }
  updates.downloadStatus = finalStatus;
  updates.downloadError = null;

  await prisma.slpZoomRecording.update({
    where: { id: recordingRowId },
    data: updates,
  });

  // 添付ファイル登録（contact_history_files）
  // マルチZoom対応: 同じ接触履歴内で複数Recordingがあると表示名が衝突するため、
  // 非primary（追加Zoom）にはラベル/IDを付与して一意化。また、存在チェックは
  // filePath（Recording毎に一意）で行い、別Recordingのファイル登録を阻害しない。
  const suffix = rec.isPrimary
    ? ""
    : rec.label
      ? `（${rec.label}）`
      : `（Zoom #${rec.id}）`;
  if (mp4Saved && downloaded.mp4RelPath) {
    const exists = await prisma.slpContactHistoryFile.findFirst({
      where: { filePath: downloaded.mp4RelPath },
    });
    if (!exists) {
      await prisma.slpContactHistoryFile.create({
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
    const exists = await prisma.slpContactHistoryFile.findFirst({
      where: { filePath: downloaded.transcriptRelPath },
    });
    if (!exists) {
      await prisma.slpContactHistoryFile.create({
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
    const exists = await prisma.slpContactHistoryFile.findFirst({
      where: { filePath: downloaded.chatRelPath },
    });
    if (!exists) {
      await prisma.slpContactHistoryFile.create({
        data: {
          contactHistoryId: rec.contactHistoryId,
          fileName: `チャットログ${suffix}.txt`,
          mimeType: "text/plain",
          filePath: downloaded.chatRelPath,
        },
      });
    }
  }

  // 議事録を区切り線付きで接触履歴に追記（文字起こしも対象、AI要約が優先される）
  // 二重追記は minutesAppendedAt で防止
  if (transcriptSaved) {
    await appendRecordingMinutes({ recordingId: recordingRowId });
  }

  // Zoom側の録画ファイルを削除（DL成功分のみ）
  await deleteFetchedZoomFiles(recordingPayload, rec.hostStaffId, rec.zoomMeetingId, rec.zoomMeetingUuid, downloaded);

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
        source: "slp-zoom-recording-file-delete",
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
    const r = await prisma.slpZoomRecording.findUnique({
      where: { zoomMeetingId: meetingId },
      select: { id: true },
    });
    if (r) {
      await prisma.slpZoomRecording.update({
        where: { id: r.id },
        data: { zoomCloudDeletedAt: new Date() },
      });
    }
  }
  // 不要パラメータ警告抑制
  void payload;
}

// ============================================
// 参加者情報の取得 + DB保存
// ============================================

export async function fetchAndSaveParticipants(
  recordingRowId: number
): Promise<{ ok: boolean; count: number }> {
  const rec = await prisma.slpZoomRecording.findUnique({
    where: { id: recordingRowId },
  });
  if (!rec) return { ok: false, count: 0 };
  if (!rec.hostStaffId || !rec.zoomMeetingUuid) {
    return { ok: false, count: 0 };
  }
  if (rec.participantsFetchedAt) {
    // 既取得 → スキップ
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
      source: "slp-zoom-participants-fetch",
      message: "参加者情報取得失敗",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { ok: false, count: 0 };
  }

  await prisma.slpZoomRecording.update({
    where: { id: recordingRowId },
    data: {
      participantsJson: JSON.stringify(participants),
      participantsFetchedAt: new Date(),
    },
  });

  return { ok: true, count: participants.length };
}

// ============================================
// 全部まとめて取得（手動取得ボタンから呼ばれる）
// ============================================

export async function fetchAllForRecording(recordingRowId: number): Promise<{
  aiSummary: { ok: boolean; updated: boolean };
  files: { ok: boolean; mp4: boolean; transcript: boolean; chat: boolean };
  participants: { ok: boolean; count: number };
  participantsAi: { ok: boolean; count: number };
  state: string;
}> {
  // Recording を取得中状態に変更
  await prisma.slpZoomRecording.update({
    where: { id: recordingRowId },
    data: { state: "取得中" },
  });

  try {
    // 1. 録画ファイル（重い）を先に実施
    //    - この過程で payload から zoomMeetingUuid を DB に保存する
    //    - 後続の AI要約・参加者取得は UUID が必須のため、これが先でないと動かない
    //      （Webhook経由の場合は summary_completed が先に UUID を埋めることもある）
    const files = await downloadAndSaveRecordingFiles(recordingRowId);

    // 2. AI 要約（UUID 必須）
    const aiSummary = await fetchAndSaveAiSummary(recordingRowId);

    // 3. 参加者情報（UUID 必須）
    const participants = await fetchAndSaveParticipants(recordingRowId);

    // 4. AI による先方参加者抽出（transcript があれば）
    let participantsAi = { ok: false, count: 0 };
    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingRowId },
      include: { contactHistory: true },
    });
    if (rec?.transcriptText && !rec.participantsExtracted) {
      try {
        const names = await extractParticipantsForRecording({
          recordingId: recordingRowId,
        });
        if (names.length > 0 && rec.contactHistory) {
          await prisma.slpContactHistory.update({
            where: { id: rec.contactHistoryId },
            data: { customerParticipants: names.join(", ").slice(0, 500) },
          });
        }
        participantsAi = { ok: true, count: names.length };
      } catch (err) {
        await logAutomationError({
          source: "slp-zoom-participants-extract",
          message: "先方参加者抽出失敗",
          detail: {
            recordingId: recordingRowId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    // 実データに基づいて state を確定
    const newState = await finalizeRecordingState(recordingRowId);

    return { aiSummary, files, participants, participantsAi, state: newState };
  } catch (err) {
    // 想定外の例外（DB断等）で state が「取得中」のまま残らないよう finalize で回復
    await logAutomationError({
      source: "slp-zoom-fetch-all",
      message: "fetchAllForRecording で想定外の例外",
      detail: {
        recordingId: recordingRowId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    try {
      await finalizeRecordingState(recordingRowId);
    } catch {
      // finalize にも失敗した場合、せめて "失敗" に落とす
      await prisma.slpZoomRecording
        .update({ where: { id: recordingRowId }, data: { state: "失敗" } })
        .catch(() => {});
    }
    throw err;
  }
}

// ============================================
// Recording の state を実データに基づいて確定する
//   - 取得データが1つでもあれば "完了"
//   - downloadStatus が "no_recording" のみ + 取得データなし → "予定"
//   - downloadStatus が "failed" のみ + 取得データなし → "失敗"
//   - その他は "完了" 扱い（ベースラインとして）
// ============================================
async function finalizeRecordingState(recordingRowId: number): Promise<"予定" | "完了" | "失敗"> {
  const rec = await prisma.slpZoomRecording.findUnique({
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

  // 会議終了時刻からの経過時間を計算（6時間以上なら、Zoom側の処理は完了済みと推定）
  // 優先順位: recordingEndAt > scheduledAt > createdAt
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
    // データは無いが会議終了から6時間以上経過 → 会議は実施済みとみなして「完了」
    // （データ取得失敗 ≠ 会議未実施 のため、時間経過で推定）
    // もし実際には会議が実施されなかった場合は、スタッフが手動で「予定」に戻す想定
    newState = "完了";
  } else {
    // まだ Zoom 側で処理中の可能性がある → 予定 のまま
    newState = "予定";
  }

  await prisma.slpZoomRecording.update({
    where: { id: recordingRowId },
    data: { state: newState },
  });
  return newState;
}

// ============================================
// Webhook エントリポイント1: recording.completed / recording.transcript_completed
//
// 新構造: 対象 Recording は Zoom発行・手動追加時点で既に作成済み（state="予定"）。
// 該当 meeting_id の Recording が見つからない = CRM無関係の会議としてスルー。
// ============================================

export async function processZoomRecordingCompleted(
  payload: ZoomRecordingPayload
): Promise<void> {
  const meetingIdNum =
    typeof payload.id === "string" ? BigInt(payload.id) : BigInt(payload.id);

  const ctx = await findExistingRecordingByMeetingId(meetingIdNum);
  if (!ctx) {
    // CRM無関係の会議 → 黙ってスルー
    return;
  }

  // meeting_uuid 反映
  if (payload.uuid && !ctx.meetingUuid) {
    await prisma.slpZoomRecording.update({
      where: { id: ctx.recordingRowId },
      data: { zoomMeetingUuid: payload.uuid },
    });
  }

  // recording.completed の payload には全ファイル情報があるので渡す
  await downloadAndSaveRecordingFiles(ctx.recordingRowId, payload);
  // 参加者情報取得
  await fetchAndSaveParticipants(ctx.recordingRowId);
  // AI 要約も取りに行く（既に取得済なら no-op）
  await fetchAndSaveAiSummary(ctx.recordingRowId);

  // 先方参加者AI抽出（transcript が今回取れた場合のみ意味あり）
  const rec = await prisma.slpZoomRecording.findUnique({
    where: { id: ctx.recordingRowId },
  });
  if (rec?.transcriptText && !rec.participantsExtracted) {
    try {
      const names = await extractParticipantsForRecording({
        recordingId: ctx.recordingRowId,
      });
      if (names.length > 0) {
        await prisma.slpContactHistory.update({
          where: { id: ctx.contactHistoryId },
          data: { customerParticipants: names.join(", ").slice(0, 500) },
        });
      }
    } catch (err) {
      await logAutomationError({
        source: "slp-zoom-participants-extract",
        message: "先方参加者抽出失敗（続行）",
        detail: {
          error: err instanceof Error ? err.message : String(err),
          recordingId: ctx.recordingRowId,
        },
      });
    }
  }

  // 取得処理が一通り完了したら実データに基づいて state 確定
  await finalizeRecordingState(ctx.recordingRowId);
}

// ============================================
// Webhook エントリポイント2: meeting.summary_completed
// AI Companion 要約が出来た時点（数分後）に呼ばれる。
// 新構造: 対象 Recording は発行/手動追加時点で既に作成済み。見つからなければスルー。
// ============================================

export async function processMeetingSummaryCompleted(payload: {
  meetingId: bigint;
  meetingUuid: string;
}): Promise<void> {
  const ctx = await findExistingRecordingByMeetingId(payload.meetingId);
  if (!ctx) return;

  // meeting_uuid を反映（後で参加者取得・録画削除に必要）
  if (payload.meetingUuid) {
    await prisma.slpZoomRecording.update({
      where: { id: ctx.recordingRowId },
      data: { zoomMeetingUuid: payload.meetingUuid },
    });
  }

  // 要約のみ取得して保存
  await fetchAndSaveAiSummary(ctx.recordingRowId);
}
