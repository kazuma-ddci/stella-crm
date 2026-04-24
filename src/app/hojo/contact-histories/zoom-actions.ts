"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { parseZoomJoinUrl } from "@/lib/zoom/url-parser";
import { fetchAllForRecording } from "@/lib/hojo/zoom-recording-processor";
import { appendClaudeSummaryMinutesHojo } from "@/lib/hojo/hojo-meeting-minutes";
import { syncMeetingRecordFromV1 } from "@/lib/contact-history-v2/zoom/sync-from-v1";

// ============================================
// Zoom連携済みスタッフ一覧取得（ホスト選択プルダウン用）
// - HOJOプロジェクトに view 以上のスタッフ + StaffMeetingIntegration(zoom)済み
// ============================================
export async function listZoomLinkedStaffsForHojo(): Promise<
  ActionResult<{ id: number; name: string }[]>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
    const hojoProject = await prisma.masterProject.findFirst({
      where: { code: "hojo" },
      select: { id: true },
    });
    if (!hojoProject) return ok([]);

    const integrations = await prisma.staffMeetingIntegration.findMany({
      where: {
        provider: "zoom",
        disconnectedAt: null,
        staff: {
          isActive: true,
          isSystemUser: false,
          projectAssignments: { some: { projectId: hojoProject.id } },
        },
      },
      select: { staff: { select: { id: true, name: true } } },
      orderBy: { staff: { name: "asc" } },
    });

    return ok(
      integrations.map((i) => ({
        id: i.staff.id,
        name: i.staff.name,
      }))
    );
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Zoom連携スタッフの取得に失敗しました"
    );
  }
}

// ============================================
// HOJO全スタッフ一覧（Zoom連携済みフラグ付き）
// ============================================
export async function listAllHojoStaffsForZoomHost(): Promise<
  ActionResult<{ id: number; name: string; zoomIntegrated: boolean }[]>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
    const hojoProject = await prisma.masterProject.findFirst({
      where: { code: "hojo" },
      select: { id: true },
    });
    if (!hojoProject) return ok([]);

    const staffs = await prisma.masterStaff.findMany({
      where: {
        isActive: true,
        isSystemUser: false,
        projectAssignments: { some: { projectId: hojoProject.id } },
      },
      select: {
        id: true,
        name: true,
        meetingIntegrations: {
          where: { provider: "zoom", disconnectedAt: null },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return ok(
      staffs.map((s) => ({
        id: s.id,
        name: s.name,
        zoomIntegrated: s.meetingIntegrations.length > 0,
      }))
    );
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "スタッフ一覧の取得に失敗しました"
    );
  }
}

// ============================================
// 手動 Zoom URL 追加 → 議事録連携
// ============================================

type AddZoomResult = {
  recordingId: number;
  state: string;
  message?: string;
};

export async function addManualZoomToHojoContactHistory(params: {
  contactHistoryId: number;
  zoomUrl: string;
  hostStaffId: number | null;
  label?: string;
  mode: "fetch_now" | "scheduled";
}): Promise<ActionResult<AddZoomResult>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);

    const parsed = parseZoomJoinUrl(params.zoomUrl);
    if (!parsed.ok) {
      return err(parsed.error);
    }
    const meetingIdBig = BigInt(parsed.meetingId);

    const ch = await prisma.hojoContactHistory.findUnique({
      where: { id: params.contactHistoryId },
      select: { id: true, deletedAt: true },
    });
    if (!ch || ch.deletedAt) {
      return err("接触履歴が見つかりません");
    }

    // SLP / HOJO 両方の zoom_recordings で同一 meeting_id を検索
    const [existingHojo, existingSlp] = await Promise.all([
      prisma.hojoZoomRecording.findUnique({
        where: { zoomMeetingId: meetingIdBig },
        select: { id: true, contactHistoryId: true, deletedAt: true },
      }),
      prisma.slpZoomRecording.findUnique({
        where: { zoomMeetingId: meetingIdBig },
        select: { id: true },
      }),
    ]);
    if (existingHojo) {
      if (!existingHojo.deletedAt) {
        if (existingHojo.contactHistoryId === params.contactHistoryId) {
          return err("このZoom URLはこの接触履歴に既に登録されています");
        }
        return err(
          `このZoom URL（Meeting ID: ${parsed.meetingId}）は別の接触履歴 #${existingHojo.contactHistoryId} に既に登録されています`
        );
      }
      return err(
        `このZoom URL（Meeting ID: ${parsed.meetingId}）は以前に削除された記録があるため、同じ URL は再登録できません。別の会議URLを使用してください。`
      );
    }
    if (existingSlp) {
      return err(
        `このZoom URL（Meeting ID: ${parsed.meetingId}）はSLPの接触履歴に既に登録されています`
      );
    }

    let hostIntegrationActive = false;
    if (params.hostStaffId != null) {
      const integration = await prisma.staffMeetingIntegration.findUnique({
        where: {
          staffId_provider: {
            staffId: params.hostStaffId,
            provider: "zoom",
          },
        },
        select: { disconnectedAt: true },
      });
      hostIntegrationActive = !!integration && !integration.disconnectedAt;
    }

    if (params.mode === "fetch_now" && !hostIntegrationActive) {
      return err(
        "ホスト担当者のZoom連携が無いため即取得はできません。scheduledモード（手動追加のみ）で登録してください。"
      );
    }

    const hasPrimary = await prisma.hojoZoomRecording.findFirst({
      where: {
        contactHistoryId: params.contactHistoryId,
        isPrimary: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    const recording = await prisma.hojoZoomRecording.create({
      data: {
        contactHistoryId: params.contactHistoryId,
        zoomMeetingId: meetingIdBig,
        hostStaffId: params.hostStaffId ?? null,
        joinUrl: parsed.cleanUrl,
        isPrimary: !hasPrimary,
        label: hasPrimary ? params.label ?? "追加Zoom" : params.label ?? null,
        state: "予定",
      },
    });

    if (params.mode === "fetch_now") {
      const result = await fetchAllForRecording(recording.id);
      await syncMeetingRecordFromV1({ scope: "hojo", legacyRecordingId: recording.id });
      await revalidatePathsForContactHistory(params.contactHistoryId);
      if (result.state === "予定") {
        return ok({
          recordingId: recording.id,
          state: "予定",
          message:
            "録画がまだのようなので予定状態で保存しました。Zoom終了後に自動で議事録を取得します。",
        });
      }
      return ok({ recordingId: recording.id, state: result.state });
    }

    await revalidatePathsForContactHistory(params.contactHistoryId);
    return ok({ recordingId: recording.id, state: "予定" });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Zoom議事録連携の追加に失敗しました");
  }
}

async function revalidatePathsForContactHistory(contactHistoryId: number) {
  const ch = await prisma.hojoContactHistory.findUnique({
    where: { id: contactHistoryId },
    select: { vendorId: true, targetType: true },
  });
  if (ch?.vendorId) {
    revalidatePath(`/hojo/settings/vendors/${ch.vendorId}`);
  }
  if (ch?.targetType === "bbs") {
    revalidatePath("/hojo/contact-histories/bbs");
  }
  if (ch?.targetType === "lender") {
    revalidatePath("/hojo/contact-histories/lender");
  }
  revalidatePath("/hojo/records/contact-histories");
  revalidatePath("/hojo/records/zoom-recordings");
}

// ============================================
// 再取得
// ============================================
export async function retryHojoZoomRecording(
  recordingId: number
): Promise<ActionResult<{ state: string }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");
    const result = await fetchAllForRecording(recordingId);
    await syncMeetingRecordFromV1({ scope: "hojo", legacyRecordingId: recordingId });
    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ state: result.state });
  } catch (e) {
    return err(e instanceof Error ? e.message : "再取得に失敗しました");
  }
}

// ============================================
// 状態変更
// ============================================
export async function updateHojoZoomRecordingState(
  recordingId: number,
  newState: "予定" | "完了" | "失敗"
): Promise<ActionResult<{ recordingId: number; state: string }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    if (!["予定", "完了", "失敗"].includes(newState)) {
      return err("不正な状態値です");
    }
    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true, state: true },
    });
    if (!rec) return err("録画レコードが見つかりません");
    if (rec.state === newState) return ok({ recordingId, state: newState });

    await prisma.hojoZoomRecording.update({
      where: { id: recordingId },
      data: { state: newState },
    });
    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ recordingId, state: newState });
  } catch (e) {
    return err(e instanceof Error ? e.message : "商談状況の更新に失敗しました");
  }
}

// ============================================
// 論理削除
// ============================================
export async function deleteHojoZoomRecordingManual(
  recordingId: number,
  reason: string
): Promise<ActionResult<{ recordingId: number }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    if (!reason.trim()) return err("削除理由の記載は必須です");

    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    await prisma.hojoZoomRecording.update({
      where: { id: recordingId },
      data: { deletedAt: new Date() },
    });
    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ recordingId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "削除に失敗しました");
  }
}

// ============================================
// 詳細取得（詳細ダイアログ用）
// ============================================
export async function getHojoZoomRecordingDetail(recordingId: number): Promise<
  ActionResult<{
    id: number;
    zoomMeetingId: string;
    joinUrl: string;
    label: string | null;
    isPrimary: boolean;
    state: string;
    hostStaffName: string | null;
    recordingStartAt: string | null;
    recordingEndAt: string | null;
    downloadStatus: string;
    downloadError: string | null;
    transcriptText: string | null;
    chatLogText: string | null;
    participantsJson: string | null;
    mp4Path: string | null;
    mp4SizeBytes: number | null;
    aiCompanionSummary: string | null;
    aiCompanionFetchedAt: string | null;
    summaryNextSteps: string | null;
    claudeSummary: string | null;
    claudeSummaryGeneratedAt: string | null;
    claudeSummaryModel: string | null;
    claudeMinutesAppendedAt: string | null;
    minutesAppendedAt: string | null;
  }>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
    const r = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      include: { hostStaff: { select: { name: true } } },
    });
    if (!r) return err("Recording が見つかりません");
    return ok({
      id: r.id,
      zoomMeetingId: r.zoomMeetingId.toString(),
      joinUrl: r.joinUrl,
      label: r.label,
      isPrimary: r.isPrimary,
      state: r.state,
      hostStaffName: r.hostStaff?.name ?? null,
      recordingStartAt: r.recordingStartAt?.toISOString() ?? null,
      recordingEndAt: r.recordingEndAt?.toISOString() ?? null,
      downloadStatus: r.downloadStatus,
      downloadError: r.downloadError,
      transcriptText: r.transcriptText,
      chatLogText: r.chatLogText,
      participantsJson: r.participantsJson,
      mp4Path: r.mp4Path,
      mp4SizeBytes: r.mp4SizeBytes != null ? Number(r.mp4SizeBytes) : null,
      aiCompanionSummary: r.aiCompanionSummary,
      aiCompanionFetchedAt: r.aiCompanionFetchedAt?.toISOString() ?? null,
      summaryNextSteps: r.summaryNextSteps,
      claudeSummary: r.claudeSummary,
      claudeSummaryGeneratedAt: r.claudeSummaryGeneratedAt?.toISOString() ?? null,
      claudeSummaryModel: r.claudeSummaryModel,
      claudeMinutesAppendedAt: r.claudeMinutesAppendedAt?.toISOString() ?? null,
      minutesAppendedAt: r.minutesAppendedAt?.toISOString() ?? null,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Recording詳細の取得に失敗しました");
  }
}

// ============================================
// Claude生成議事録の手動編集
// ============================================
export async function updateHojoClaudeSummary(
  recordingId: number,
  newText: string
): Promise<ActionResult<{ recordingId: number }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");
    await prisma.hojoZoomRecording.update({
      where: { id: recordingId },
      data: { claudeSummary: newText },
    });
    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ recordingId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Claude議事録の編集に失敗しました");
  }
}

// ============================================
// Claude議事録を接触履歴の meetingMinutes に反映
// ============================================
export async function reflectHojoClaudeSummaryToMinutes(
  recordingId: number,
  overwrite: boolean
): Promise<ActionResult<{ appended: boolean; alreadyAppended: boolean }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true, claudeSummary: true },
    });
    if (!rec) return err("Recording が見つかりません");
    if (!rec.claudeSummary || !rec.claudeSummary.trim()) {
      return err("Claude生成議事録がまだ生成されていません");
    }

    const result = await appendClaudeSummaryMinutesHojo({
      recordingId,
      overwrite,
    });
    if (!result.appended && result.alreadyAppended && !overwrite) {
      return ok(result);
    }
    if (!result.appended) return err("反映できませんでした");

    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "メイン議事録への反映に失敗しました");
  }
}

// ============================================
// 接触履歴のZoom情報一覧取得（UI用）
// ============================================
export async function getHojoContactHistoryZoomRecordings(
  contactHistoryId: number
): Promise<
  ActionResult<
    {
      id: number;
      zoomMeetingId: string;
      joinUrl: string;
      scheduledAt: string | null;
      isPrimary: boolean;
      label: string | null;
      state: string;
      hostStaffName: string | null;
      zoomApiError: string | null;
      createdAt: string;
      hasRecording: boolean;
    }[]
  >
> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
    const rows = await prisma.hojoZoomRecording.findMany({
      where: { contactHistoryId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      include: { hostStaff: { select: { name: true } } },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        zoomMeetingId: r.zoomMeetingId.toString(),
        joinUrl: r.joinUrl,
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
        isPrimary: r.isPrimary,
        label: r.label,
        state: r.state,
        hostStaffName: r.hostStaff?.name ?? null,
        zoomApiError: r.zoomApiError,
        createdAt: r.createdAt.toISOString(),
        hasRecording:
          r.state === "完了" ||
          !!r.aiCompanionSummary ||
          !!r.transcriptText ||
          !!r.mp4Path,
      }))
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Zoom情報の取得に失敗しました");
  }
}

// ============================================
// Zoom Recording に紐づく接触履歴情報（詳細モーダル用）
// ============================================
export async function getHojoContactHistoryForZoomRecording(
  recordingId: number
): Promise<
  ActionResult<{
    contactHistoryId: number;
    contactDate: string;
    staffId: number | null;
    staffName: string | null;
    contactMethodId: number | null;
    contactMethodName: string | null;
    contactCategoryId: number | null;
    contactCategoryName: string | null;
    customerParticipants: string | null;
    meetingMinutes: string | null;
    note: string | null;
    targetType: string;
    vendorId: number | null;
    vendorName: string | null;
  }>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      select: { contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    const ch = await prisma.hojoContactHistory.findUnique({
      where: { id: rec.contactHistoryId },
      include: {
        staff: { select: { id: true, name: true } },
        contactMethod: { select: { id: true, name: true } },
        contactCategory: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
      },
    });
    if (!ch) return err("接触履歴が見つかりません");

    return ok({
      contactHistoryId: ch.id,
      contactDate: ch.contactDate.toISOString(),
      staffId: ch.staffId,
      staffName: ch.staff?.name ?? null,
      contactMethodId: ch.contactMethodId,
      contactMethodName: ch.contactMethod?.name ?? null,
      contactCategoryId: ch.contactCategoryId,
      contactCategoryName: ch.contactCategory?.name ?? null,
      customerParticipants: ch.customerParticipants,
      meetingMinutes: ch.meetingMinutes,
      note: ch.note,
      targetType: ch.targetType,
      vendorId: ch.vendor?.id ?? null,
      vendorName: ch.vendor?.name ?? null,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "接触履歴の取得に失敗しました");
  }
}

// ============================================
// 統合モーダルから接触履歴を簡易編集
// ============================================
export async function updateHojoContactHistoryFromZoomModal(
  recordingId: number,
  data: {
    meetingMinutes: string | null;
    note: string | null;
    customerParticipants: string | null;
  }
): Promise<ActionResult<{ contactHistoryId: number }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    const rec = await prisma.hojoZoomRecording.findUnique({
      where: { id: recordingId },
      select: { contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    await prisma.hojoContactHistory.update({
      where: { id: rec.contactHistoryId },
      data: {
        meetingMinutes: data.meetingMinutes?.trim() || null,
        note: data.note?.trim() || null,
        customerParticipants: data.customerParticipants?.trim() || null,
      },
    });

    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ contactHistoryId: rec.contactHistoryId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "接触履歴の更新に失敗しました");
  }
}
