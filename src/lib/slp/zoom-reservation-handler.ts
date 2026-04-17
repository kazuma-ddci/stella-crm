import { prisma } from "@/lib/prisma";
import {
  createZoomMeeting,
  updateZoomMeeting,
  deleteZoomMeeting,
} from "@/lib/zoom/meeting";
import { logAutomationError } from "@/lib/automation-error";
import { sendSessionNotification } from "./slp-session-notification";
import type { SessionCategory } from "./session-helper";

type ZoomCategory = SessionCategory;

// ============================================
// セッションベース Zoom 管理関数
// SlpMeetingSession + SlpMeetingSessionZoom に対して Zoom API を呼び出す
// ============================================

/**
 * セッションベースでZoom会議を発行/更新する。
 * - primary Zoom がなければ新規発行
 * - primary Zoom があり担当者変更 → 削除+新規作成
 * - primary Zoom があり日時のみ変更 → Zoom API の update
 * - 発行情報は SlpMeetingSessionZoom の primary レコードに保存
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
      zoomRecords: {
        where: { isPrimary: true, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
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
  const primaryZoom = session.zoomRecords[0] ?? null;

  if (!staffId || !date) {
    if (primaryZoom) {
      await prisma.slpMeetingSessionZoom.update({
        where: { id: primaryZoom.id },
        data: {
          zoomError: "担当者または日時が未設定のためZoom発行できません",
          zoomErrorAt: new Date(),
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

    if (!primaryZoom) {
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

      await prisma.slpMeetingSessionZoom.create({
        data: {
          sessionId: session.id,
          zoomMeetingId: newMeetingId,
          joinUrl: newJoinUrl,
          startUrl: newStartUrl,
          password: newPassword,
          hostStaffId: staffId,
          scheduledAt: date,
          isPrimary: true,
        },
      });
    } else {
      const hostChanged = primaryZoom.hostStaffId !== staffId;
      if (hostChanged) {
        // 担当者変更: 旧Zoomを削除して新規作成
        if (primaryZoom.hostStaffId) {
          try {
            await deleteZoomMeeting({
              hostStaffId: primaryZoom.hostStaffId,
              meetingId: primaryZoom.zoomMeetingId,
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
        await prisma.slpMeetingSessionZoom.update({
          where: { id: primaryZoom.id },
          data: { deletedAt: new Date() },
        });
        await prisma.slpMeetingSessionZoom.create({
          data: {
            sessionId: session.id,
            zoomMeetingId: newMeetingId,
            joinUrl: newJoinUrl,
            startUrl: newStartUrl,
            password: newPassword,
            hostStaffId: staffId,
            scheduledAt: date,
            isPrimary: true,
          },
        });
      } else {
        // 日時等だけの更新（Zoom API のupdateで対応）
        await updateZoomMeeting({
          hostStaffId: staffId,
          meetingId: primaryZoom.zoomMeetingId,
          topic,
          startAtJst: date,
          durationMinutes: 60,
        });
        newMeetingId = primaryZoom.zoomMeetingId;
        newJoinUrl = primaryZoom.joinUrl;
        newStartUrl = primaryZoom.startUrl;
        newPassword = primaryZoom.password;

        await prisma.slpMeetingSessionZoom.update({
          where: { id: primaryZoom.id },
          data: {
            scheduledAt: date,
            zoomError: null,
            zoomErrorAt: null,
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
        // 送信済みフラグを primary zoom に立てる
        await prisma.slpMeetingSessionZoom.updateMany({
          where: {
            sessionId: session.id,
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

    // primary Zoom があればエラーを記録（なければ新規作成してエラーだけ持たせる）
    const primary = await prisma.slpMeetingSessionZoom.findFirst({
      where: { sessionId: session.id, isPrimary: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (primary) {
      await prisma.slpMeetingSessionZoom.update({
        where: { id: primary.id },
        data: {
          zoomError: msg.slice(0, 2000),
          zoomErrorAt: new Date(),
        },
      });
    }
  }
}

/**
 * セッションの primary Zoom を削除する（キャンセル時）。
 * Zoom API の delete を試み、成功/失敗に関わらず DB 上は論理削除する。
 */
export async function cancelZoomMeetingForSession(params: {
  sessionId: number;
}): Promise<void> {
  const primaryZoom = await prisma.slpMeetingSessionZoom.findFirst({
    where: {
      sessionId: params.sessionId,
      isPrimary: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!primaryZoom) return;

  if (primaryZoom.hostStaffId) {
    try {
      await deleteZoomMeeting({
        hostStaffId: primaryZoom.hostStaffId,
        meetingId: primaryZoom.zoomMeetingId,
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

  await prisma.slpMeetingSessionZoom.update({
    where: { id: primaryZoom.id },
    data: { deletedAt: new Date() },
  });
}

/**
 * セッションの Zoom を再発行する（UIの「再発行」ボタン用）。
 * 既存 primary Zoom を削除してから ensureZoomMeetingForSession で新規発行。
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

  const newPrimary = await prisma.slpMeetingSessionZoom.findFirst({
    where: {
      sessionId: params.sessionId,
      isPrimary: true,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!newPrimary) {
    return { ok: false, url: null, errorMessage: "Zoom発行に失敗しました" };
  }
  if (newPrimary.zoomError) {
    return {
      ok: false,
      url: newPrimary.joinUrl || null,
      errorMessage: newPrimary.zoomError,
    };
  }
  return { ok: true, url: newPrimary.joinUrl };
}

