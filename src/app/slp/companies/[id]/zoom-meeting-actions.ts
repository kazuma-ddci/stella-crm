"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  regenerateZoomForSession,
  cancelZoomMeetingForSession,
} from "@/lib/slp/zoom-reservation-handler";
import {
  ensureContactHistoryV2ForSession,
  findV2PrimaryMeetingForSession,
} from "@/lib/slp/v2-session-sync";
import { parseZoomJoinUrl } from "@/lib/zoom/url-parser";
import { getNotifiableCustomerLineFriendIds } from "@/lib/slp/session-helper";
import {
  sendSessionNotification,
  type NotificationTrigger,
} from "@/lib/slp/slp-session-notification";
import { formatJstDateTime } from "@/lib/zoom/templates";
import { resolveProlineStaffName } from "@/lib/slp/proline-staff-name";
import { ZOOM_GUIDE_FORM, ZOOM_CONSULT_FORM } from "@/lib/proline-form";

export type ZoomUrlNoticeRecipient = {
  lineFriendId: number;
  uid: string;
  label: string;
};

export type ZoomUrlNoticeDraft = {
  ok: true;
  joinUrl: string;
  bodyText: string;
  recipients: ZoomUrlNoticeRecipient[];
} | { ok: false; message: string };

/**
 * セッションIDに対して Zoom URL を再発行する（旧「手動で発行する」ボタン相当）
 * - 既存の primary Zoom を削除して新規発行
 * - お客様への自動送信はしない（スタッフが手動で送付する）
 */
export async function regenerateZoomMeetingBySession(
  sessionId: number
): Promise<{ ok: true; url: string | null } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, companyRecordId: true, deletedAt: true },
    });
    if (!session || session.deletedAt) {
      return { ok: false, message: "打ち合わせが見つかりません" };
    }

    const result = await regenerateZoomForSession({ sessionId: session.id });
    if (!result.ok) {
      return { ok: false, message: result.errorMessage ?? "再発行に失敗しました" };
    }
    revalidatePath(`/slp/companies/${session.companyRecordId}`);
    return { ok: true, url: result.url };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "予期しないエラー",
    };
  }
}

/**
 * セッションに手動 Zoom URL を設定する（連携なしスタッフがホストの場合用）
 * - 既存 primary Recording がある場合はエラー（先に削除してもらう）
 * - hostStaffId が null または未連携 → 「API連携なし」扱いで保存
 * - hostStaffId が連携済み → 通常の Zoom API 取得対象として扱われる
 */
export async function setManualZoomForSession(params: {
  sessionId: number;
  joinUrl: string;
  hostStaffId: number | null;
  label?: string | null;
}): Promise<{ ok: true; meetingId: number } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  try {
    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
      select: {
        id: true,
        companyRecordId: true,
        category: true,
        scheduledAt: true,
        deletedAt: true,
      },
    });
    if (!session || session.deletedAt) {
      return { ok: false, message: "打ち合わせが見つかりません" };
    }

    const parsed = parseZoomJoinUrl(params.joinUrl);
    if (!parsed.ok) {
      return { ok: false, message: parsed.error };
    }
    const externalMeetingId = parsed.meetingId;

    // 同一 externalMeetingId の既存 ContactHistoryMeeting 確認 (UNIQUE 制約)
    const existingByMeetingId = await prisma.contactHistoryMeeting.findFirst({
      where: {
        provider: "zoom",
        externalMeetingId,
      },
      select: { id: true, contactHistoryId: true, deletedAt: true },
    });
    if (existingByMeetingId) {
      if (!existingByMeetingId.deletedAt) {
        return {
          ok: false,
          message: `このZoom URL（Meeting ID: ${parsed.meetingId}）は既に別の接触履歴 #${existingByMeetingId.contactHistoryId} に登録されています`,
        };
      }
      return {
        ok: false,
        message: `このZoom URL（Meeting ID: ${parsed.meetingId}）は以前に削除されたため再登録できません。別のURLを使用してください。`,
      };
    }

    // V2 接触履歴を確保（なければ作成）
    const contactHistoryV2Id = await ensureContactHistoryV2ForSession(session.id);
    if (!contactHistoryV2Id) {
      return {
        ok: false,
        message:
          "V2 接触履歴の確保に失敗しました（商談セッションに日時が未設定の可能性があります）",
      };
    }

    // 既に primary meeting があるならエラー
    const existingPrimary = await findV2PrimaryMeetingForSession(session.id);
    if (existingPrimary) {
      return {
        ok: false,
        message:
          "既にZoom URLが登録されています。先に削除してから手動URLを設定してください。",
      };
    }

    // hostStaffId が指定されていても、Zoom 連携 (StaffZoomAuth) が無ければ
    // 「連携無しホスト」として扱う (録画自動取得の対象外)。
    let apiIntegrationStatus: "available" | "unavailable_unlinked_host" = "unavailable_unlinked_host";
    if (params.hostStaffId) {
      const integration = await prisma.staffMeetingIntegration.findUnique({
        where: {
          staffId_provider: {
            staffId: params.hostStaffId,
            provider: "zoom",
          },
        },
        select: { disconnectedAt: true },
      });
      if (integration && !integration.disconnectedAt) {
        apiIntegrationStatus = "available";
      }
    }

    const meeting = await prisma.contactHistoryMeeting.create({
      data: {
        contactHistoryId: contactHistoryV2Id,
        provider: "zoom",
        isPrimary: true,
        externalMeetingId,
        joinUrl: parsed.cleanUrl,
        hostStaffId: params.hostStaffId,
        urlSource: "manual_entry",
        urlSetAt: new Date(),
        apiIntegrationStatus,
        label: params.label?.trim() || null,
        scheduledStartAt: session.scheduledAt,
        state: "予定",
      },
      select: { id: true },
    });

    revalidatePath(`/slp/companies/${session.companyRecordId}`);
    return { ok: true, meetingId: meeting.id };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "手動Zoom設定に失敗しました",
    };
  }
}

function buildZoomUrlNoticeBody(params: {
  companyName: string;
  category: "briefing" | "consultation";
  scheduledAt: Date | null;
  staffName: string | null;
  joinUrl: string;
}): string {
  const categoryLabel = params.category === "briefing" ? "概要案内" : "導入希望商談";
  return [
    `${params.companyName} 様`,
    "",
    `${categoryLabel}のZoom URLをご案内いたします。`,
    "",
    `日時: ${params.scheduledAt ? formatJstDateTime(params.scheduledAt) : "未設定"}`,
    `担当: ${params.staffName?.trim() || "未登録"}`,
    `Zoom URL: ${params.joinUrl}`,
    "",
    "当日はこちらのURLからご参加ください。",
  ].join("\n");
}

async function loadZoomUrlNoticeContext(sessionId: number) {
  const session = await prisma.slpMeetingSession.findUnique({
    where: { id: sessionId },
    include: {
      companyRecord: { select: { id: true, companyName: true } },
    },
  });
  if (!session || session.deletedAt) {
    return { ok: false as const, message: "打ち合わせが見つかりません" };
  }

  const meeting = await findV2PrimaryMeetingForSession(session.id);
  if (!meeting?.joinUrl) {
    return { ok: false as const, message: "送信できるZoom URLがまだ登録されていません" };
  }

  const recipientIds = await getNotifiableCustomerLineFriendIds(session.id);
  const lineFriends =
    recipientIds.length > 0
      ? await prisma.slpLineFriend.findMany({
          where: {
            id: { in: recipientIds },
            deletedAt: null,
            uid: { not: "" },
          },
          select: { id: true, uid: true, snsname: true },
        })
      : [];
  const recipients = lineFriends
    .filter((lf) => lf.uid?.trim())
    .map((lf) => ({
      lineFriendId: lf.id,
      uid: lf.uid,
      label: `${lf.id} ${lf.snsname || lf.uid}`.trim(),
    }));

  const staffName = await resolveProlineStaffName({
    staffId: session.assignedStaffId,
    webhookFallback: session.prolineStaffName,
  });

  return {
    ok: true as const,
    session,
    meeting,
    recipients,
    bodyText: buildZoomUrlNoticeBody({
      companyName: session.companyRecord.companyName ?? "（企業名未設定）",
      category: session.category as "briefing" | "consultation",
      scheduledAt: session.scheduledAt,
      staffName,
      joinUrl: meeting.joinUrl,
    }),
  };
}

export async function getZoomUrlNoticeDraft(
  sessionId: number
): Promise<ZoomUrlNoticeDraft> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const ctx = await loadZoomUrlNoticeContext(sessionId);
  if (!ctx.ok) return ctx;
  return {
    ok: true,
    joinUrl: ctx.meeting.joinUrl ?? "",
    bodyText: ctx.bodyText,
    recipients: ctx.recipients,
  };
}

export async function sendZoomUrlNoticeForSession(params: {
  sessionId: number;
  bodyText: string;
  targetLineFriendIds: number[];
}): Promise<{
  ok: boolean;
  sentCount: number;
  failedCount: number;
  results: Array<{ lineFriendId: number; ok: boolean; errorMessage?: string }>;
  message?: string;
}> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  const ctx = await loadZoomUrlNoticeContext(params.sessionId);
  if (!ctx.ok) {
    return { ok: false, sentCount: 0, failedCount: 0, results: [], message: ctx.message };
  }

  const allowedIds = new Set(ctx.recipients.map((r) => r.lineFriendId));
  const targetIds = [...new Set(params.targetLineFriendIds)].filter((id) => allowedIds.has(id));
  if (targetIds.length === 0) {
    return {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      results: [],
      message: "送信対象が選択されていません",
    };
  }

  const bodyText = params.bodyText.trim();
  if (!bodyText) {
    return {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      results: [],
      message: "送信本文が空です",
    };
  }

  const trigger: NotificationTrigger = "regenerated_manual_notice";
  const results: Array<{ lineFriendId: number; ok: boolean; errorMessage?: string }> = [];
  for (const lineFriendId of targetIds) {
    const result = await sendSessionNotification({
      sessionId: params.sessionId,
      recipient: "customer",
      trigger,
      customerLineFriendId: lineFriendId,
      bodyTextOverride: bodyText,
    });
    results.push({
      lineFriendId,
      ok: result.ok,
      errorMessage: result.errorMessage,
    });
  }

  const sentCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - sentCount;
  revalidatePath(`/slp/companies/${ctx.session.companyRecordId}`);
  return { ok: failedCount === 0, sentCount, failedCount, results };
}

export async function markZoomUrlNoticeSkippedForSession(
  sessionId: number
): Promise<{ ok: true; skippedCount: number } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  const ctx = await loadZoomUrlNoticeContext(sessionId);
  if (!ctx.ok) return ctx;

  if (ctx.recipients.length === 0) {
    revalidatePath(`/slp/companies/${ctx.session.companyRecordId}`);
    return { ok: true, skippedCount: 0 };
  }

  const form = ctx.session.category === "briefing" ? ZOOM_GUIDE_FORM : ZOOM_CONSULT_FORM;
  await prisma.slpZoomSendLog.createMany({
    data: ctx.recipients.map((recipient) => ({
      companyRecordId: ctx.session.companyRecordId,
      sessionId: ctx.session.id,
      category: ctx.session.category,
      trigger: "regenerated_manual_notice",
      recipient: "customer",
      uid: recipient.uid,
      formId: ctx.session.category === "briefing" ? "form16" : "form17",
      fieldKey: form.fieldKey,
      bodyText: "スタッフ判断で未送信",
      status: "skipped",
      errorMessage: "スタッフ判断でZoom URL通知を送らない選択",
    })),
  });

  revalidatePath(`/slp/companies/${ctx.session.companyRecordId}`);
  return { ok: true, skippedCount: ctx.recipients.length };
}

/**
 * セッションの primary Zoom を削除（論理削除）。
 * 削除後は「未発行」状態に戻り、「手動発行する」「手動URLを入力する」ボタンが再度使える。
 * Zoom API 連携済みの Recording だった場合は Zoom 側も削除を試みる。
 */
export async function deleteZoomForSession(
  sessionId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, companyRecordId: true, deletedAt: true },
    });
    if (!session || session.deletedAt) {
      return { ok: false, message: "打ち合わせが見つかりません" };
    }

    await cancelZoomMeetingForSession({ sessionId });

    revalidatePath(`/slp/companies/${session.companyRecordId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "削除に失敗しました",
    };
  }
}

/**
 * @deprecated 旧UI互換。新UIは regenerateZoomMeetingBySession を使う。
 * companyRecordId + category で現在アクティブなセッションを探して再発行する。
 */
export async function regenerateZoomMeeting(
  companyRecordId: number,
  category: "briefing" | "consultation"
): Promise<{ ok: true; url: string | null } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);
  try {
    const session = await prisma.slpMeetingSession.findFirst({
      where: {
        companyRecordId,
        category,
        status: "予約中",
        deletedAt: null,
      },
      orderBy: [{ roundNumber: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    if (!session) {
      return {
        ok: false,
        message: "予約中の打ち合わせが見つからないため再発行できません",
      };
    }

    const result = await regenerateZoomForSession({ sessionId: session.id });
    if (!result.ok) {
      return { ok: false, message: result.errorMessage ?? "再発行に失敗しました" };
    }
    revalidatePath(`/slp/companies/${companyRecordId}`);
    return { ok: true, url: result.url };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "予期しないエラー",
    };
  }
}
