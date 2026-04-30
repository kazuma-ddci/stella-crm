import { prisma } from "@/lib/prisma";
import {
  createZoomMeeting,
  updateZoomMeeting,
  deleteZoomMeeting,
} from "@/lib/zoom/meeting";
import { logAutomationError } from "@/lib/automation-error";
import { sendSessionNotification } from "./slp-session-notification";
import {
  getNotifiableCustomerLineFriendIds,
  type SessionCategory,
} from "./session-helper";
import {
  ensureContactHistoryV2ForSession,
  findV2PrimaryMeetingForSession,
  markV2MeetingConfirmSentForSession,
  cancelV2ForSession,
} from "./v2-session-sync";

type ZoomCategory = SessionCategory;

export type EnsureZoomMeetingForSessionResult = {
  ok: boolean;
  urlAvailable: boolean;
  meetingId: number | null;
  joinUrl: string | null;
  errorMessage?: string;
  skippedReason?: string;
};

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

async function ensurePlaceholderPrimaryMeeting(params: {
  contactHistoryId: number;
  existing: Awaited<ReturnType<typeof findV2PrimaryMeetingForSession>>;
  hostStaffId: number | null;
  scheduledAt: Date | null;
  errorMessage: string;
}): Promise<number | null> {
  if (params.existing) {
    await prisma.contactHistoryMeeting.update({
      where: { id: params.existing.id },
      data: {
        hostStaffId: params.hostStaffId,
        scheduledStartAt: params.scheduledAt,
        state: "予定",
        apiIntegrationStatus: "unavailable_unlinked_host",
        apiError: params.errorMessage.slice(0, 2000),
        apiErrorAt: new Date(),
      },
    });
    return params.existing.id;
  }

  const created = await prisma.contactHistoryMeeting.create({
    data: {
      contactHistoryId: params.contactHistoryId,
      provider: "zoom",
      isPrimary: true,
      hostStaffId: params.hostStaffId,
      scheduledStartAt: params.scheduledAt,
      urlSource: "empty",
      apiIntegrationStatus: "unavailable_unlinked_host",
      state: "予定",
      apiError: params.errorMessage.slice(0, 2000),
      apiErrorAt: new Date(),
    },
    select: { id: true },
  });
  return created.id;
}

// ============================================
// セッションベース Zoom 管理関数（V2 統一構造）
//
// URL情報（joinUrl / externalMeetingId / scheduledStartAt / hostStaffId 等）は
// 全て V2 ContactHistoryMeeting に乗る。セッション → V2 接触履歴 → V2 primary
// ContactHistoryMeeting、という階層で管理する。
// ============================================

/**
 * セッションベースで Zoom 会議を発行/更新する。
 * - V2 接触履歴が無ければ作成
 * - V2 primary ContactHistoryMeeting がなければ Zoom API で新規発行
 * - 担当者変更 → 旧 Zoom 削除 + 新規発行（旧 meeting は論理削除 + externalMeetingId を null 化）
 * - 日時のみ変更 → Zoom API の update のみ
 *
 * skipCustomerNotification=false の場合、成功時に sendSessionNotification で LINE 通知を送る。
 */
export async function ensureZoomMeetingForSession(params: {
  sessionId: number;
  triggerReason: "confirm" | "change";
  skipCustomerNotification?: boolean;
}): Promise<EnsureZoomMeetingForSessionResult> {
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

  if (!session) {
    return {
      ok: false,
      urlAvailable: false,
      meetingId: null,
      joinUrl: null,
      skippedReason: "session_not_found",
    };
  }

  const category = session.category as ZoomCategory;
  const categoryJp = category === "briefing" ? "概要案内" : "導入希望商談";
  const topicCompanyName = session.companyRecord.companyName ?? "（企業名未設定）";
  const topic = `${topicCompanyName}様 ${categoryJp}`;

  const staffId = session.assignedStaffId;
  const date = session.scheduledAt;

  // V2 接触履歴を確保 (scheduledAt 必須なので未設定なら null)
  const contactHistoryV2Id = await ensureContactHistoryV2ForSession(session.id);

  // 担当者または日時が未設定 → Zoom 発行不可。エラー記録のみ
  if (!staffId || !date) {
    const message = "担当者または日時が未設定のためZoom発行できません";
    const primary = contactHistoryV2Id
      ? await findV2PrimaryMeetingForSession(session.id)
      : null;
    if (contactHistoryV2Id) {
      await prisma.contactHistoryMeeting.updateMany({
        where: {
          contactHistoryId: contactHistoryV2Id,
          isPrimary: true,
          deletedAt: null,
        },
        data: {
          apiError: message,
          apiErrorAt: new Date(),
        },
      });
      await ensurePlaceholderPrimaryMeeting({
        contactHistoryId: contactHistoryV2Id,
        existing: primary,
        hostStaffId: staffId,
        scheduledAt: date,
        errorMessage: message,
      });
    }
    return {
      ok: false,
      urlAvailable: false,
      meetingId: primary?.id ?? null,
      joinUrl: primary?.joinUrl ?? null,
      errorMessage: message,
    };
  }

  if (!contactHistoryV2Id) {
    // 通常ここには到達しないが安全策
    await logAutomationError({
      source: "slp-zoom-session-no-v2-history",
      message: "V2 接触履歴の確保に失敗 (Zoom発行スキップ)",
      detail: { sessionId: session.id },
    });
    return {
      ok: false,
      urlAvailable: false,
      meetingId: null,
      joinUrl: null,
      skippedReason: "v2_history_unavailable",
    };
  }

  // 現在の V2 primary meeting を取得
  const primary = await findV2PrimaryMeetingForSession(session.id);

  try {
    if (!primary) {
      // 初回発行
      const resp = await createZoomMeeting({
        hostStaffId: staffId,
        topic,
        startAtJst: date,
        durationMinutes: 60,
      });
      await prisma.contactHistoryMeeting.create({
        data: {
          contactHistoryId: contactHistoryV2Id,
          provider: "zoom",
          isPrimary: true,
          externalMeetingId: String(resp.id),
          joinUrl: resp.join_url,
          startUrl: resp.start_url ?? null,
          passcode: resp.password ?? null,
          hostStaffId: staffId,
          urlSource: "auto_generated",
          urlSetAt: new Date(),
          apiIntegrationStatus: "available",
          scheduledStartAt: date,
          state: "予定",
        },
      });
    } else {
      const hostChanged = primary.hostStaffId !== staffId;
      if (!primary.externalMeetingId || !primary.joinUrl) {
        const resp = await createZoomMeeting({
          hostStaffId: staffId,
          topic,
          startAtJst: date,
          durationMinutes: 60,
        });
        await prisma.contactHistoryMeeting.update({
          where: { id: primary.id },
          data: {
            externalMeetingId: String(resp.id),
            joinUrl: resp.join_url,
            startUrl: resp.start_url ?? null,
            passcode: resp.password ?? null,
            hostStaffId: staffId,
            urlSource: "auto_generated",
            urlSetAt: new Date(),
            apiIntegrationStatus: "available",
            scheduledStartAt: date,
            state: "予定",
            apiError: null,
            apiErrorAt: null,
          },
        });
      } else if (hostChanged) {
        // 担当者変更: 新 Zoom 作成に成功してから旧 Zoom を削除する。
        // 新ホスト未連携などで作成に失敗した場合、既存の有効URLを壊さないため。
        const resp = await createZoomMeeting({
          hostStaffId: staffId,
          topic,
          startAtJst: date,
          durationMinutes: 60,
        });

        if (primary.hostStaffId && primary.externalMeetingId) {
          try {
            await deleteZoomMeeting({
              hostStaffId: primary.hostStaffId,
              meetingId: BigInt(primary.externalMeetingId),
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

        // 旧 primary を論理削除 + externalMeetingId を null 化 (@@unique 衝突回避)
        await prisma.contactHistoryMeeting.update({
          where: { id: primary.id },
          data: {
            deletedAt: new Date(),
            isPrimary: false,
            externalMeetingId: null,
            externalMeetingUuid: null,
            state: "キャンセル",
          },
        });
        await prisma.contactHistoryMeeting.create({
          data: {
            contactHistoryId: contactHistoryV2Id,
            provider: "zoom",
            isPrimary: true,
            externalMeetingId: String(resp.id),
            joinUrl: resp.join_url,
            startUrl: resp.start_url ?? null,
            passcode: resp.password ?? null,
            hostStaffId: staffId,
            urlSource: "auto_generated",
            urlSetAt: new Date(),
            apiIntegrationStatus: "available",
            scheduledStartAt: date,
            state: "予定",
          },
        });
      } else {
        // 日時等だけの更新（Zoom API の update で対応）
        if (!primary.externalMeetingId) {
          throw new Error("primary meeting に externalMeetingId が無いため update できません");
        }
        await updateZoomMeeting({
          hostStaffId: staffId,
          meetingId: BigInt(primary.externalMeetingId),
          topic,
          startAtJst: date,
          durationMinutes: 60,
        });
        await prisma.contactHistoryMeeting.update({
          where: { id: primary.id },
          data: {
            scheduledStartAt: date,
            apiError: null,
            apiErrorAt: null,
          },
        });
      }
    }

    // お客様 LINE 通知（予約者 + フラグONの全担当者に送信）
    if (!params.skipCustomerNotification && session.companyRecord.prolineUid) {
      const lineFriendIds = await getNotifiableCustomerLineFriendIds(session.id);
      let anySucceeded = false;
      for (const lineFriendId of lineFriendIds) {
        const result = await sendSessionNotification({
          sessionId: session.id,
          recipient: "customer",
          trigger: params.triggerReason,
          customerLineFriendId: lineFriendId,
        });
        if (result.ok) anySucceeded = true;
      }
      if (anySucceeded && params.triggerReason === "confirm") {
        await markV2MeetingConfirmSentForSession(session.id);
      }
    }
    const ready = await findV2PrimaryMeetingForSession(session.id);
    const urlAvailable =
      !!ready?.joinUrl &&
      ready.hostStaffId === staffId &&
      sameInstant(ready.scheduledStartAt, date) &&
      !ready.apiError;
    return {
      ok: urlAvailable,
      urlAvailable,
      meetingId: ready?.id ?? null,
      joinUrl: ready?.joinUrl ?? null,
      ...(urlAvailable ? {} : { errorMessage: ready?.apiError ?? "Zoom URLが未発行です" }),
    };
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

    const currentPrimary = await findV2PrimaryMeetingForSession(session.id);
    await ensurePlaceholderPrimaryMeeting({
      contactHistoryId: contactHistoryV2Id,
      existing: currentPrimary,
      hostStaffId: staffId,
      scheduledAt: date,
      errorMessage: msg,
    });
    // V2 primary meeting にエラーを記録
    await prisma.contactHistoryMeeting.updateMany({
      where: {
        contactHistoryId: contactHistoryV2Id,
        isPrimary: true,
        deletedAt: null,
      },
      data: {
        apiError: msg.slice(0, 2000),
        apiErrorAt: new Date(),
      },
    });
    const failedPrimary = await findV2PrimaryMeetingForSession(session.id);
    return {
      ok: false,
      urlAvailable: false,
      meetingId: failedPrimary?.id ?? null,
      joinUrl: failedPrimary?.joinUrl ?? null,
      errorMessage: msg,
    };
  }
}

/**
 * セッションの primary meeting を削除する（キャンセル時）。
 * Zoom API の delete を試み、成功/失敗に関わらず DB 上は論理削除する。
 * V2 接触履歴側も status="cancelled" に同期する。
 */
export async function cancelZoomMeetingForSession(params: {
  sessionId: number;
}): Promise<void> {
  const primary = await findV2PrimaryMeetingForSession(params.sessionId);

  if (primary && primary.hostStaffId && primary.externalMeetingId) {
    try {
      await deleteZoomMeeting({
        hostStaffId: primary.hostStaffId,
        meetingId: BigInt(primary.externalMeetingId),
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

  // V2 接触履歴・meeting をキャンセル状態へ
  await cancelV2ForSession(params.sessionId);
}

/**
 * セッションの Zoom を再発行する（UIの「再発行」ボタン用）。
 * 既存 primary meeting を削除してから ensureZoomMeetingForSession で新規発行。
 * 送信は行わない（スタッフが手動で URL を送付する運用想定）。
 */
export async function regenerateZoomForSession(params: {
  sessionId: number;
}): Promise<{ ok: boolean; url: string | null; errorMessage?: string }> {
  await cancelZoomMeetingForSession({ sessionId: params.sessionId });
  const result = await ensureZoomMeetingForSession({
    sessionId: params.sessionId,
    triggerReason: "change",
    skipCustomerNotification: true,
  });

  const newPrimary = await findV2PrimaryMeetingForSession(params.sessionId);

  if (!newPrimary) {
    return { ok: false, url: null, errorMessage: "Zoom発行に失敗しました" };
  }
  if (!result.urlAvailable || newPrimary.apiError) {
    return {
      ok: false,
      url: newPrimary.joinUrl || null,
      errorMessage: newPrimary.apiError ?? result.errorMessage,
    };
  }
  return { ok: true, url: newPrimary.joinUrl };
}
