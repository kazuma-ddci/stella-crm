import { prisma } from "@/lib/prisma";
import type { ZoomRecordingPayload } from "@/lib/zoom/recording";
import { downloadZoomRecordingFiles } from "@/lib/zoom/recording";
import {
  deleteZoomRecording,
  getZoomMeetingSummary,
} from "@/lib/zoom/meeting";
import { getCustomerTypeIdByCode } from "@/lib/customer-type";
import { logAutomationError } from "@/lib/automation-error";
import { extractParticipantsForRecording } from "./zoom-ai";

// 接触種別名（seed済み）
const CATEGORY_NAME_BRIEFING = "概要案内";
const CATEGORY_NAME_CONSULTATION = "導入希望商談";
const CONTACT_METHOD_NAME_WEB_MEETING = "Web会議";

/**
 * recording.completed / recording.transcript_completed Webhook 受信時に呼ばれる処理。
 * 1. meeting_id で該当のSlpCompanyRecord（briefing/consultation）を特定
 * 2. 既存 SlpZoomRecording があれば update、無ければ create
 * 3. SlpContactHistory を新規作成（まだなければ）
 * 4. mp4/vttをVPSに保存、transcriptTextを格納
 * 5. Zoom AI Companion要約を取得
 * 6. 成功すればZoom側のクラウド録画を削除
 */
export async function processZoomRecordingCompleted(
  payload: ZoomRecordingPayload
): Promise<void> {
  const meetingIdNum = typeof payload.id === "string" ? BigInt(payload.id) : BigInt(payload.id);

  // 該当SlpCompanyRecordを検索（briefing/consultationの両方を確認）
  const briefingRecord = await prisma.slpCompanyRecord.findFirst({
    where: { briefingZoomMeetingId: meetingIdNum },
    select: {
      id: true,
      companyName: true,
      briefingDate: true,
      briefingZoomHostStaffId: true,
      masterCompanyId: true,
    },
  });
  const consultationRecord = briefingRecord
    ? null
    : await prisma.slpCompanyRecord.findFirst({
        where: { consultationZoomMeetingId: meetingIdNum },
        select: {
          id: true,
          companyName: true,
          consultationDate: true,
          consultationZoomHostStaffId: true,
          masterCompanyId: true,
        },
      });

  if (!briefingRecord && !consultationRecord) {
    // CRM無関係の会議 → 何もしない（エラーログも不要）
    return;
  }

  const category: "briefing" | "consultation" = briefingRecord
    ? "briefing"
    : "consultation";
  const record = briefingRecord ?? consultationRecord!;
  const hostStaffId = (
    briefingRecord
      ? briefingRecord.briefingZoomHostStaffId
      : consultationRecord!.consultationZoomHostStaffId
  ) as number | null;
  const contactDate = (
    briefingRecord ? briefingRecord.briefingDate : consultationRecord!.consultationDate
  ) as Date | null;

  if (!hostStaffId) {
    await logAutomationError({
      source: "slp-zoom-recording-processor",
      message: `録画処理: hostStaffIdが未設定のため中断`,
      detail: {
        meetingId: meetingIdNum.toString(),
        companyRecordId: record.id,
        category,
      },
    });
    return;
  }

  // マスタID取得
  const categoryName =
    category === "briefing" ? CATEGORY_NAME_BRIEFING : CATEGORY_NAME_CONSULTATION;
  const contactCategory = await prisma.contactCategory.findFirst({
    where: { name: categoryName },
    select: { id: true },
  });
  const contactMethod = await prisma.contactMethod.findFirst({
    where: { name: CONTACT_METHOD_NAME_WEB_MEETING },
    select: { id: true },
  });
  const slpCompanyCustomerTypeId = await getCustomerTypeIdByCode(
    "slp_company"
  );

  // SlpContactHistory + SlpZoomRecording をトランザクションで作成/更新
  const existing = await prisma.slpZoomRecording.findFirst({
    where: { zoomMeetingId: meetingIdNum },
    include: { contactHistory: true },
  });

  const contactHistoryId = existing
    ? existing.contactHistoryId
    : await createContactHistoryForZoom({
        companyRecordId: record.id,
        masterCompanyId: record.masterCompanyId,
        staffId: hostStaffId,
        contactDate: contactDate ?? new Date(),
        contactMethodId: contactMethod?.id ?? null,
        contactCategoryId: contactCategory?.id ?? null,
        customerTypeId: slpCompanyCustomerTypeId,
      });

  // Zoom AI Companion 要約取得（任意・失敗しても続行）
  let aiCompanionSummary: string | null = null;
  try {
    aiCompanionSummary = await getZoomMeetingSummary({
      hostStaffId,
      meetingUuid: payload.uuid,
    });
  } catch (err) {
    await logAutomationError({
      source: "slp-zoom-ai-companion-summary",
      message: "Zoom AI Companion要約取得失敗（続行）",
      detail: {
        error: err instanceof Error ? err.message : String(err),
        meetingId: meetingIdNum.toString(),
      },
    });
  }

  // 録画DL（時間がかかるので丁寧に）
  let downloaded: Awaited<
    ReturnType<typeof downloadZoomRecordingFiles>
  > | null = null;
  try {
    downloaded = await downloadZoomRecordingFiles({
      hostStaffId,
      contactHistoryId,
      recording: payload,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logAutomationError({
      source: "slp-zoom-recording-download",
      message: `録画DL失敗: ${msg}`,
      detail: {
        meetingId: meetingIdNum.toString(),
        contactHistoryId,
      },
    });
    // DL失敗してもレコードは作る（後で手動リトライできるように）
  }

  // SlpZoomRecording作成/更新（後続処理で使うため id を必ず取る）
  let recordingRowId: number;
  if (existing) {
    await prisma.slpZoomRecording.update({
      where: { id: existing.id },
      data: {
        mp4Path: downloaded?.mp4RelPath ?? existing.mp4Path,
        mp4SizeBytes:
          downloaded?.mp4Size !== undefined && downloaded?.mp4Size !== null
            ? BigInt(downloaded.mp4Size)
            : existing.mp4SizeBytes,
        transcriptPath: downloaded?.transcriptRelPath ?? existing.transcriptPath,
        transcriptText: downloaded?.transcriptText ?? existing.transcriptText,
        aiCompanionSummary: aiCompanionSummary ?? existing.aiCompanionSummary,
        aiCompanionFetchedAt: aiCompanionSummary ? new Date() : existing.aiCompanionFetchedAt,
        downloadStatus: downloaded ? "completed" : "failed",
        downloadError: downloaded ? null : "録画DL失敗（ログ参照）",
      },
    });
    recordingRowId = existing.id;
  } else {
    const created = await prisma.slpZoomRecording.create({
      data: {
        contactHistoryId,
        zoomMeetingId: meetingIdNum,
        zoomMeetingUuid: payload.uuid ?? null,
        category,
        hostStaffId,
        recordingStartAt: payload.recording_files[0]?.recording_start
          ? new Date(payload.recording_files[0].recording_start)
          : null,
        recordingEndAt: payload.recording_files[0]?.recording_end
          ? new Date(payload.recording_files[0].recording_end)
          : null,
        mp4Path: downloaded?.mp4RelPath ?? null,
        mp4SizeBytes:
          downloaded?.mp4Size !== undefined && downloaded?.mp4Size !== null
            ? BigInt(downloaded.mp4Size)
            : null,
        transcriptPath: downloaded?.transcriptRelPath ?? null,
        transcriptText: downloaded?.transcriptText ?? null,
        aiCompanionSummary,
        aiCompanionFetchedAt: aiCompanionSummary ? new Date() : null,
        downloadStatus: downloaded ? "completed" : "failed",
        downloadError: downloaded ? null : "録画DL失敗（ログ参照）",
      },
    });
    recordingRowId = created.id;
  }

  // 添付ファイルとしてSlpContactHistoryFileを作成（mp4/vtt）。
  // SlpContactHistoryFile にユニーク制約がないので findFirst + create パターンで重複を回避。
  if (downloaded?.mp4RelPath) {
    const existsMp4 = await prisma.slpContactHistoryFile.findFirst({
      where: { contactHistoryId, fileName: "商談録画.mp4" },
    });
    if (!existsMp4) {
      await prisma.slpContactHistoryFile.create({
        data: {
          contactHistoryId,
          fileName: "商談録画.mp4",
          filePath: downloaded.mp4RelPath,
          fileSize: downloaded.mp4Size,
          mimeType: "video/mp4",
        },
      });
    }
  }
  if (downloaded?.transcriptRelPath) {
    const existsTxt = await prisma.slpContactHistoryFile.findFirst({
      where: { contactHistoryId, fileName: "文字起こし.vtt" },
    });
    if (!existsTxt) {
      await prisma.slpContactHistoryFile.create({
        data: {
          contactHistoryId,
          fileName: "文字起こし.vtt",
          filePath: downloaded.transcriptRelPath,
          mimeType: "text/vtt",
        },
      });
    }
  }

  // 議事録本文初期化: Zoom AI要約があれば入れる、無ければ文字起こし先頭を使う
  if (aiCompanionSummary || downloaded?.transcriptText) {
    const ch = await prisma.slpContactHistory.findUnique({
      where: { id: contactHistoryId },
      select: { meetingMinutes: true },
    });
    if (ch && (!ch.meetingMinutes || ch.meetingMinutes.trim().length === 0)) {
      await prisma.slpContactHistory.update({
        where: { id: contactHistoryId },
        data: {
          meetingMinutes:
            aiCompanionSummary ??
            (downloaded?.transcriptText ?? "").slice(0, 10000),
        },
      });
    }
  }

  // 先方参加者をAIで抽出して SlpContactHistory.customerParticipants に格納
  if (downloaded?.transcriptText) {
    try {
      const names = await extractParticipantsForRecording({
        recordingId: recordingRowId,
      });
      if (names.length > 0) {
        await prisma.slpContactHistory.update({
          where: { id: contactHistoryId },
          data: { customerParticipants: names.join(", ").slice(0, 500) },
        });
      }
    } catch (err) {
      await logAutomationError({
        source: "slp-zoom-participants-extract",
        message: "先方参加者抽出失敗（続行）",
        detail: {
          error: err instanceof Error ? err.message : String(err),
          recordingId: recordingRowId,
        },
      });
    }
  }

  // Zoom側クラウド録画を削除（成功時のみ）
  if (downloaded?.mp4RelPath) {
    try {
      await deleteZoomRecording({
        hostStaffId,
        meetingId: payload.uuid || meetingIdNum,
        action: "delete",
      });
      await prisma.slpZoomRecording.update({
        where: { id: recordingRowId },
        data: { zoomCloudDeletedAt: new Date() },
      });
    } catch (err) {
      await logAutomationError({
        source: "slp-zoom-recording-delete",
        message: "Zoom側録画削除失敗（VPS保存はOK、手動で削除してください）",
        detail: {
          error: err instanceof Error ? err.message : String(err),
          meetingId: meetingIdNum.toString(),
        },
      });
    }
  }
}

async function createContactHistoryForZoom(params: {
  companyRecordId: number;
  masterCompanyId: number | null;
  staffId: number;
  contactDate: Date;
  contactMethodId: number | null;
  contactCategoryId: number | null;
  customerTypeId: number | null;
}): Promise<number> {
  const history = await prisma.slpContactHistory.create({
    data: {
      contactDate: params.contactDate,
      contactMethodId: params.contactMethodId,
      contactCategoryId: params.contactCategoryId,
      assignedTo: String(params.staffId),
      staffId: params.staffId,
      targetType: "company_record",
      companyRecordId: params.companyRecordId,
      masterCompanyId: params.masterCompanyId,
    },
  });
  if (params.customerTypeId) {
    await prisma.slpContactHistoryTag.create({
      data: {
        contactHistoryId: history.id,
        customerTypeId: params.customerTypeId,
      },
    });
  }
  return history.id;
}
