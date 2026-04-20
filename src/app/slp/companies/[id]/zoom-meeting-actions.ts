"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  regenerateZoomForSession,
  cancelZoomMeetingForSession,
} from "@/lib/slp/zoom-reservation-handler";
import { ensureContactHistoryForSession } from "@/lib/slp/session-helper";
import { parseZoomJoinUrl } from "@/lib/zoom/url-parser";
import type { SessionCategory } from "@/lib/slp/session-helper";

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
}): Promise<{ ok: true; recordingId: number } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

  try {
    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
      select: {
        id: true,
        companyRecordId: true,
        category: true,
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
    const meetingIdBig = BigInt(parsed.meetingId);

    // 同一 meeting_id の既存Recording確認（UNIQUE制約）
    const existingByMeetingId = await prisma.slpZoomRecording.findUnique({
      where: { zoomMeetingId: meetingIdBig },
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

    // 接触履歴を確保（なければ作成）
    const contactHistory = await ensureContactHistoryForSession(session.id);

    // 既に primary Recording があるならエラー（運用的には削除してから再入力してもらう）
    const existingPrimary = await prisma.slpZoomRecording.findFirst({
      where: {
        contactHistoryId: contactHistory.id,
        isPrimary: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingPrimary) {
      return {
        ok: false,
        message:
          "既にZoom URLが登録されています。先に削除してから手動URLを設定してください。",
      };
    }

    const recording = await prisma.slpZoomRecording.create({
      data: {
        contactHistoryId: contactHistory.id,
        zoomMeetingId: meetingIdBig,
        category: session.category as SessionCategory,
        hostStaffId: params.hostStaffId,
        joinUrl: parsed.cleanUrl,
        isPrimary: true,
        label: params.label?.trim() || null,
        state: "予定",
      },
      select: { id: true },
    });

    revalidatePath(`/slp/companies/${session.companyRecordId}`);
    return { ok: true, recordingId: recording.id };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "手動Zoom設定に失敗しました",
    };
  }
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
