import { prisma } from "@/lib/prisma";
import {
  createZoomMeeting,
  updateZoomMeeting,
  deleteZoomMeeting,
} from "@/lib/zoom/meeting";
import { logAutomationError } from "@/lib/automation-error";

/**
 * V2 接触履歴の作成・更新後、provider="zoom" かつ URL 未設定 かつ hostStaffId
 * 設定済みの ContactHistoryMeeting に対して Zoom API で会議を発行する。
 *
 * V1 (src/lib/slp/zoom-reservation-handler.ts の ensureZoomMeetingForSession)
 * と同等の振る舞いを V2 モデル向けに再実装したもの。
 *
 * 失敗時は throw せず、meeting.apiError / apiErrorAt に記録してスキップする
 * (ユーザーは後で再発行ボタンから再試行できる)。
 *
 * SLP/HOJO の併走期間中は、発行成功した V2 meeting に対応する V1 Recording
 * (slpZoomRecording / hojoZoomRecording) も作成して、Webhook・cron・既存手動
 * 取得ボタン等の V1 経路も動き続けるようにする。
 */
export async function provisionZoomMeetingsForContactHistory(params: {
  contactHistoryId: number;
  /** トピック名 (例: "山田商事様 商談"). 未設定なら "{projectCode} 接触履歴 #{id}" */
  topic?: string | null;
}): Promise<void> {
  const { contactHistoryId, topic } = params;

  // 発行対象: provider=zoom + hostStaffId あり + joinUrl 未設定 + 未発行
  const pending = await prisma.contactHistoryMeeting.findMany({
    where: {
      contactHistoryId,
      deletedAt: null,
      provider: "zoom",
      joinUrl: null,
      hostStaffId: { not: null },
      externalMeetingId: null,
    },
    include: {
      contactHistory: {
        select: {
          id: true,
          title: true,
          scheduledStartAt: true,
          project: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (pending.length === 0) return;

  for (const meeting of pending) {
    const hostStaffId = meeting.hostStaffId!;
    const scheduledStart =
      meeting.scheduledStartAt ?? meeting.contactHistory.scheduledStartAt;
    const resolvedTopic =
      topic ??
      meeting.contactHistory.title ??
      `${meeting.contactHistory.project.name} 接触 #${contactHistoryId}`;

    try {
      const resp = await createZoomMeeting({
        hostStaffId,
        topic: resolvedTopic.slice(0, 200),
        startAtJst: scheduledStart,
        durationMinutes: 60,
      });

      await prisma.contactHistoryMeeting.update({
        where: { id: meeting.id },
        data: {
          externalMeetingId: String(resp.id),
          externalMeetingUuid: resp.uuid ?? null,
          joinUrl: resp.join_url,
          startUrl: resp.start_url ?? null,
          passcode: resp.password ?? null,
          urlSource: "auto_generated",
          urlSetAt: new Date(),
          apiIntegrationStatus: "available",
          apiError: null,
          apiErrorAt: null,
          providerMetadata: {
            zoomHostId: resp.host_id ?? null,
            duration: resp.duration,
          },
        },
      });

      // V1 併走: SLP/HOJO の場合のみ V1 Recording も作成
      const projectCode = meeting.contactHistory.project.code;
      if (projectCode === "slp") {
        await createSlpZoomRecordingIfMissing({
          contactHistoryId,
          externalMeetingId: BigInt(resp.id),
          hostStaffId,
          joinUrl: resp.join_url,
          startUrl: resp.start_url ?? null,
          passcode: resp.password ?? null,
          scheduledAt: scheduledStart,
          isPrimary: meeting.isPrimary,
          label: meeting.label,
        });
      } else if (projectCode === "hojo") {
        await createHojoZoomRecordingIfMissing({
          contactHistoryId,
          externalMeetingId: BigInt(resp.id),
          hostStaffId,
          joinUrl: resp.join_url,
          startUrl: resp.start_url ?? null,
          passcode: resp.password ?? null,
          scheduledAt: scheduledStart,
          isPrimary: meeting.isPrimary,
          label: meeting.label,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.contactHistoryMeeting.update({
        where: { id: meeting.id },
        data: {
          apiError: message.slice(0, 2000),
          apiErrorAt: new Date(),
          apiIntegrationStatus: "unavailable_unlinked_host",
        },
      });
      await logAutomationError({
        source: "contact-history-v2-zoom-provision",
        message: `V2 Zoom発行失敗 (meeting=${meeting.id})`,
        detail: {
          contactHistoryId,
          meetingId: meeting.id,
          hostStaffId,
          error: message,
        },
      });
    }
  }
}

// ============================================================================
// V1 併走: slpZoomRecording / hojoZoomRecording の並行作成
// ============================================================================

async function createSlpZoomRecordingIfMissing(params: {
  contactHistoryId: number;
  externalMeetingId: bigint;
  hostStaffId: number;
  joinUrl: string;
  startUrl: string | null;
  passcode: string | null;
  scheduledAt: Date | null;
  isPrimary: boolean;
  label: string | null;
}): Promise<void> {
  // V2 contactHistoryId から legacyId (SLP) を解決
  // 移行元の SlpContactHistory は sourceRefId="slp:<id>" で紐付くが、ここでは新規発行
  // なので V1 側にもセッション/接触履歴を作るのではなく、V1 recording のみを
  // 作成する。zoomMeetingId ユニーク制約があるため upsert 相当の挙動にする。
  const existing = await prisma.slpZoomRecording.findUnique({
    where: { zoomMeetingId: params.externalMeetingId },
    select: { id: true },
  });
  if (existing) return;

  // V1 SlpContactHistory を特定 (ContactHistoryV2.sourceRefId="slp:<legacyId>")
  const v2 = await prisma.contactHistoryV2.findUnique({
    where: { id: params.contactHistoryId },
    select: { sourceRefId: true },
  });
  const legacyMatch = v2?.sourceRefId?.match(/^slp:(\d+)$/);
  if (!legacyMatch) {
    // V2 新規作成時はまだ V1 連携を作らない。Phase B3.x で V1 レコードを
    // V2→V1 方向に作る仕組みを追加する場合にここを拡張。
    return;
  }

  const legacyId = parseInt(legacyMatch[1], 10);
  await prisma.slpZoomRecording.create({
    data: {
      contactHistoryId: legacyId,
      zoomMeetingId: params.externalMeetingId,
      category: "briefing",
      hostStaffId: params.hostStaffId,
      joinUrl: params.joinUrl,
      startUrl: params.startUrl,
      password: params.passcode,
      scheduledAt: params.scheduledAt,
      isPrimary: params.isPrimary,
      label: params.label,
      state: "予定",
    },
  });
}

async function createHojoZoomRecordingIfMissing(params: {
  contactHistoryId: number;
  externalMeetingId: bigint;
  hostStaffId: number;
  joinUrl: string;
  startUrl: string | null;
  passcode: string | null;
  scheduledAt: Date | null;
  isPrimary: boolean;
  label: string | null;
}): Promise<void> {
  const existing = await prisma.hojoZoomRecording.findUnique({
    where: { zoomMeetingId: params.externalMeetingId },
    select: { id: true },
  });
  if (existing) return;

  const v2 = await prisma.contactHistoryV2.findUnique({
    where: { id: params.contactHistoryId },
    select: { sourceRefId: true },
  });
  const legacyMatch = v2?.sourceRefId?.match(/^hojo:(\d+)$/);
  if (!legacyMatch) return;

  const legacyId = parseInt(legacyMatch[1], 10);
  await prisma.hojoZoomRecording.create({
    data: {
      contactHistoryId: legacyId,
      zoomMeetingId: params.externalMeetingId,
      hostStaffId: params.hostStaffId,
      joinUrl: params.joinUrl,
      startUrl: params.startUrl,
      password: params.passcode,
      scheduledAt: params.scheduledAt,
      isPrimary: params.isPrimary,
      label: params.label,
      state: "予定",
    },
  });
}

// ============================================================================
// 会議 単体に対する Zoom API 操作 (日時変更 / ホスト変更 / キャンセル)
// V1 ensureZoomMeetingForSession と同等の振る舞いを V2 meeting 1件単位で提供。
// 失敗時は apiError/apiErrorAt に記録 + 例外を再 throw (呼び出し側が UI 表示)。
// ============================================================================

/**
 * V2 meeting に紐づく Zoom 会議の予定日時 + topic を Zoom API で更新する。
 * URL は変わらない (Zoom 仕様)。
 */
export async function updateZoomScheduleForV2Meeting(params: {
  meetingId: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const meeting = await prisma.contactHistoryMeeting.findUnique({
    where: { id: params.meetingId },
    include: {
      contactHistory: {
        select: {
          title: true,
          scheduledStartAt: true,
          project: { select: { name: true } },
        },
      },
    },
  });
  if (!meeting) return { ok: false, reason: "meeting_not_found" };
  if (meeting.deletedAt) return { ok: false, reason: "meeting_deleted" };
  if (meeting.provider !== "zoom") return { ok: false, reason: "not_zoom" };
  if (!meeting.externalMeetingId) return { ok: false, reason: "no_external_id" };
  if (!meeting.hostStaffId) return { ok: false, reason: "no_host" };

  const scheduledStart =
    meeting.scheduledStartAt ?? meeting.contactHistory.scheduledStartAt;
  const topic = (
    meeting.contactHistory.title ??
    `${meeting.contactHistory.project.name} 接触 #${meeting.contactHistoryId}`
  ).slice(0, 200);

  try {
    await updateZoomMeeting({
      hostStaffId: meeting.hostStaffId,
      meetingId: BigInt(meeting.externalMeetingId),
      topic,
      startAtJst: scheduledStart,
      durationMinutes: 60,
    });
    await prisma.contactHistoryMeeting.update({
      where: { id: meeting.id },
      data: {
        urlSetAt: new Date(),
        apiError: null,
        apiErrorAt: null,
      },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.contactHistoryMeeting.update({
      where: { id: meeting.id },
      data: { apiError: message.slice(0, 2000), apiErrorAt: new Date() },
    });
    await logAutomationError({
      source: "contact-history-v2-zoom-update-schedule",
      message: `V2 Zoom 日時更新失敗 (meeting=${meeting.id})`,
      detail: { meetingId: meeting.id, error: message },
    });
    throw err;
  }
}

/**
 * V2 meeting の Zoom 会議を「旧ホストで削除→新ホストで再発行」する。
 * URL も変わる。新しい externalMeetingId / joinUrl / startUrl / passcode を保存。
 */
export async function recreateZoomWithNewHostForV2Meeting(params: {
  meetingId: number;
  newHostStaffId: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const meeting = await prisma.contactHistoryMeeting.findUnique({
    where: { id: params.meetingId },
    include: {
      contactHistory: {
        select: {
          title: true,
          scheduledStartAt: true,
          project: { select: { name: true } },
        },
      },
    },
  });
  if (!meeting) return { ok: false, reason: "meeting_not_found" };
  if (meeting.deletedAt) return { ok: false, reason: "meeting_deleted" };
  if (meeting.provider !== "zoom") return { ok: false, reason: "not_zoom" };

  // 1. 旧 Zoom を削除 (失敗してもログだけ残して続行)
  if (meeting.externalMeetingId && meeting.hostStaffId) {
    try {
      await deleteZoomMeeting({
        hostStaffId: meeting.hostStaffId,
        meetingId: BigInt(meeting.externalMeetingId),
      });
    } catch (err) {
      await logAutomationError({
        source: "contact-history-v2-zoom-recreate-delete-old",
        message: `旧 Zoom 削除失敗 (続行): meeting=${meeting.id}`,
        detail: {
          meetingId: meeting.id,
          oldHostStaffId: meeting.hostStaffId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  // 2. 新 Zoom を発行
  const scheduledStart =
    meeting.scheduledStartAt ?? meeting.contactHistory.scheduledStartAt;
  const topic = (
    meeting.contactHistory.title ??
    `${meeting.contactHistory.project.name} 接触 #${meeting.contactHistoryId}`
  ).slice(0, 200);

  try {
    const resp = await createZoomMeeting({
      hostStaffId: params.newHostStaffId,
      topic,
      startAtJst: scheduledStart,
      durationMinutes: 60,
    });
    await prisma.contactHistoryMeeting.update({
      where: { id: meeting.id },
      data: {
        hostStaffId: params.newHostStaffId,
        externalMeetingId: String(resp.id),
        externalMeetingUuid: resp.uuid ?? null,
        joinUrl: resp.join_url,
        startUrl: resp.start_url ?? null,
        passcode: resp.password ?? null,
        urlSource: "auto_generated",
        urlSetAt: new Date(),
        apiIntegrationStatus: "available",
        apiError: null,
        apiErrorAt: null,
        hostUrlConsistencyConfirmedAt: null,
      },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.contactHistoryMeeting.update({
      where: { id: meeting.id },
      data: { apiError: message.slice(0, 2000), apiErrorAt: new Date() },
    });
    await logAutomationError({
      source: "contact-history-v2-zoom-recreate-create-new",
      message: `新 Zoom 発行失敗 (meeting=${meeting.id})`,
      detail: {
        meetingId: meeting.id,
        newHostStaffId: params.newHostStaffId,
        error: message,
      },
    });
    throw err;
  }
}

/**
 * 接触履歴の status="cancelled" や論理削除に伴い、紐づく Zoom 会議をすべて
 * Zoom API で削除する。失敗してもログのみで例外は飲み込む (DB 操作は継続させる)。
 *
 * Zoom 削除後も V2 meeting レコード自体は残し、apiError 欄に "deleted_at_cancel"
 * の旨を記録する。Zoom 側 404 は正常 (二重削除耐性)。
 */
export async function cancelZoomMeetingsForContactHistory(params: {
  contactHistoryId: number;
}): Promise<void> {
  const meetings = await prisma.contactHistoryMeeting.findMany({
    where: {
      contactHistoryId: params.contactHistoryId,
      provider: "zoom",
      externalMeetingId: { not: null },
      hostStaffId: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      externalMeetingId: true,
      hostStaffId: true,
    },
  });

  for (const m of meetings) {
    try {
      await deleteZoomMeeting({
        hostStaffId: m.hostStaffId!,
        meetingId: BigInt(m.externalMeetingId!),
      });
    } catch (err) {
      await logAutomationError({
        source: "contact-history-v2-zoom-cancel",
        message: `Zoom キャンセル削除失敗 (meeting=${m.id})`,
        detail: {
          meetingId: m.id,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}
