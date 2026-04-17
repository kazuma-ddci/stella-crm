"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  calcNextRoundNumber,
  createSession,
  changeSessionStatus as helperChangeSessionStatus,
  updateSessionFields as helperUpdateSessionFields,
  softDeleteSession as helperSoftDeleteSession,
  hasSubsequentRound,
  type SessionCategory,
  type SessionStatus,
} from "@/lib/slp/session-helper";
import {
  handleSessionReservationSideEffects,
  handleSessionStatusChangeSideEffects,
} from "@/lib/slp/session-lifecycle";
import {
  submitForm11BriefingThankYou,
  submitForm13ConsultationThankYou,
} from "@/lib/proline-form";
import { logAutomationError } from "@/lib/automation-error";
import { sendSessionNotification } from "@/lib/slp/slp-session-notification";
import { cancelZoomMeetingForSession } from "@/lib/slp/zoom-reservation-handler";

// ============================================
// Type definitions
// ============================================

export interface SessionSummary {
  id: number;
  category: SessionCategory;
  roundNumber: number;
  status: SessionStatus;
  source: "proline" | "manual";
  scheduledAt: Date | null;
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  noShowAt: Date | null;
  createdAt: Date;
}

export interface SessionDetail extends SessionSummary {
  notes: string | null;
  prolineReservationId: string | null;
  bookedAt: Date | null;
  cancelReason: string | null;
  noShowReason: string | null;
  createdByStaffId: number | null;
  createdByStaffName: string | null;
  zoomRecords: SessionZoomRecord[];
}

export interface SessionZoomRecord {
  id: number;
  zoomMeetingId: string; // BigIntをStringで返す
  joinUrl: string;
  startUrl: string | null;
  scheduledAt: Date | null;
  isPrimary: boolean;
  label: string | null;
  hostStaffId: number | null;
  hostStaffName: string | null;
  hasRecording: boolean;
  createdAt: Date;
}

export interface SessionHistoryEntry {
  id: number;
  changeType: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: Date;
  changedByStaffId: number | null;
  changedByStaffName: string | null;
}

// ============================================
// 読み取り系
// ============================================

/**
 * 企業の全セッション一覧取得（プルダウン・一覧表示用）
 */
export async function listSessionsForCompany(
  companyRecordId: number
): Promise<ActionResult<{ briefing: SessionSummary[]; consultation: SessionSummary[] }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

    const sessions = await prisma.slpMeetingSession.findMany({
      where: { companyRecordId, deletedAt: null },
      orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
      include: {
        assignedStaff: { select: { id: true, name: true } },
      },
    });

    const toSummary = (s: (typeof sessions)[number]): SessionSummary => ({
      id: s.id,
      category: s.category as SessionCategory,
      roundNumber: s.roundNumber,
      status: s.status as SessionStatus,
      source: s.source as "proline" | "manual",
      scheduledAt: s.scheduledAt,
      assignedStaffId: s.assignedStaffId,
      assignedStaffName: s.assignedStaff?.name ?? null,
      completedAt: s.completedAt,
      cancelledAt: s.cancelledAt,
      noShowAt: s.noShowAt,
      createdAt: s.createdAt,
    });

    return ok({
      briefing: sessions.filter(s => s.category === "briefing").map(toSummary),
      consultation: sessions.filter(s => s.category === "consultation").map(toSummary),
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "セッション一覧取得に失敗しました");
  }
}

/**
 * セッション詳細取得（Zoom記録含む）
 */
export async function getSessionDetail(
  sessionId: number
): Promise<ActionResult<SessionDetail>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: sessionId },
      include: {
        assignedStaff: { select: { id: true, name: true } },
        createdByStaff: { select: { id: true, name: true } },
        zoomRecords: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          include: {
            hostStaff: { select: { id: true, name: true } },
            recordings: { select: { id: true } },
          },
        },
      },
    });

    if (!session || session.deletedAt) {
      return err("セッションが見つかりません");
    }

    return ok({
      id: session.id,
      category: session.category as SessionCategory,
      roundNumber: session.roundNumber,
      status: session.status as SessionStatus,
      source: session.source as "proline" | "manual",
      scheduledAt: session.scheduledAt,
      assignedStaffId: session.assignedStaffId,
      assignedStaffName: session.assignedStaff?.name ?? null,
      completedAt: session.completedAt,
      cancelledAt: session.cancelledAt,
      noShowAt: session.noShowAt,
      notes: session.notes,
      prolineReservationId: session.prolineReservationId,
      bookedAt: session.bookedAt,
      cancelReason: session.cancelReason,
      noShowReason: session.noShowReason,
      createdByStaffId: session.createdByStaffId,
      createdByStaffName: session.createdByStaff?.name ?? null,
      createdAt: session.createdAt,
      zoomRecords: session.zoomRecords.map(z => ({
        id: z.id,
        zoomMeetingId: z.zoomMeetingId.toString(),
        joinUrl: z.joinUrl,
        startUrl: z.startUrl,
        scheduledAt: z.scheduledAt,
        isPrimary: z.isPrimary,
        label: z.label,
        hostStaffId: z.hostStaffId,
        hostStaffName: z.hostStaff?.name ?? null,
        hasRecording: z.recordings.length > 0,
        createdAt: z.createdAt,
      })),
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "セッション詳細取得に失敗しました");
  }
}

/**
 * セッション変更履歴取得（SlpMeetingSessionHistory + SlpReservationHistory を統合）
 * webhook 由来の変更は SlpReservationHistory に、スタッフ操作は SlpMeetingSessionHistory に記録される
 */
export async function getSessionHistory(
  sessionId: number
): Promise<ActionResult<SessionHistoryEntry[]>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: sessionId },
      select: { companyRecordId: true, category: true, prolineReservationId: true },
    });

    const [sessionHistories, reservationHistories] = await Promise.all([
      prisma.slpMeetingSessionHistory.findMany({
        where: { sessionId },
        orderBy: { changedAt: "desc" },
        include: {
          changedByStaff: { select: { id: true, name: true } },
        },
      }),
      // 同じ予約IDの webhook 履歴を含める（存在すれば）
      session?.prolineReservationId
        ? prisma.slpReservationHistory.findMany({
            where: {
              reservationId: session.prolineReservationId,
              reservationType: session.category,
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    const entries: SessionHistoryEntry[] = [
      ...sessionHistories.map(h => ({
        id: h.id,
        changeType: h.changeType,
        fieldName: h.fieldName,
        oldValue: h.oldValue,
        newValue: h.newValue,
        reason: h.reason,
        changedAt: h.changedAt,
        changedByStaffId: h.changedByStaffId,
        changedByStaffName: h.changedByStaff?.name ?? null,
      })),
      ...reservationHistories.map(r => {
        // JST表記で整形（formatValue の ISO 正規表現判定に巻き込まれないよう回避）
        const reservedAtJst = r.reservedAt
          ? (() => {
              const d = new Date(r.reservedAt.getTime() + 9 * 60 * 60 * 1000);
              const y = d.getUTCFullYear();
              const m = String(d.getUTCMonth() + 1).padStart(2, "0");
              const day = String(d.getUTCDate()).padStart(2, "0");
              const h = String(d.getUTCHours()).padStart(2, "0");
              const min = String(d.getUTCMinutes()).padStart(2, "0");
              return `${y}/${m}/${day} ${h}:${min}`;
            })()
          : null;
        const parts: string[] = [];
        if (reservedAtJst) parts.push(`実施予定: ${reservedAtJst}`);
        if (r.staffName) parts.push(`担当: ${r.staffName}`);
        return {
          id: -r.id, // 重複回避のため負数（SessionHistory と区別）
          changeType: "proline_webhook",
          fieldName: r.actionType, // "予約" | "変更" | "キャンセル"
          oldValue: null,
          newValue: parts.join(" / ") || null,
          reason: `プロライン ${r.actionType}（予約ID: ${r.reservationId ?? "—"}）`,
          changedAt: r.createdAt,
          changedByStaffId: null,
          changedByStaffName: null,
        };
      }),
    ];

    entries.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

    return ok(entries);
  } catch (e) {
    return err(e instanceof Error ? e.message : "履歴取得に失敗しました");
  }
}

// getCompanySessionAlerts は MeetingSessionsSection が直接 prisma で取得しているため削除
// （detectDuplicateActiveSessions / getNoShowCount は session-helper.ts に残置、他の用途で使用想定）

// ============================================
// 書き込み系
// ============================================

/**
 * 手動セット: 日時・担当者を指定して「予約中」セッションを作成
 *
 * 注: このSub 4時点ではセッション作成のみ実施。Zoom発行はPhase 3で連携。
 */
export async function createManualSession(params: {
  companyRecordId: number;
  category: SessionCategory;
  scheduledAt: Date;
  assignedStaffId: number;
  notes?: string;
  /** 紹介者通知チェックボックス。1回目の概要案内で有効 */
  notifyReferrer?: boolean;
}): Promise<ActionResult<{ sessionId: number; roundNumber: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    // 並列予約禁止チェック
    const activeCount = await prisma.slpMeetingSession.count({
      where: {
        companyRecordId: params.companyRecordId,
        category: params.category,
        status: { in: ["未予約", "予約中"] },
        deletedAt: null,
      },
    });
    if (activeCount > 0) {
      return err(
        "既に予約中または未予約のセッションがあります。先にそちらを完了・キャンセル・削除してください"
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return createSession(
        {
          companyRecordId: params.companyRecordId,
          category: params.category,
          status: "予約中",
          source: "manual",
          scheduledAt: params.scheduledAt,
          assignedStaffId: params.assignedStaffId,
          notes: params.notes ?? null,
          createdByStaffId: user.id,
          bookedAt: new Date(),
        },
        tx
      );
    });

    // Zoom発行 + 通知（失敗してもセッション作成は維持）
    await handleSessionReservationSideEffects({
      sessionId: result.id,
      companyRecordId: params.companyRecordId,
      category: params.category,
      triggerReason: "confirm",
      roundNumber: result.roundNumber,
      notifyReferrer: params.notifyReferrer ?? false,
    });

    revalidatePath(`/slp/companies/${params.companyRecordId}`);
    return ok({ sessionId: result.id, roundNumber: result.roundNumber });
  } catch (e) {
    return err(e instanceof Error ? e.message : "手動セットに失敗しました");
  }
}

/**
 * 未予約セッション起票: 日時未定のまま「次回予定」をマーキング
 */
export async function createPendingSession(params: {
  companyRecordId: number;
  category: SessionCategory;
  notes?: string;
}): Promise<ActionResult<{ sessionId: number; roundNumber: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const activeCount = await prisma.slpMeetingSession.count({
      where: {
        companyRecordId: params.companyRecordId,
        category: params.category,
        status: { in: ["未予約", "予約中"] },
        deletedAt: null,
      },
    });
    if (activeCount > 0) {
      return err(
        "既に予約中または未予約のセッションがあります。先にそちらを完了・キャンセル・削除してください"
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return createSession(
        {
          companyRecordId: params.companyRecordId,
          category: params.category,
          status: "未予約",
          source: "manual",
          notes: params.notes ?? null,
          createdByStaffId: user.id,
        },
        tx
      );
    });

    revalidatePath(`/slp/companies/${params.companyRecordId}`);
    return ok({ sessionId: result.id, roundNumber: result.roundNumber });
  } catch (e) {
    return err(e instanceof Error ? e.message : "未予約起票に失敗しました");
  }
}

/**
 * 未予約 → 予約中 へ昇格: 日時・担当者を入力して予約確定扱いに
 */
export async function promotePendingToReserved(params: {
  sessionId: number;
  scheduledAt: Date;
  assignedStaffId: number;
  notifyReferrer?: boolean;
}): Promise<ActionResult<{ sessionId: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const current = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!current || current.deletedAt) return err("セッションが見つかりません");
    if (current.status !== "未予約") {
      return err("未予約ステータスのセッションのみ昇格できます");
    }

    await prisma.$transaction(async (tx) => {
      // フィールド更新
      await helperUpdateSessionFields(
        params.sessionId,
        {
          scheduledAt: params.scheduledAt,
          assignedStaffId: params.assignedStaffId,
        },
        "未予約から予約中への昇格（手動セット）",
        user.id,
        tx
      );
      // ステータス変更
      await helperChangeSessionStatus(
        params.sessionId,
        "予約中",
        "未予約から予約中への昇格（手動セット）",
        user.id,
        tx
      );
    });

    // Zoom発行 + 通知
    await handleSessionReservationSideEffects({
      sessionId: params.sessionId,
      companyRecordId: current.companyRecordId,
      category: current.category as SessionCategory,
      triggerReason: "confirm",
      roundNumber: current.roundNumber,
      notifyReferrer: params.notifyReferrer ?? false,
    });

    revalidatePath(`/slp/companies/${current.companyRecordId}`);
    return ok({ sessionId: params.sessionId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "予約中への昇格に失敗しました");
  }
}

/**
 * ステータス変更（キャンセル/予約中/未予約への遷移、完了→他ステータス等）
 *
 * - 完了・飛び への遷移は completeSessionAndNotify / changeStatusToNoShow を使うこと
 * - ルール:
 *   - 変更理由必須
 *   - 後続の打ち合わせが存在する場合、完了→他ステータスへの変更は拒否
 */
export async function updateSessionStatus(params: {
  sessionId: number;
  newStatus: SessionStatus;
  reason: string;
}): Promise<ActionResult<{ sessionId: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    if (!params.reason.trim()) {
      return err("変更理由の記載は必須です");
    }

    const current = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!current || current.deletedAt) return err("セッションが見つかりません");

    if (current.status === "完了" && params.newStatus !== "完了") {
      const hasNext = await hasSubsequentRound(current);
      if (hasNext) {
        return err(
          "この打ち合わせの後に新しい打ち合わせが既に作成されています。完了→他ステータスへの変更はできません"
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await helperChangeSessionStatus(
        params.sessionId,
        params.newStatus,
        params.reason,
        user.id,
        tx
      );
    });

    await handleSessionStatusChangeSideEffects({
      sessionId: params.sessionId,
      newStatus: params.newStatus,
      category: current.category as SessionCategory,
    });

    revalidatePath(`/slp/companies/${current.companyRecordId}`);
    return ok({ sessionId: params.sessionId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "ステータス変更に失敗しました");
  }
}

/**
 * 完了ステータスへの変更 + お礼メッセージ送信（手打ち）+ 紹介者通知（briefing 1回目のみ自動）
 *
 * - 変更理由は任意（キャンセル → 完了の場合のみ必須とするかは呼び出し側制御）
 * - 選択された contactId に form11/form13 を送信
 * - briefing 1回目なら紹介者に form18 (テンプレートベース) を自動送信
 */
export async function completeSessionAndNotify(params: {
  sessionId: number;
  selectedContactIds: number[];
  thankYouMessage: string;
  reason?: string | null;
}): Promise<
  ActionResult<{
    sessionId: number;
    attendeeResults: { contactId: number; name: string; success: boolean; error?: string }[];
    referrerResults: { referrerUid: string; snsname: string; success: boolean; error?: string }[];
  }>
> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const current = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!current || current.deletedAt) return err("セッションが見つかりません");

    // キャンセル → 完了 のロールバックのみ理由必須
    if (current.status === "キャンセル" && !params.reason?.trim()) {
      return err("キャンセルから完了へ戻す場合は変更理由の記載が必須です");
    }

    // ステータス変更 + 履歴記録
    await prisma.$transaction(async (tx) => {
      await helperChangeSessionStatus(
        params.sessionId,
        "完了",
        params.reason?.trim() || "完了処理",
        user.id,
        tx
      );
    });

    // お礼メッセージ送信
    const attendeeResults: { contactId: number; name: string; success: boolean; error?: string }[] = [];
    const referrerResults: { referrerUid: string; snsname: string; success: boolean; error?: string }[] = [];

    if (params.selectedContactIds.length > 0 && params.thankYouMessage.trim()) {
      const contacts = await prisma.slpCompanyContact.findMany({
        where: { id: { in: params.selectedContactIds } },
        include: { lineFriend: { select: { uid: true, snsname: true } } },
      });

      const category = current.category as SessionCategory;
      for (const contact of contacts) {
        const displayName = contact.name ?? contact.lineFriend?.snsname ?? "(名前なし)";
        const uid = contact.lineFriend?.uid;
        if (!uid) {
          attendeeResults.push({
            contactId: contact.id,
            name: displayName,
            success: false,
            error: "公式LINE未紐付け",
          });
          continue;
        }
        try {
          if (category === "briefing") {
            await submitForm11BriefingThankYou(uid, params.thankYouMessage);
          } else {
            await submitForm13ConsultationThankYou(uid, params.thankYouMessage);
          }
          attendeeResults.push({
            contactId: contact.id,
            name: displayName,
            success: true,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          attendeeResults.push({
            contactId: contact.id,
            name: displayName,
            success: false,
            error: errMsg,
          });
          await logAutomationError({
            source:
              category === "briefing"
                ? "slp-briefing-complete-form11"
                : "slp-consultation-complete-form13",
            message: `${category === "briefing" ? "概要案内" : "導入希望商談"}完了お礼メッセージ送信失敗: ${displayName} (uid=${uid})`,
            detail: {
              error: errMsg,
              uid,
              contactId: contact.id,
              name: displayName,
              freeText: params.thankYouMessage,
              retryAction:
                category === "briefing"
                  ? "form11-briefing-thank-you"
                  : "form13-consultation-thank-you",
            },
          });
        }
      }
    }

    // briefing × 1回目のみ: 紹介者に完了通知を自動送信（テンプレートベース）
    if (current.category === "briefing" && current.roundNumber === 1) {
      const r = await sendSessionNotification({
        sessionId: params.sessionId,
        recipient: "referrer",
        trigger: "complete",
      });
      if (r.ok && !r.skipped) {
        // sendSessionNotification は UID などを返さないので最小情報だけ残す
        referrerResults.push({
          referrerUid: "(紹介者)",
          snsname: "(自動送信済み)",
          success: true,
        });
      } else if (!r.ok) {
        referrerResults.push({
          referrerUid: "(紹介者)",
          snsname: "(送信失敗)",
          success: false,
          error: r.errorMessage ?? "送信失敗",
        });
      }
    }

    revalidatePath(`/slp/companies/${current.companyRecordId}`);
    return ok({ sessionId: params.sessionId, attendeeResults, referrerResults });
  } catch (e) {
    return err(e instanceof Error ? e.message : "完了処理に失敗しました");
  }
}

/**
 * 飛びステータスへの変更 + Zoom自動削除 + オプションで紹介者に不参加通知
 *
 * - 変更理由任意
 * - briefing 1回目かつ notifyReferrer=true のみ紹介者に form18 (no_show テンプレート) を送信
 * - 返り値に「プロラインでのキャンセル処理が必要」フラグ
 */
export async function changeStatusToNoShow(params: {
  sessionId: number;
  notifyReferrer: boolean;
  reason?: string | null;
}): Promise<
  ActionResult<{
    sessionId: number;
    referrerNotified: boolean;
    referrerError: string | null;
    needsProlineCancel: boolean;
  }>
> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const current = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!current || current.deletedAt) return err("セッションが見つかりません");

    // ステータス変更 + 履歴記録
    await prisma.$transaction(async (tx) => {
      await helperChangeSessionStatus(
        params.sessionId,
        "飛び",
        params.reason?.trim() || "飛び（不参加）",
        user.id,
        tx
      );
    });

    // Zoom会議削除
    try {
      await cancelZoomMeetingForSession({ sessionId: params.sessionId });
    } catch (e) {
      await logAutomationError({
        source: "slp-session-no-show-zoom-cancel",
        message: `飛びステータス変更時のZoom削除失敗: sessionId=${params.sessionId}`,
        detail: { error: e instanceof Error ? e.message : String(e) },
      });
    }

    // 紹介者に不参加通知（briefing 1回目 & 明示選択時のみ）
    let referrerNotified = false;
    let referrerError: string | null = null;
    if (
      params.notifyReferrer &&
      current.category === "briefing" &&
      current.roundNumber === 1
    ) {
      const r = await sendSessionNotification({
        sessionId: params.sessionId,
        recipient: "referrer",
        trigger: "no_show",
      });
      if (r.ok && !r.skipped) {
        referrerNotified = true;
      } else if (!r.ok) {
        referrerError = r.errorMessage ?? "送信失敗";
      }
    }

    revalidatePath(`/slp/companies/${current.companyRecordId}`);
    return ok({
      sessionId: params.sessionId,
      referrerNotified,
      referrerError,
      needsProlineCancel: current.source === "proline",
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "飛び処理に失敗しました");
  }
}

/**
 * セッションのフィールド編集（予約日・商談日時・担当者・メモ）
 *
 * - source="proline" のセッションは変更理由必須（監査のため）
 * - source="manual" のセッションは変更理由任意
 */
export async function updateSessionDetail(params: {
  sessionId: number;
  fields: {
    bookedAt?: Date | null;
    scheduledAt?: Date | null;
    assignedStaffId?: number | null;
    notes?: string | null;
  };
  reason?: string;
}): Promise<ActionResult<{ sessionId: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const current = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!current || current.deletedAt) return err("セッションが見つかりません");

    // source="proline" は変更理由必須
    if (current.source === "proline" && !params.reason?.trim()) {
      return err(
        "プロライン予約のセッションを編集する場合は、変更理由の記載が必須です"
      );
    }

    await prisma.$transaction(async (tx) => {
      await helperUpdateSessionFields(
        params.sessionId,
        params.fields,
        params.reason?.trim() || "スタッフ編集",
        user.id,
        tx
      );
    });

    revalidatePath(`/slp/companies/${current.companyRecordId}`);
    return ok({ sessionId: params.sessionId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "セッション編集に失敗しました");
  }
}

/**
 * セッション論理削除
 */
export async function deleteSession(params: {
  sessionId: number;
  reason: string;
}): Promise<ActionResult<{ sessionId: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    if (!params.reason.trim()) {
      return err("削除理由の記載は必須です");
    }

    const current = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!current) return err("セッションが見つかりません");

    await prisma.$transaction(async (tx) => {
      await helperSoftDeleteSession(params.sessionId, params.reason, user.id, tx);
    });

    revalidatePath(`/slp/companies/${current.companyRecordId}`);
    return ok({ sessionId: params.sessionId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "削除に失敗しました");
  }
}

// ============================================
// 追加Zoom管理
// ============================================

/**
 * セッションに追加Zoom記録を登録
 *
 * Sub 4時点では手動でZoomミーティング情報を渡す想定（Phase 3で自動発行連携）
 */
export async function addSessionZoom(params: {
  sessionId: number;
  zoomMeetingId: string; // BigInt文字列
  joinUrl: string;
  startUrl?: string | null;
  scheduledAt?: Date | null;
  label?: string;
  hostStaffId?: number | null;
}): Promise<ActionResult<{ zoomId: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!session || session.deletedAt) return err("セッションが見つかりません");

    const created = await prisma.slpMeetingSessionZoom.create({
      data: {
        sessionId: params.sessionId,
        zoomMeetingId: BigInt(params.zoomMeetingId),
        joinUrl: params.joinUrl,
        startUrl: params.startUrl ?? null,
        scheduledAt: params.scheduledAt ?? null,
        isPrimary: false, // 追加Zoomはデフォルト非プライマリ
        label: params.label ?? "追加Zoom",
        hostStaffId: params.hostStaffId ?? null,
      },
    });

    await prisma.slpMeetingSessionHistory.create({
      data: {
        sessionId: params.sessionId,
        changedByStaffId: user.id,
        changeType: "field_edit",
        fieldName: "zoom_added",
        newValue: JSON.stringify({ zoomId: created.id, label: params.label ?? "追加Zoom" }),
        reason: "追加Zoom登録",
      },
    });

    revalidatePath(`/slp/companies/${session.companyRecordId}`);
    return ok({ zoomId: created.id });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Zoom追加に失敗しました");
  }
}

/**
 * 追加Zoom編集（日時・ラベル変更等）
 */
export async function updateSessionZoom(params: {
  zoomId: number;
  scheduledAt?: Date | null;
  label?: string | null;
  joinUrl?: string;
  reason: string;
}): Promise<ActionResult<{ zoomId: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    if (!params.reason.trim()) {
      return err("変更理由の記載は必須です");
    }

    const current = await prisma.slpMeetingSessionZoom.findUnique({
      where: { id: params.zoomId },
      include: { session: { select: { id: true, companyRecordId: true } } },
    });
    if (!current || current.deletedAt) return err("Zoom記録が見つかりません");

    const updateData: Record<string, unknown> = {};
    if (params.scheduledAt !== undefined) updateData.scheduledAt = params.scheduledAt;
    if (params.label !== undefined) updateData.label = params.label;
    if (params.joinUrl !== undefined) updateData.joinUrl = params.joinUrl;

    await prisma.slpMeetingSessionZoom.update({
      where: { id: params.zoomId },
      data: updateData,
    });

    await prisma.slpMeetingSessionHistory.create({
      data: {
        sessionId: current.sessionId,
        changedByStaffId: user.id,
        changeType: "field_edit",
        fieldName: "zoom_updated",
        oldValue: JSON.stringify({
          scheduledAt: current.scheduledAt,
          label: current.label,
        }),
        newValue: JSON.stringify(updateData),
        reason: params.reason,
      },
    });

    revalidatePath(`/slp/companies/${current.session.companyRecordId}`);
    return ok({ zoomId: params.zoomId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Zoom編集に失敗しました");
  }
}

/**
 * 追加Zoom論理削除
 */
export async function deleteSessionZoom(params: {
  zoomId: number;
  reason: string;
}): Promise<ActionResult<{ zoomId: number }>> {
  try {
    const user = await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);

    if (!params.reason.trim()) {
      return err("削除理由の記載は必須です");
    }

    const current = await prisma.slpMeetingSessionZoom.findUnique({
      where: { id: params.zoomId },
      include: { session: { select: { id: true, companyRecordId: true } } },
    });
    if (!current) return err("Zoom記録が見つかりません");

    await prisma.slpMeetingSessionZoom.update({
      where: { id: params.zoomId },
      data: { deletedAt: new Date() },
    });

    await prisma.slpMeetingSessionHistory.create({
      data: {
        sessionId: current.sessionId,
        changedByStaffId: user.id,
        changeType: "field_edit",
        fieldName: "zoom_deleted",
        oldValue: String(params.zoomId),
        reason: params.reason,
      },
    });

    revalidatePath(`/slp/companies/${current.session.companyRecordId}`);
    return ok({ zoomId: params.zoomId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Zoom削除に失敗しました");
  }
}

/**
 * 次の打ち合わせ番号をプレビュー（UI表示用）
 */
export async function previewNextRoundNumber(params: {
  companyRecordId: number;
  category: SessionCategory;
}): Promise<ActionResult<{ roundNumber: number; canAdd: boolean; reason?: string }>> {
  try {
    await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

    const activeCount = await prisma.slpMeetingSession.count({
      where: {
        companyRecordId: params.companyRecordId,
        category: params.category,
        status: { in: ["未予約", "予約中"] },
        deletedAt: null,
      },
    });

    const roundNumber = await calcNextRoundNumber(params.companyRecordId, params.category);

    if (activeCount > 0) {
      return ok({
        roundNumber,
        canAdd: false,
        reason: "予約中または未予約のセッションが既にあります",
      });
    }

    return ok({ roundNumber, canAdd: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : "次の打ち合わせ番号の計算に失敗しました");
  }
}
