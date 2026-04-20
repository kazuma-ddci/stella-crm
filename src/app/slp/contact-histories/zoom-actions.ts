"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { parseZoomJoinUrl } from "@/lib/zoom/url-parser";
import { fetchAllForRecording } from "@/lib/slp/zoom-recording-processor";
import { appendClaudeSummaryMinutes } from "@/lib/slp/slp-meeting-minutes";

// ============================================
// Zoom連携済みスタッフ一覧取得（ホスト選択プルダウン用）
// - SLPプロジェクトに view 以上の権限ありスタッフ
// - かつ StaffMeetingIntegration (provider="zoom", disconnectedAt=null) を持つスタッフ
// ============================================
export async function listZoomLinkedStaffs(): Promise<
  ActionResult<{ id: number; name: string }[]>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
    const slpProject = await prisma.masterProject.findFirst({
      where: { code: "slp" },
      select: { id: true },
    });
    if (!slpProject) return ok([]);

    const integrations = await prisma.staffMeetingIntegration.findMany({
      where: {
        provider: "zoom",
        disconnectedAt: null,
        staff: {
          isActive: true,
          isSystemUser: false,
          projectAssignments: { some: { projectId: slpProject.id } },
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
// SLP全スタッフ一覧（Zoom連携済みフラグ付き）
// - 手動Zoom URL入力モーダルのホスト担当者ドロップダウン用
// - 未連携スタッフも「API連携なし」として選択肢に出す
// ============================================
export async function listAllSlpStaffsForZoomHost(): Promise<
  ActionResult<{ id: number; name: string; zoomIntegrated: boolean }[]>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
    const slpProject = await prisma.masterProject.findFirst({
      where: { code: "slp" },
      select: { id: true },
    });
    if (!slpProject) return ok([]);

    const staffs = await prisma.masterStaff.findMany({
      where: {
        isActive: true,
        isSystemUser: false,
        projectAssignments: { some: { projectId: slpProject.id } },
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
  state: string; // "予定" | "完了" | "失敗"
  message?: string;
};

export async function addManualZoomToContactHistory(params: {
  contactHistoryId: number;
  zoomUrl: string;
  /** null の場合は「ホスト未選択」扱い（API連携なしレコードとして保存、即取得は不可） */
  hostStaffId: number | null;
  label?: string;
  mode: "fetch_now" | "scheduled";
}): Promise<ActionResult<AddZoomResult>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    // URL から meeting_id 抽出
    const parsed = parseZoomJoinUrl(params.zoomUrl);
    if (!parsed.ok) {
      return err(parsed.error);
    }
    const meetingIdBig = BigInt(parsed.meetingId);

    // 接触履歴存在確認
    const ch = await prisma.slpContactHistory.findUnique({
      where: { id: params.contactHistoryId },
      select: { id: true, deletedAt: true, companyRecordId: true },
    });
    if (!ch || ch.deletedAt) {
      return err("接触履歴が見つかりません");
    }

    // 同一 meeting_id の既存Recording確認
    //   - アクティブ(deletedAt=null): 他履歴にあればエラー、自履歴なら重複エラー
    //   - 論理削除済み: zoomMeetingId は UNIQUE なので新規作成しようとすると
    //     Prismaが P2002 を投げる。事前に分かりやすいエラーを返す。
    const existing = await prisma.slpZoomRecording.findUnique({
      where: { zoomMeetingId: meetingIdBig },
      select: { id: true, contactHistoryId: true, deletedAt: true },
    });
    if (existing) {
      if (!existing.deletedAt) {
        if (existing.contactHistoryId === params.contactHistoryId) {
          return err("このZoom URLはこの接触履歴に既に登録されています");
        }
        return err(
          `このZoom URL（Meeting ID: ${parsed.meetingId}）は別の接触履歴 #${existing.contactHistoryId} に既に登録されています`
        );
      }
      // 論理削除済み → 明確なメッセージ（物理削除は不可）
      return err(
        `このZoom URL（Meeting ID: ${parsed.meetingId}）は以前に削除された記録があるため、同じ URL は再登録できません。別の会議URLを使用するか、スタッフ管理者にご相談ください。`
      );
    }

    // ホストスタッフがZoom連携済みか確認（未指定 or 未連携なら「API連携なし」レコードとして扱う）
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

    // 即取得モードは API連携が生きている場合のみ可能
    if (params.mode === "fetch_now" && !hostIntegrationActive) {
      return err(
        "ホスト担当者のZoom連携が無いため即取得はできません。scheduledモード（手動追加のみ）で登録してください。"
      );
    }

    // Recording を「追加Zoom」として作成（isPrimary=false, state="予定"）
    // 既に isPrimary=true Recording があるかどうかで primary 判定を分岐
    const hasPrimary = await prisma.slpZoomRecording.findFirst({
      where: {
        contactHistoryId: params.contactHistoryId,
        isPrimary: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    // 既存カテゴリを session 経由で取得（manual追加は任意のセッション無し接触履歴もありえる）
    const chWithSession = await prisma.slpContactHistory.findUnique({
      where: { id: params.contactHistoryId },
      select: { session: { select: { category: true } } },
    });
    const category =
      (chWithSession?.session?.category as "briefing" | "consultation" | undefined) ??
      "briefing"; // デフォルトは briefing（手動追加時のセッション無しケース）

    const recording = await prisma.slpZoomRecording.create({
      data: {
        contactHistoryId: params.contactHistoryId,
        zoomMeetingId: meetingIdBig,
        category,
        hostStaffId: params.hostStaffId ?? null,
        joinUrl: parsed.cleanUrl,
        isPrimary: !hasPrimary, // primary 未設定なら primary に、既にあれば 追加Zoom
        label: hasPrimary ? params.label ?? "追加Zoom" : params.label ?? null,
        state: "予定",
      },
    });

    // mode=fetch_now の場合、即取得を試みる
    if (params.mode === "fetch_now") {
      const result = await fetchAllForRecording(recording.id);
      revalidatePathsForContactHistory(params.contactHistoryId);
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

    revalidatePathsForContactHistory(params.contactHistoryId);
    return ok({ recordingId: recording.id, state: "予定" });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Zoom議事録連携の追加に失敗しました");
  }
}

/**
 * 接触履歴に関連するページ群の revalidatePath
 * - 事業者紐付きなら /slp/companies/[id]
 * - 代理店紐付きなら /slp/agencies/[id]
 * - 常に /slp/records/contact-histories も revalidate
 */
async function revalidatePathsForContactHistory(contactHistoryId: number) {
  const ch = await prisma.slpContactHistory.findUnique({
    where: { id: contactHistoryId },
    select: { companyRecordId: true, agencyId: true },
  });
  if (ch?.companyRecordId) {
    revalidatePath(`/slp/companies/${ch.companyRecordId}`);
  }
  if (ch?.agencyId) {
    revalidatePath(`/slp/agencies/${ch.agencyId}`);
  }
  revalidatePath("/slp/records/contact-histories");
  revalidatePath("/slp/records/zoom-recordings");
}

// ============================================
// 取得失敗Recordingの再取得
// ============================================
export async function retryZoomRecording(
  recordingId: number
): Promise<ActionResult<{ state: string }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    const result = await fetchAllForRecording(recordingId);
    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ state: result.state });
  } catch (e) {
    return err(e instanceof Error ? e.message : "再取得に失敗しました");
  }
}

// ============================================
// Recording の商談状況（state）をスタッフが手動変更
// ============================================
export async function updateZoomRecordingState(
  recordingId: number,
  newState: "予定" | "完了" | "失敗"
): Promise<ActionResult<{ recordingId: number; state: string }>> {
  try {
    await requireStaffWithProjectPermission([
      { project: "slp", level: "edit" },
    ]);

    if (!["予定", "完了", "失敗"].includes(newState)) {
      return err("不正な状態値です");
    }

    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true, state: true },
    });
    if (!rec) return err("録画レコードが見つかりません");
    if (rec.state === newState) {
      return ok({ recordingId, state: newState });
    }

    await prisma.slpZoomRecording.update({
      where: { id: recordingId },
      data: { state: newState },
    });

    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ recordingId, state: newState });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "商談状況の更新に失敗しました"
    );
  }
}

// ============================================
// Recording 論理削除
// ============================================
export async function deleteZoomRecordingManual(
  recordingId: number,
  reason: string
): Promise<ActionResult<{ recordingId: number }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    if (!reason.trim()) {
      return err("削除理由の記載は必須です");
    }

    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    await prisma.slpZoomRecording.update({
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
// Zoom Recording の詳細情報取得（詳細ダイアログ用）
// ============================================
export async function getZoomRecordingDetail(recordingId: number): Promise<
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
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
    const r = await prisma.slpZoomRecording.findUnique({
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
    return err(
      e instanceof Error ? e.message : "Recording詳細の取得に失敗しました"
    );
  }
}

// ============================================
// Claude生成議事録の手動編集
// ============================================
export async function updateClaudeSummary(
  recordingId: number,
  newText: string
): Promise<ActionResult<{ recordingId: number }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    await prisma.slpZoomRecording.update({
      where: { id: recordingId },
      data: {
        claudeSummary: newText,
        // 編集したら反映フラグをクリア（再反映可能にするため）
        // ただし既存のmeetingMinutesへの追記済みは残す（後でスタッフが削除可能）
      },
    });
    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok({ recordingId });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "Claude議事録の編集に失敗しました"
    );
  }
}

// ============================================
// Claude生成議事録を接触履歴のメイン議事録に反映
// ============================================
export async function reflectClaudeSummaryToMinutes(
  recordingId: number,
  overwrite: boolean
): Promise<
  ActionResult<{ appended: boolean; alreadyAppended: boolean }>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, contactHistoryId: true, claudeSummary: true },
    });
    if (!rec) return err("Recording が見つかりません");
    if (!rec.claudeSummary || !rec.claudeSummary.trim()) {
      return err("Claude生成議事録がまだ生成されていません");
    }

    const result = await appendClaudeSummaryMinutes({
      recordingId,
      overwrite,
    });
    if (!result.appended && result.alreadyAppended && !overwrite) {
      return ok(result); // フロントで上書き確認ダイアログ表示
    }
    if (!result.appended) {
      return err("反映できませんでした");
    }

    await revalidatePathsForContactHistory(rec.contactHistoryId);
    return ok(result);
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "メイン議事録への反映に失敗しました"
    );
  }
}

// ============================================
// 接触履歴の Zoom情報一覧取得（UI 表示用）
// ============================================

export async function getContactHistoryZoomRecordings(
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
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
    const rows = await prisma.slpZoomRecording.findMany({
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
    return err(
      e instanceof Error ? e.message : "Zoom情報の取得に失敗しました"
    );
  }
}

// ============================================
// Zoom Recording に紐づく接触履歴の情報（統合モーダル「接触履歴」タブ用）
// ============================================
export async function getContactHistoryForZoomRecording(
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
    companyRecordId: number | null;
    companyRecordName: string | null;
  }>
> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingId },
      select: { contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    const ch = await prisma.slpContactHistory.findUnique({
      where: { id: rec.contactHistoryId },
      include: {
        staff: { select: { id: true, name: true } },
        contactMethod: { select: { id: true, name: true } },
        contactCategory: { select: { id: true, name: true } },
        companyRecord: { select: { id: true, companyName: true } },
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
      companyRecordId: ch.companyRecord?.id ?? null,
      companyRecordName: ch.companyRecord?.companyName ?? null,
    });
  } catch (e) {
    return err(
      e instanceof Error ? e.message : "接触履歴の取得に失敗しました"
    );
  }
}

// ============================================
// 統合モーダルから接触履歴を簡易編集する（議事録・メモ・顧客参加者）
// 接触日時・担当者などの核となる項目は接触履歴ページに誘導するためここでは扱わない
// ============================================
export async function updateContactHistoryFromZoomModal(
  recordingId: number,
  data: {
    meetingMinutes: string | null;
    note: string | null;
    customerParticipants: string | null;
  }
): Promise<ActionResult<{ contactHistoryId: number }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
    const rec = await prisma.slpZoomRecording.findUnique({
      where: { id: recordingId },
      select: { contactHistoryId: true },
    });
    if (!rec) return err("Recording が見つかりません");

    await prisma.slpContactHistory.update({
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
    return err(
      e instanceof Error ? e.message : "接触履歴の更新に失敗しました"
    );
  }
}
