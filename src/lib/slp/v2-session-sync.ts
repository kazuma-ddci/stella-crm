/**
 * SLP 商談セッション ↔ V2 接触履歴 (ContactHistoryV2 + ContactHistoryMeeting) 同期。
 *
 * 商談タブのバックエンド (slp_meeting_sessions) は引き続き使い続けるが、接触履歴・録画は
 * V2 階層 (ContactHistoryV2 → ContactHistoryMeeting → ContactHistoryMeetingRecord) に
 * 完全移行済み。Zoom 発行・予約変更・キャンセル・完了等のタイミングで V2 接触履歴 + V2
 * ContactHistoryMeeting を作成・更新する。
 *
 * 紐付け: ContactHistoryV2.sourceType = "slp_meeting_session", sourceRefId = String(sessionId)
 */

import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

export const SOURCE_TYPE = "slp_meeting_session";

async function getSlpProjectId(): Promise<number | null> {
  const project = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });
  return project?.id ?? null;
}

function makeTitle(companyName: string | null, category: string, roundNumber: number): string {
  const categoryName = category === "briefing" ? "概要案内" : "導入希望商談";
  const company = companyName ?? "（企業名未設定）";
  return `${company}様 ${categoryName} (R${roundNumber})`;
}

/**
 * 商談セッションに対応する V2 接触履歴を確保（無ければ作成、あれば最新化）。
 * scheduledAt が未設定の場合は何もしない（未予約状態は V2 化しない）。
 */
export async function ensureContactHistoryV2ForSession(sessionId: number): Promise<number | null> {
  try {
    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: sessionId },
      include: {
        companyRecord: {
          select: { id: true, companyName: true },
        },
      },
    });
    if (!session) return null;
    if (!session.scheduledAt) return null;

    const slpProjectId = await getSlpProjectId();
    if (!slpProjectId) return null;

    const categoryName = session.category === "briefing" ? "概要案内" : "導入希望商談";
    const category = await prisma.contactCategory.findFirst({
      where: { name: categoryName, projectId: slpProjectId },
      select: { id: true },
    });

    const title = makeTitle(session.companyRecord.companyName, session.category, session.roundNumber);

    const existing = await prisma.contactHistoryV2.findFirst({
      where: {
        sourceType: SOURCE_TYPE,
        sourceRefId: String(sessionId),
        deletedAt: null,
      },
      include: {
        staffParticipants: true,
        customerParticipants: true,
      },
    });

    if (!existing) {
      // race condition 対策: create が衝突した場合 (P2002) は再 findFirst で既存取得
      try {
        const created = await prisma.contactHistoryV2.create({
          data: {
            projectId: slpProjectId,
            status: "scheduled",
            title,
            scheduledStartAt: session.scheduledAt,
            contactCategoryId: category?.id ?? null,
            sourceType: SOURCE_TYPE,
            sourceRefId: String(sessionId),
            customerParticipants: {
              create: {
                targetType: "slp_company_record",
                targetId: session.companyRecord.id,
                isPrimary: true,
              },
            },
            staffParticipants: session.assignedStaffId
              ? {
                  create: {
                    staffId: session.assignedStaffId,
                    isHost: true,
                  },
                }
              : undefined,
          },
        });
        return created.id;
      } catch (createErr) {
        const retry = await prisma.contactHistoryV2.findFirst({
          where: {
            sourceType: SOURCE_TYPE,
            sourceRefId: String(sessionId),
            deletedAt: null,
          },
          select: { id: true },
        });
        if (retry) return retry.id;
        throw createErr;
      }
    }

    // 既存の最新化
    const updates: {
      title?: string;
      scheduledStartAt?: Date;
      contactCategoryId?: number | null;
      status?: string;
    } = {};
    if (existing.title !== title) updates.title = title;
    if (existing.scheduledStartAt.getTime() !== session.scheduledAt.getTime()) {
      updates.scheduledStartAt = session.scheduledAt;
    }
    if (existing.contactCategoryId !== (category?.id ?? null)) {
      updates.contactCategoryId = category?.id ?? null;
    }
    // セッションが予約中に戻ったときは V2 status も scheduled に戻す
    const reactivating = existing.status === "cancelled" || existing.status === "completed";
    if (reactivating) {
      updates.status = "scheduled";
    }
    if (Object.keys(updates).length > 0) {
      await prisma.contactHistoryV2.update({
        where: { id: existing.id },
        data: {
          ...updates,
          ...(updates.status === "scheduled"
            ? {
                cancelledAt: null,
                cancelledReason: null,
                actualEndAt: null,
              }
            : {}),
        },
      });
    }

    // ホスト担当者の同期
    const currentHost = existing.staffParticipants.find((p) => p.isHost);

    if (session.assignedStaffId) {
      const sameHost = currentHost?.staffId === session.assignedStaffId;

      if (!sameHost) {
        if (currentHost) {
          await prisma.contactStaffParticipant.update({
            where: { id: currentHost.id },
            data: { isHost: false },
          });
        }
        const sameStaff = existing.staffParticipants.find(
          (p) => p.staffId === session.assignedStaffId,
        );
        if (sameStaff) {
          await prisma.contactStaffParticipant.update({
            where: { id: sameStaff.id },
            data: { isHost: true },
          });
        } else {
          await prisma.contactStaffParticipant.create({
            data: {
              contactHistoryId: existing.id,
              staffId: session.assignedStaffId,
              isHost: true,
            },
          });
        }
      }
    } else if (currentHost) {
      // 担当者が null になった場合: 既存ホストの isHost を剥がす
      await prisma.contactStaffParticipant.update({
        where: { id: currentHost.id },
        data: { isHost: false },
      });
    }

    return existing.id;
  } catch (e) {
    await logAutomationError({
      source: "slp-v2-sync-ensure-history",
      message: `V2 接触履歴の確保失敗: sessionId=${sessionId}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
    return null;
  }
}

/**
 * 商談セッションの primary Zoom を V2 ContactHistoryMeeting に upsert。
 * Zoom 発行成功後に呼ぶ。zoomMeetingId が変わっていれば旧 meeting を論理削除して新規作成。
 */
export async function upsertV2MeetingForSession(params: {
  sessionId: number;
  zoomMeetingId: bigint;
  joinUrl: string;
  startUrl: string | null;
  password: string | null;
  hostStaffId: number;
  scheduledAt: Date;
}): Promise<void> {
  try {
    const contactHistoryId = await ensureContactHistoryV2ForSession(params.sessionId);
    if (!contactHistoryId) return;

    const externalMeetingId = params.zoomMeetingId.toString();

    const existing = await prisma.contactHistoryMeeting.findFirst({
      where: {
        contactHistoryId,
        isPrimary: true,
        provider: "zoom",
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    const baseData = {
      provider: "zoom",
      isPrimary: true,
      externalMeetingId,
      joinUrl: params.joinUrl,
      startUrl: params.startUrl,
      passcode: params.password,
      hostStaffId: params.hostStaffId,
      urlSource: "auto_generated",
      urlSetAt: new Date(),
      apiIntegrationStatus: "available",
      scheduledStartAt: params.scheduledAt,
      state: "予定",
    } as const;

    if (!existing) {
      await prisma.contactHistoryMeeting.create({
        data: {
          contactHistoryId,
          ...baseData,
        },
      });
      return;
    }

    if (existing.externalMeetingId !== externalMeetingId) {
      // Zoom Meeting ID が変わった = ホスト変更で再発行 → 旧 meeting 論理削除して新規作成
      // @@unique([provider, externalMeetingId]) の衝突を避けるため、
      // 旧 meeting の externalMeetingId を null + isPrimary=false に変更してから新規作成
      await prisma.contactHistoryMeeting.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
          isPrimary: false,
          externalMeetingId: null,
          externalMeetingUuid: null,
        },
      });
      await prisma.contactHistoryMeeting.create({
        data: {
          contactHistoryId,
          ...baseData,
        },
      });
    } else {
      // 同じ meeting の日時等更新
      await prisma.contactHistoryMeeting.update({
        where: { id: existing.id },
        data: {
          joinUrl: params.joinUrl,
          startUrl: params.startUrl,
          passcode: params.password,
          hostStaffId: params.hostStaffId,
          scheduledStartAt: params.scheduledAt,
          apiError: null,
          apiErrorAt: null,
        },
      });
    }
  } catch (e) {
    await logAutomationError({
      source: "slp-v2-sync-upsert-meeting",
      message: `V2 meeting の upsert 失敗: sessionId=${params.sessionId}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
  }
}

/**
 * Zoom 発行エラーを V2 meeting にも反映。
 * primary meeting がなければ何もしない（V2 接触履歴は ensure 経由で作る前提）。
 */
export async function recordV2MeetingApiErrorForSession(
  sessionId: number,
  errorMessage: string,
): Promise<void> {
  try {
    const ch = await prisma.contactHistoryV2.findFirst({
      where: {
        sourceType: SOURCE_TYPE,
        sourceRefId: String(sessionId),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!ch) return;
    await prisma.contactHistoryMeeting.updateMany({
      where: {
        contactHistoryId: ch.id,
        isPrimary: true,
        deletedAt: null,
      },
      data: {
        apiError: errorMessage.slice(0, 2000),
        apiErrorAt: new Date(),
      },
    });
  } catch (e) {
    await logAutomationError({
      source: "slp-v2-sync-record-error",
      message: `V2 meeting エラー反映失敗: sessionId=${sessionId}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
  }
}

/**
 * 商談セッションのキャンセルを V2 接触履歴に反映。
 * V2 接触履歴 status="cancelled" + meeting state="キャンセル" + 論理削除。
 */
export async function cancelV2ForSession(sessionId: number, reason?: string): Promise<void> {
  try {
    const ch = await prisma.contactHistoryV2.findFirst({
      where: {
        sourceType: SOURCE_TYPE,
        sourceRefId: String(sessionId),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!ch) return;

    await prisma.contactHistoryV2.update({
      where: { id: ch.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledReason: reason ?? null,
      },
    });

    await prisma.contactHistoryMeeting.updateMany({
      where: {
        contactHistoryId: ch.id,
        deletedAt: null,
      },
      data: {
        state: "キャンセル",
        deletedAt: new Date(),
      },
    });
  } catch (e) {
    await logAutomationError({
      source: "slp-v2-sync-cancel",
      message: `V2 接触履歴のキャンセル反映失敗: sessionId=${sessionId}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
  }
}

/**
 * 商談セッションの完了を V2 接触履歴に反映。
 */
export async function completeV2ForSession(sessionId: number): Promise<void> {
  try {
    const ch = await prisma.contactHistoryV2.findFirst({
      where: {
        sourceType: SOURCE_TYPE,
        sourceRefId: String(sessionId),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!ch) return;

    await prisma.contactHistoryV2.update({
      where: { id: ch.id },
      data: {
        status: "completed",
        actualEndAt: new Date(),
      },
    });
  } catch (e) {
    await logAutomationError({
      source: "slp-v2-sync-complete",
      message: `V2 接触履歴の完了反映失敗: sessionId=${sessionId}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
  }
}

// ============================================================
// セッション → V2 リソース 解決ヘルパー
// V1 SlpZoomRecording / SlpContactHistory への依存を断つため、
// 「sessionId 起点で V2 接触履歴 / V2 primary meeting を取得する」
// 関数を提供する。
// ============================================================

/**
 * セッションに対応する V2 接触履歴を取得（無ければ null）。
 * 作成は伴わない。Zoom 発行のサイドエフェクト等で使う。
 */
export async function findV2ContactHistoryForSession(sessionId: number) {
  return prisma.contactHistoryV2.findFirst({
    where: {
      sourceType: SOURCE_TYPE,
      sourceRefId: String(sessionId),
      deletedAt: null,
    },
  });
}

/**
 * セッションに対応する V2 primary ContactHistoryMeeting を取得（無ければ null）。
 * primary = isPrimary: true, provider: "zoom", deletedAt: null
 */
export async function findV2PrimaryMeetingForSession(sessionId: number) {
  const ch = await findV2ContactHistoryForSession(sessionId);
  if (!ch) return null;
  return prisma.contactHistoryMeeting.findFirst({
    where: {
      contactHistoryId: ch.id,
      isPrimary: true,
      provider: "zoom",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 予約確定通知の送信済みフラグを V2 primary meeting に立てる。
 */
export async function markV2MeetingConfirmSentForSession(sessionId: number): Promise<void> {
  try {
    const ch = await findV2ContactHistoryForSession(sessionId);
    if (!ch) return;
    await prisma.contactHistoryMeeting.updateMany({
      where: {
        contactHistoryId: ch.id,
        isPrimary: true,
        deletedAt: null,
      },
      data: { confirmSentAt: new Date() },
    });
  } catch (e) {
    await logAutomationError({
      source: "slp-v2-sync-mark-confirm-sent",
      message: `V2 meeting confirmSentAt 更新失敗: sessionId=${sessionId}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
  }
}
