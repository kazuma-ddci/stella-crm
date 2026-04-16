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
import { getCustomerTypeIdByCode } from "@/lib/customer-type";
import { logAutomationError } from "@/lib/automation-error";
import { extractParticipantsForRecording } from "./zoom-ai";

// 接触種別名（seed済み）
const CATEGORY_NAME_BRIEFING = "概要案内";
const CATEGORY_NAME_CONSULTATION = "導入希望商談";
const CONTACT_METHOD_NAME_WEB_MEETING = "Web会議";

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
  companyRecordId: number;
  companyName: string | null;
  contactDate: Date | null;
};

type CompanyMatch = {
  category: "briefing" | "consultation";
  companyRecordId: number;
  companyName: string | null;
  hostStaffId: number | null;
  contactDate: Date | null;
  masterCompanyId: number | null;
};

// ============================================
// SlpCompanyRecord 検索（meeting_id で briefing/consultation を判別）
// ============================================

async function findCompanyByMeetingId(
  meetingId: bigint
): Promise<CompanyMatch | null> {
  const briefingRecord = await prisma.slpCompanyRecord.findFirst({
    where: { briefingZoomMeetingId: meetingId },
    select: {
      id: true,
      companyName: true,
      briefingDate: true,
      briefingZoomHostStaffId: true,
      masterCompanyId: true,
    },
  });
  if (briefingRecord) {
    return {
      category: "briefing",
      companyRecordId: briefingRecord.id,
      companyName: briefingRecord.companyName,
      hostStaffId: briefingRecord.briefingZoomHostStaffId,
      contactDate: briefingRecord.briefingDate,
      masterCompanyId: briefingRecord.masterCompanyId,
    };
  }
  const consultationRecord = await prisma.slpCompanyRecord.findFirst({
    where: { consultationZoomMeetingId: meetingId },
    select: {
      id: true,
      companyName: true,
      consultationDate: true,
      consultationZoomHostStaffId: true,
      masterCompanyId: true,
    },
  });
  if (consultationRecord) {
    return {
      category: "consultation",
      companyRecordId: consultationRecord.id,
      companyName: consultationRecord.companyName,
      hostStaffId: consultationRecord.consultationZoomHostStaffId,
      contactDate: consultationRecord.consultationDate,
      masterCompanyId: consultationRecord.masterCompanyId,
    };
  }
  return null;
}

// ============================================
// 接触履歴 + Zoom録画レコードの作成（既存があれば返すだけ）
// 同時呼び出し時の race を unique制約 (zoomMeetingId) で防ぐ
// ============================================

async function ensureRecordingRow(params: {
  meetingId: bigint;
  meetingUuid: string | null;
  companyMatch: CompanyMatch;
}): Promise<RecordingContext | null> {
  // 既存のSlpZoomRecordingがあればそれを返す
  const existing = await prisma.slpZoomRecording.findUnique({
    where: { zoomMeetingId: params.meetingId },
  });
  if (existing) {
    return {
      recordingRowId: existing.id,
      contactHistoryId: existing.contactHistoryId,
      category: existing.category as "briefing" | "consultation",
      hostStaffId: existing.hostStaffId ?? params.companyMatch.hostStaffId ?? 0,
      meetingId: existing.zoomMeetingId,
      meetingUuid: existing.zoomMeetingUuid ?? params.meetingUuid,
      companyRecordId: params.companyMatch.companyRecordId,
      companyName: params.companyMatch.companyName,
      contactDate: params.companyMatch.contactDate,
    };
  }

  // 新規作成
  if (!params.companyMatch.hostStaffId) {
    await logAutomationError({
      source: "slp-zoom-recording-processor",
      message: "録画処理: hostStaffIdが未設定のため中断",
      detail: {
        meetingId: params.meetingId.toString(),
        companyRecordId: params.companyMatch.companyRecordId,
        category: params.companyMatch.category,
      },
    });
    return null;
  }

  // 接触種別・接触方法マスタ
  const categoryName =
    params.companyMatch.category === "briefing"
      ? CATEGORY_NAME_BRIEFING
      : CATEGORY_NAME_CONSULTATION;
  const contactCategory = await prisma.contactCategory.findFirst({
    where: { name: categoryName },
    select: { id: true },
  });
  const contactMethod = await prisma.contactMethod.findFirst({
    where: { name: CONTACT_METHOD_NAME_WEB_MEETING },
    select: { id: true },
  });
  const slpCompanyCustomerTypeId = await getCustomerTypeIdByCode("slp_company");

  // SlpContactHistory を作成
  const history = await prisma.slpContactHistory.create({
    data: {
      contactDate: params.companyMatch.contactDate ?? new Date(),
      contactMethodId: contactMethod?.id ?? null,
      contactCategoryId: contactCategory?.id ?? null,
      assignedTo: String(params.companyMatch.hostStaffId),
      staffId: params.companyMatch.hostStaffId,
      targetType: "company_record",
      companyRecordId: params.companyMatch.companyRecordId,
      masterCompanyId: params.companyMatch.masterCompanyId,
    },
  });
  if (slpCompanyCustomerTypeId) {
    await prisma.slpContactHistoryTag.create({
      data: {
        contactHistoryId: history.id,
        customerTypeId: slpCompanyCustomerTypeId,
      },
    });
  }

  // SlpZoomRecording を作成（unique zoomMeetingId で race時に最初の1件のみ成功）
  let recording;
  try {
    recording = await prisma.slpZoomRecording.create({
      data: {
        contactHistoryId: history.id,
        zoomMeetingId: params.meetingId,
        zoomMeetingUuid: params.meetingUuid,
        category: params.companyMatch.category,
        hostStaffId: params.companyMatch.hostStaffId,
        downloadStatus: "pending",
      },
    });
  } catch {
    // race で別実行が先に作成した → 既存を取得 + 孤児となる history を削除
    const existing2 = await prisma.slpZoomRecording.findUnique({
      where: { zoomMeetingId: params.meetingId },
    });
    if (!existing2) throw new Error("SlpZoomRecording作成race解決失敗");
    // 自分が作った history (まだ recording に紐付かず orphan) を削除
    // tag は SlpContactHistoryTag に onDelete: Cascade があるので一緒に消える
    try {
      await prisma.slpContactHistory.delete({ where: { id: history.id } });
    } catch {
      // 削除失敗は無視（誰かが既に拾っているケースは稀）
    }
    return {
      recordingRowId: existing2.id,
      contactHistoryId: existing2.contactHistoryId,
      category: existing2.category as "briefing" | "consultation",
      hostStaffId: existing2.hostStaffId ?? params.companyMatch.hostStaffId,
      meetingId: existing2.zoomMeetingId,
      meetingUuid: existing2.zoomMeetingUuid ?? params.meetingUuid,
      companyRecordId: params.companyMatch.companyRecordId,
      companyName: params.companyMatch.companyName,
      contactDate: params.companyMatch.contactDate,
    };
  }

  return {
    recordingRowId: recording.id,
    contactHistoryId: history.id,
    category: params.companyMatch.category,
    hostStaffId: params.companyMatch.hostStaffId,
    meetingId: params.meetingId,
    meetingUuid: params.meetingUuid,
    companyRecordId: params.companyMatch.companyRecordId,
    companyName: params.companyMatch.companyName,
    contactDate: params.companyMatch.contactDate,
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

  // meetingMinutes に未入力なら反映
  if (
    rec.contactHistory &&
    (!rec.contactHistory.meetingMinutes ||
      rec.contactHistory.meetingMinutes.trim().length === 0) &&
    summaryResult.summaryText
  ) {
    await prisma.slpContactHistory.update({
      where: { id: rec.contactHistoryId },
      data: { meetingMinutes: summaryResult.summaryText },
    });
  }

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

  await prisma.slpZoomRecording.update({
    where: { id: recordingRowId },
    data: { downloadStatus: "in_progress" },
  });

  let downloaded;
  try {
    downloaded = await downloadZoomRecordingFiles({
      hostStaffId: rec.hostStaffId,
      contactHistoryId: rec.contactHistoryId,
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
  if (mp4Saved && downloaded.mp4RelPath) {
    const exists = await prisma.slpContactHistoryFile.findFirst({
      where: { contactHistoryId: rec.contactHistoryId, fileName: "商談録画.mp4" },
    });
    if (!exists) {
      await prisma.slpContactHistoryFile.create({
        data: {
          contactHistoryId: rec.contactHistoryId,
          fileName: "商談録画.mp4",
          filePath: downloaded.mp4RelPath,
          fileSize: downloaded.mp4Size,
          mimeType: "video/mp4",
        },
      });
    }
  }
  if (transcriptSaved && downloaded.transcriptRelPath) {
    const exists = await prisma.slpContactHistoryFile.findFirst({
      where: { contactHistoryId: rec.contactHistoryId, fileName: "文字起こし.vtt" },
    });
    if (!exists) {
      await prisma.slpContactHistoryFile.create({
        data: {
          contactHistoryId: rec.contactHistoryId,
          fileName: "文字起こし.vtt",
          mimeType: "text/vtt",
          filePath: downloaded.transcriptRelPath,
        },
      });
    }
  }
  if (chatSaved && downloaded.chatRelPath) {
    const exists = await prisma.slpContactHistoryFile.findFirst({
      where: { contactHistoryId: rec.contactHistoryId, fileName: "チャットログ.txt" },
    });
    if (!exists) {
      await prisma.slpContactHistoryFile.create({
        data: {
          contactHistoryId: rec.contactHistoryId,
          fileName: "チャットログ.txt",
          mimeType: "text/plain",
          filePath: downloaded.chatRelPath,
        },
      });
    }
  }

  // meetingMinutes が空で transcript が取れていれば、フォールバックとして transcript 先頭を使う
  if (transcriptSaved && downloaded.transcriptText) {
    const ch = await prisma.slpContactHistory.findUnique({
      where: { id: rec.contactHistoryId },
      select: { meetingMinutes: true },
    });
    if (ch && (!ch.meetingMinutes || ch.meetingMinutes.trim().length === 0)) {
      await prisma.slpContactHistory.update({
        where: { id: rec.contactHistoryId },
        data: { meetingMinutes: downloaded.transcriptText.slice(0, 10000) },
      });
    }
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
}> {
  // 1. AI 要約（軽い・先に実施）
  const aiSummary = await fetchAndSaveAiSummary(recordingRowId);

  // 2. 録画ファイル（重い）
  const files = await downloadAndSaveRecordingFiles(recordingRowId);

  // 3. 参加者情報
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

  return { aiSummary, files, participants, participantsAi };
}

// ============================================
// Webhook エントリポイント1: recording.completed / recording.transcript_completed
// 録画ファイルが届いた段階で、ファイルDL + 参加者取得 + AI要約取得を実行
// ============================================

export async function processZoomRecordingCompleted(
  payload: ZoomRecordingPayload
): Promise<void> {
  const meetingIdNum =
    typeof payload.id === "string" ? BigInt(payload.id) : BigInt(payload.id);

  const companyMatch = await findCompanyByMeetingId(meetingIdNum);
  if (!companyMatch) {
    // CRM無関係の会議 → 黙ってスルー
    return;
  }

  const ctx = await ensureRecordingRow({
    meetingId: meetingIdNum,
    meetingUuid: payload.uuid ?? null,
    companyMatch,
  });
  if (!ctx) return;

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
}

// ============================================
// Webhook エントリポイント2: meeting.summary_completed
// AI Companion 要約が出来た時点（数分後）に呼ばれる
// SlpContactHistory + SlpZoomRecording の stub を作って早期に議事録化
// ============================================

export async function processMeetingSummaryCompleted(payload: {
  meetingId: bigint;
  meetingUuid: string;
}): Promise<void> {
  const companyMatch = await findCompanyByMeetingId(payload.meetingId);
  if (!companyMatch) return;

  const ctx = await ensureRecordingRow({
    meetingId: payload.meetingId,
    meetingUuid: payload.meetingUuid,
    companyMatch,
  });
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
