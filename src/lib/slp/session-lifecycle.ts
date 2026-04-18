/**
 * SLP商談セッションのライフサイクル副作用処理（共通モジュール）
 *
 * - Server Action (手動セット・昇格・ステータス変更) から呼ばれる
 * - プロラインwebhook (予約・変更・キャンセル) から呼ばれる
 * - 両者で Zoom発行／旧カラム同期／通知送信のフローを統一する
 */

import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import {
  ensureZoomMeetingForSession,
  cancelZoomMeetingForSession,
} from "@/lib/slp/zoom-reservation-handler";
import {
  sendSessionNotification,
  type NotificationRecipient,
  type NotificationTrigger,
} from "@/lib/slp/slp-session-notification";
import {
  getNotifiableCustomerLineFriendIds,
  type SessionCategory,
  type SessionStatus,
} from "@/lib/slp/session-helper";

// ============================================
// 予約時の副作用処理（手動セット / 未予約→予約中昇格 / プロラインwebhook 共通）
// ============================================

export interface SessionReservationSideEffectsParams {
  sessionId: number;
  companyRecordId: number;
  category: SessionCategory;
  triggerReason: "confirm" | "change";
  roundNumber: number;
  /**
   * 紹介者通知を送るかどうか（呼び出し側で決定）
   * - 手動セット: スタッフがチェックON時のみ true
   * - プロラインwebhook: 概要案内1回目の場合は常に true
   */
  notifyReferrer: boolean;
  /**
   * notifyReferrer=true 時に明示指定したい紹介者LineFriendIDのリスト。
   * - 手動モーダル: スタッフが選択した紹介者のIDリスト
   * - 未指定（webhook等）: 従来通りメイン担当者のfree1の1人だけ
   */
  selectedReferrerLineFriendIds?: number[];
  /**
   * Zoom発行を試みるか（fallback やキャンセル時は false）
   * デフォルト true
   */
  issueZoom?: boolean;
}

/**
 * 予約確定 or 予約変更時の副作用処理:
 * 1. Zoom発行 (ensureZoomMeetingForSession, skipCustomerNotification=true)
 * 2. お客様通知 (SlpNotificationTemplate ベース)
 * 3. 紹介者通知 (概要案内1回目 × notifyReferrer=true の場合のみ)
 *
 * 各ステップのエラーは automation_errors に記録して続行。
 */
export async function handleSessionReservationSideEffects(
  params: SessionReservationSideEffectsParams
): Promise<void> {
  const issueZoom = params.issueZoom ?? true;

  // 1. Zoom発行（接触履歴配下の primary SlpZoomRecording に URL情報を保存）
  // お客様通知は後続のステップ2で送るため、ここではskip
  if (issueZoom) {
    try {
      await ensureZoomMeetingForSession({
        sessionId: params.sessionId,
        triggerReason: params.triggerReason,
        skipCustomerNotification: true,
      });
    } catch (e) {
      await logAutomationError({
        source: "slp-session-reservation-zoom",
        message: `Zoom発行失敗: sessionId=${params.sessionId}`,
        detail: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  // 2. お客様通知（予約者 + フラグONの担当者 or 個別設定のコンタクトに全員送信）
  await safeNotifyAllCustomers(params.sessionId, params.triggerReason);

  // 3. 紹介者通知（概要案内1回目 × notifyReferrer=true の場合のみ）
  if (
    params.notifyReferrer &&
    params.category === "briefing" &&
    params.roundNumber === 1
  ) {
    const ids = params.selectedReferrerLineFriendIds;
    if (ids && ids.length > 0) {
      // 明示指定された複数の紹介者へ順次送信
      for (const lineFriendId of ids) {
        await safeNotify(
          params.sessionId,
          "referrer",
          params.triggerReason,
          lineFriendId
        );
      }
    } else if (!ids) {
      // 未指定（webhook等）→ 従来のメイン担当者free1経由の単一送信
      await safeNotify(params.sessionId, "referrer", params.triggerReason);
    }
    // ids が定義済みかつ空配列の場合 = スタッフが全員チェック外した → 何も送らない
  }
}

// ============================================
// ステータス変更時の副作用処理
// ============================================

export interface SessionStatusChangeSideEffectsParams {
  sessionId: number;
  newStatus: SessionStatus;
  category: SessionCategory;
}

/**
 * ステータス変更に伴う通知:
 * - 完了 → お礼メッセージ + 紹介者完了通知（概要案内1回目のみ）
 * - キャンセル → キャンセル通知 + 紹介者キャンセル通知（概要案内1回目のみ）
 * - 飛び → 通知しない
 * - 予約中に戻した場合 → change 扱いで通知
 *
 * Webhookキャンセル時にも呼び出し可能。
 */
export async function handleSessionStatusChangeSideEffects(
  params: SessionStatusChangeSideEffectsParams
): Promise<void> {
  const session = await prisma.slpMeetingSession.findUnique({
    where: { id: params.sessionId },
    select: { roundNumber: true },
  });
  if (!session) return;

  // 飛び: Zoom削除 + 紹介者通知は changeStatusToNoShow で処理済み、ここでは何もしない
  if (params.newStatus === "飛び") {
    return;
  }

  // 未予約への変更は通知しない
  if (params.newStatus === "未予約") return;

  // 完了 → 通知は completeSessionAndNotify (manual modal) 側で実施するため、ここでは何もしない
  // Zoom会議は残す（議事録紐付けのため）
  if (params.newStatus === "完了") {
    return;
  }

  // キャンセル → Zoom会議を削除 + お客様へキャンセル通知 + 紹介者キャンセル通知（概要案内1回目のみ）
  if (params.newStatus === "キャンセル") {
    try {
      await cancelZoomMeetingForSession({ sessionId: params.sessionId });
    } catch (e) {
      await logAutomationError({
        source: "slp-session-cancel-zoom-cancel",
        message: `キャンセルステータス変更時のZoom削除失敗: sessionId=${params.sessionId}`,
        detail: { error: e instanceof Error ? e.message : String(e) },
      });
    }
    // 重要な順序:
    //   1. キャンセル通知を送信（この商談に紐づいていた個別設定を尊重）
    //   2. その後に個別設定を削除（再活性化時はフレッシュスタート）
    //   ↑逆にすると、個別設定していたセッションのキャンセル通知が意図と違う担当者に飛んでしまう
    await safeNotifyAllCustomers(params.sessionId, "cancel");
    if (params.category === "briefing" && session.roundNumber === 1) {
      await safeNotify(params.sessionId, "referrer", "cancel");
    }
    await prisma.slpSessionNotifyContact
      .deleteMany({ where: { sessionId: params.sessionId } })
      .catch(async (e) => {
        await logAutomationError({
          source: "slp-session-cancel-clear-notify-override",
          message: `キャンセル時の個別通知設定削除失敗: sessionId=${params.sessionId}`,
          detail: { error: e instanceof Error ? e.message : String(e) },
        });
      });
    return;
  }

  // 予約中へ戻した場合（完了/キャンセル/飛び → 予約中）
  // Zoom会議は既存primary Zoomが論理削除されていれば再発行が必要
  // UIから「予約中へ昇格」は未予約からのみで、ステータスロールバック時は
  // スタッフが明示的にZoom再発行ボタンを使う運用前提のため、ここでは通知のみ
  if (params.newStatus === "予約中") {
    await safeNotifyAllCustomers(params.sessionId, "change");
    return;
  }
}

/**
 * 通知送信（エラーは自動ログ、例外は throw しない）
 * 紹介者通知向け。顧客通知は safeNotifyAllCustomers を使うこと。
 */
export async function safeNotify(
  sessionId: number,
  recipient: NotificationRecipient,
  trigger: NotificationTrigger,
  referrerLineFriendId?: number
): Promise<void> {
  try {
    const r = await sendSessionNotification({
      sessionId,
      recipient,
      trigger,
      referrerLineFriendId,
    });
    if (!r.ok && !r.skipped) {
      await logAutomationError({
        source: `slp-session-notify-${recipient}-${trigger}`,
        message: `通知送信失敗: sessionId=${sessionId}`,
        detail: {
          errorMessage: r.errorMessage,
          referrerLineFriendId: referrerLineFriendId ?? null,
        },
      });
    }
  } catch (e) {
    await logAutomationError({
      source: `slp-session-notify-${recipient}-${trigger}`,
      message: `通知呼び出し失敗: sessionId=${sessionId}`,
      detail: {
        error: e instanceof Error ? e.message : String(e),
        referrerLineFriendId: referrerLineFriendId ?? null,
      },
    });
  }
}

/**
 * 商談セッションの通知対象（予約者 + フラグONの担当者 or 個別設定のコンタクト）全員へ
 * お客様通知を順次送信する。エラーは automation_errors に記録して続行。
 */
export async function safeNotifyAllCustomers(
  sessionId: number,
  trigger: NotificationTrigger
): Promise<void> {
  const lineFriendIds = await getNotifiableCustomerLineFriendIds(sessionId);

  if (lineFriendIds.length === 0) {
    await logAutomationError({
      source: `slp-session-notify-customer-${trigger}`,
      message: `お客様通知の送信対象がゼロ件: sessionId=${sessionId}`,
      detail: {
        reason:
          "予約者未設定、かつ receivesSessionNotifications=true の担当者もLINE紐付けなし。",
      },
    });
    return;
  }

  for (const lineFriendId of lineFriendIds) {
    try {
      const r = await sendSessionNotification({
        sessionId,
        recipient: "customer",
        trigger,
        customerLineFriendId: lineFriendId,
      });
      if (!r.ok && !r.skipped) {
        await logAutomationError({
          source: `slp-session-notify-customer-${trigger}`,
          message: `お客様通知送信失敗: sessionId=${sessionId}`,
          detail: {
            errorMessage: r.errorMessage,
            customerLineFriendId: lineFriendId,
          },
        });
      }
    } catch (e) {
      await logAutomationError({
        source: `slp-session-notify-customer-${trigger}`,
        message: `お客様通知呼び出し失敗: sessionId=${sessionId}`,
        detail: {
          error: e instanceof Error ? e.message : String(e),
          customerLineFriendId: lineFriendId,
        },
      });
    }
  }
}
