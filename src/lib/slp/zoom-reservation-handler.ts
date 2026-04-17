import { prisma } from "@/lib/prisma";
import {
  createZoomMeeting,
  updateZoomMeeting,
  deleteZoomMeeting,
} from "@/lib/zoom/meeting";
import { logAutomationError } from "@/lib/automation-error";
import { sendSessionNotification } from "./slp-session-notification";
import {
  ensureContactHistoryForSession,
  findPrimaryRecordingForSession,
  type SessionCategory,
} from "./session-helper";

type ZoomCategory = SessionCategory;

// ============================================
// セッションベース Zoom 管理関数（新構造: SlpZoomRecording に統合）
//
// URL情報（joinUrl / zoomMeetingId / scheduledAt / isPrimary / label 等）は
// 全て SlpZoomRecording に乗る。セッション → 接触履歴 → 接触履歴配下の
// primary Recording、という階層で管理する。
// ============================================

/**
 * セッションベースでZoom会議を発行/更新する。
 * - 接触履歴が無ければ作成
 * - primary Recording がなければ新規発行
 * - primary Recording があり担当者変更 → 削除+新規作成（旧primaryは論理削除）
 * - primary Recording があり日時のみ変更 → Zoom API の update
 *
 * skipCustomerNotification=false の場合、成功時に新通知システム(sendSessionNotification)でLINE通知を送る。
 */
export async function ensureZoomMeetingForSession(params: {
  sessionId: number;
  triggerReason: "confirm" | "change";
  skipCustomerNotification?: boolean;
}): Promise<void> {
  const session = await prisma.slpMeetingSession.findUnique({
    where: { id: params.sessionId },
    include: {
      companyRecord: {
        select: {
          id: true,
          companyName: true,
          prolineUid: true,
        },
      },
    },
  });

  if (!session) return;

  const category = session.category as ZoomCategory;
  const categoryJp = category === "briefing" ? "概要案内" : "導入希望商談";
  const topicCompanyName = session.companyRecord.companyName ?? "（企業名未設定）";
  const topic = `${topicCompanyName}様 ${categoryJp}`;

  const staffId = session.assignedStaffId;
  const date = session.scheduledAt;

  // 接触履歴確保（無ければ作成）
  const contactHistory = await ensureContactHistoryForSession(session.id);

  // 現在の primary Recording を取得
  const primary = await prisma.slpZoomRecording.findFirst({
    where: {
      contactHistoryId: contactHistory.id,
      isPrimary: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!staffId || !date) {
    if (primary) {
      await prisma.slpZoomRecording.update({
        where: { id: primary.id },
        data: {
          zoomApiError: "担当者または日時が未設定のためZoom発行できません",
          zoomApiErrorAt: new Date(),
        },
      });
    }
    return;
  }

  try {
    let newMeetingId: bigint;
    let newJoinUrl: string;
    let newStartUrl: string | null = null;
    let newPassword: string | null = null;

    if (!primary) {
      // 初回発行
      const resp = await createZoomMeeting({
        hostStaffId: staffId,
        topic,
        startAtJst: date,
        durationMinutes: 60,
      });
      newMeetingId = BigInt(resp.id);
      newJoinUrl = resp.join_url;
      newStartUrl = resp.start_url ?? null;
      newPassword = resp.password ?? null;

      await prisma.slpZoomRecording.create({
        data: {
          contactHistoryId: contactHistory.id,
          zoomMeetingId: newMeetingId,
          category,
          hostStaffId: staffId,
          joinUrl: newJoinUrl,
          startUrl: newStartUrl,
          password: newPassword,
          scheduledAt: date,
          isPrimary: true,
          state: "予定",
        },
      });
    } else {
      const hostChanged = primary.hostStaffId !== staffId;
      if (hostChanged) {
        // 担当者変更: 旧Zoomを削除して新規作成
        if (primary.hostStaffId) {
          try {
            await deleteZoomMeeting({
              hostStaffId: primary.hostStaffId,
              meetingId: primary.zoomMeetingId,
            });
          } catch (err) {
            await logAutomationError({
              source: "slp-zoom-session-delete-on-host-change",
              message: "担当者変更時の旧Zoom削除失敗（続行）",
              detail: {
                sessionId: session.id,
                error: err instanceof Error ? err.message : String(err),
              },
            });
          }
        }
        const resp = await createZoomMeeting({
          hostStaffId: staffId,
          topic,
          startAtJst: date,
          durationMinutes: 60,
        });
        newMeetingId = BigInt(resp.id);
        newJoinUrl = resp.join_url;
        newStartUrl = resp.start_url ?? null;
        newPassword = resp.password ?? null;

        // 旧primaryを論理削除して新規primary作成
        await prisma.slpZoomRecording.update({
          where: { id: primary.id },
          data: { deletedAt: new Date() },
        });
        await prisma.slpZoomRecording.create({
          data: {
            contactHistoryId: contactHistory.id,
            zoomMeetingId: newMeetingId,
            category,
            hostStaffId: staffId,
            joinUrl: newJoinUrl,
            startUrl: newStartUrl,
            password: newPassword,
            scheduledAt: date,
            isPrimary: true,
            state: "予定",
          },
        });
      } else {
        // 日時等だけの更新（Zoom API のupdateで対応）
        await updateZoomMeeting({
          hostStaffId: staffId,
          meetingId: primary.zoomMeetingId,
          topic,
          startAtJst: date,
          durationMinutes: 60,
        });
        newMeetingId = primary.zoomMeetingId;
        newJoinUrl = primary.joinUrl;
        newStartUrl = primary.startUrl;
        newPassword = primary.password;

        await prisma.slpZoomRecording.update({
          where: { id: primary.id },
          data: {
            scheduledAt: date,
            zoomApiError: null,
            zoomApiErrorAt: null,
          },
        });
      }
    }

    // お客様LINE通知（新システム）
    if (!params.skipCustomerNotification && session.companyRecord.prolineUid) {
      const result = await sendSessionNotification({
        sessionId: session.id,
        recipient: "customer",
        trigger: params.triggerReason,
      });
      if (result.ok && params.triggerReason === "confirm") {
        // 送信済みフラグを primary Recording に立てる
        await prisma.slpZoomRecording.updateMany({
          where: {
            contactHistoryId: contactHistory.id,
            isPrimary: true,
            deletedAt: null,
          },
          data: { confirmSentAt: new Date() },
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logAutomationError({
      source: `slp-zoom-session-${category}-${params.triggerReason}`,
      message: `Zoom発行失敗: ${msg}`,
      detail: {
        sessionId: session.id,
        staffId,
        date: date.toISOString(),
      },
    });

    // primary Recording があればエラーを記録
    const primaryNow = await prisma.slpZoomRecording.findFirst({
      where: {
        contactHistoryId: contactHistory.id,
        isPrimary: true,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (primaryNow) {
      await prisma.slpZoomRecording.update({
        where: { id: primaryNow.id },
        data: {
          zoomApiError: msg.slice(0, 2000),
          zoomApiErrorAt: new Date(),
        },
      });
    }
  }
}

/**
 * セッションの primary Recording を削除する（キャンセル時）。
 * Zoom API の delete を試み、成功/失敗に関わらず DB 上は論理削除する。
 */
export async function cancelZoomMeetingForSession(params: {
  sessionId: number;
}): Promise<void> {
  const primary = await findPrimaryRecordingForSession(params.sessionId);
  if (!primary) return;

  if (primary.hostStaffId) {
    try {
      await deleteZoomMeeting({
        hostStaffId: primary.hostStaffId,
        meetingId: primary.zoomMeetingId,
      });
    } catch (err) {
      await logAutomationError({
        source: "slp-zoom-session-cancel-delete",
        message: "Zoom会議削除失敗（続行・DBは論理削除）",
        detail: {
          sessionId: params.sessionId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  await prisma.slpZoomRecording.update({
    where: { id: primary.id },
    data: { deletedAt: new Date() },
  });
}

/**
 * セッションの Zoom を再発行する（UIの「再発行」ボタン用）。
 * 既存 primary Recording を削除してから ensureZoomMeetingForSession で新規発行。
 * 送信は行わない（スタッフが手動でURLを送付する運用想定）。
 */
export async function regenerateZoomForSession(params: {
  sessionId: number;
}): Promise<{ ok: boolean; url: string | null; errorMessage?: string }> {
  await cancelZoomMeetingForSession({ sessionId: params.sessionId });
  await ensureZoomMeetingForSession({
    sessionId: params.sessionId,
    triggerReason: "change",
    skipCustomerNotification: true,
  });

  const newPrimary = await findPrimaryRecordingForSession(params.sessionId);

  if (!newPrimary) {
    return { ok: false, url: null, errorMessage: "Zoom発行に失敗しました" };
  }
  if (newPrimary.zoomApiError) {
    return {
      ok: false,
      url: newPrimary.joinUrl || null,
      errorMessage: newPrimary.zoomApiError,
    };
  }
  return { ok: true, url: newPrimary.joinUrl };
}
