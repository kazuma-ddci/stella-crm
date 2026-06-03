"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { parseZoomJoinUrl } from "@/lib/zoom/url-parser";
import { fetchAllForRecording } from "@/lib/hojo/zoom-recording-processor";
import { appendClaudeSummaryMinutesHojo } from "@/lib/hojo/hojo-meeting-minutes";
import {
  generateTaskCandidatesForHojoRecording,
  type HojoZoomTaskCandidate,
} from "@/lib/hojo/zoom-ai";

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

    // 固定URL/PMI は同じ meeting_id を複数開催回で再利用するため、
    // SLPや別のHOJO接触履歴で使われていても登録可能。同一接触履歴内の二重登録だけ防ぐ。
    const existingHojo = await prisma.hojoZoomRecording.findFirst({
      where: {
        contactHistoryId: params.contactHistoryId,
        zoomMeetingId: meetingIdBig,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingHojo) {
      return err("このZoom URLはこの接触履歴に既に登録されています");
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

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTaskInput(
  task: HojoZoomTaskCandidate
): HojoZoomTaskCandidate | null {
  const taskType =
    task.taskType === "vendor" || task.taskType === "consulting_team"
      ? task.taskType
      : null;
  const content = typeof task.content === "string" ? task.content.trim() : "";
  if (!taskType || !content) return null;
  const deadline =
    typeof task.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline)
      ? task.deadline
      : "";
  const priority =
    typeof task.priority === "string" && ["高", "中", "低"].includes(task.priority)
      ? task.priority
      : "";
  return { taskType, content, deadline, priority };
}

async function getVendorContactHistoryForRecording(recordingId: number) {
  const rec = await prisma.hojoZoomRecording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      contactHistoryId: true,
      deletedAt: true,
      contactHistory: {
        select: {
          id: true,
          deletedAt: true,
          targetType: true,
          vendorId: true,
        },
      },
    },
  });
  if (!rec || rec.deletedAt) {
    throw new Error("Recording が見つかりません");
  }
  const ch = rec.contactHistory;
  if (!ch || ch.deletedAt || ch.targetType !== "vendor" || !ch.vendorId) {
    throw new Error("ベンダー接触履歴に紐づくZoomのみ利用できます");
  }
  return {
    recordingId: rec.id,
    contactHistoryId: rec.contactHistoryId,
    vendorId: ch.vendorId,
  };
}

// ============================================
// Zoom文字起こし → コンサル履歴タスク候補
// ============================================
export async function generateHojoZoomTaskCandidates(
  recordingId: number
): Promise<ActionResult<{ tasks: HojoZoomTaskCandidate[]; model: string }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    await getVendorContactHistoryForRecording(recordingId);
    const result = await generateTaskCandidatesForHojoRecording({ recordingId });
    return ok({ tasks: result.tasks, model: result.model });
  } catch (e) {
    return err(e instanceof Error ? e.message : "タスク候補の生成に失敗しました");
  }
}

export async function listHojoConsultingActivitiesForZoomTaskReflection(
  recordingId: number
): Promise<
  ActionResult<
    {
      id: number;
      label: string;
      activityDate: string;
      title: string | null;
      taskCounts: { vendor: number; consultingTeam: number };
    }[]
  >
> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
    const { vendorId } = await getVendorContactHistoryForRecording(recordingId);
    const rows = await prisma.hojoConsultingActivity.findMany({
      where: { vendorId, deletedAt: null },
      select: {
        id: true,
        activityDate: true,
        title: true,
        contactMethod: true,
        tasks: { select: { taskType: true } },
      },
      orderBy: [{ activityDate: "desc" }, { id: "desc" }],
    });

    return ok(
      rows.map((row) => {
        const activityDate = row.activityDate.toISOString().split("T")[0];
        const title = row.title?.trim() || row.contactMethod?.trim() || "コンサル履歴";
        return {
          id: row.id,
          activityDate,
          title: row.title,
          label: `${activityDate} - ${title} (#${row.id})`,
          taskCounts: {
            vendor: row.tasks.filter((task) => task.taskType === "vendor").length,
            consultingTeam: row.tasks.filter((task) => task.taskType === "consulting_team").length,
          },
        };
      })
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "コンサル履歴候補の取得に失敗しました");
  }
}

export async function reflectHojoZoomTasksToConsultingActivity(params: {
  recordingId: number;
  activityId: number;
  tasks: HojoZoomTaskCandidate[];
}): Promise<ActionResult<{ createdCount: number }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
    const { vendorId, contactHistoryId } = await getVendorContactHistoryForRecording(
      params.recordingId
    );
    const activity = await prisma.hojoConsultingActivity.findUnique({
      where: { id: params.activityId },
      select: { id: true, vendorId: true, deletedAt: true },
    });
    if (!activity || activity.deletedAt || activity.vendorId !== vendorId) {
      return err("選択したコンサル履歴が見つかりません");
    }

    const tasks = params.tasks
      .map(normalizeTaskInput)
      .filter((task): task is HojoZoomTaskCandidate => task !== null);
    if (tasks.length === 0) {
      return err("反映するタスクを入力してください");
    }

    const maxOrders = await prisma.hojoConsultingActivityTask.groupBy({
      by: ["taskType"],
      where: { activityId: params.activityId },
      _max: { displayOrder: true },
    });
    const nextOrderByType: Record<"vendor" | "consulting_team", number> = {
      vendor: 0,
      consulting_team: 0,
    };
    for (const row of maxOrders) {
      if (row.taskType === "vendor" || row.taskType === "consulting_team") {
        nextOrderByType[row.taskType] = (row._max.displayOrder ?? -1) + 1;
      }
    }

    await prisma.$transaction(
      tasks.map((task) => {
        const displayOrder = nextOrderByType[task.taskType];
        nextOrderByType[task.taskType] += 1;
        return prisma.hojoConsultingActivityTask.create({
          data: {
            activity: { connect: { id: params.activityId } },
            taskType: task.taskType,
            content: task.content,
            deadline: toDateOrNull(task.deadline),
            priority: task.priority || null,
            completed: false,
            displayOrder,
          },
        });
      })
    );

    await revalidatePathsForContactHistory(contactHistoryId);
    revalidatePath("/hojo/consulting/activities");
    revalidatePath(`/hojo/settings/vendors/${vendorId}`);
    revalidatePath("/hojo/vendor");
    return ok({ createdCount: tasks.length });
  } catch (e) {
    return err(e instanceof Error ? e.message : "タスクの反映に失敗しました");
  }
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
