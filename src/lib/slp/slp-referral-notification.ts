/**
 * SLP 紹介者通知（セッション非依存）統合レイヤー
 *
 * 「友達追加通知」「契約締結通知」など、商談セッションとは無関係な
 * 紹介者向け通知を Form18 経由で送信する。
 *
 * テンプレート検索キー: recipient="referrer" × category="referral" × trigger=<friend_added|contract_signed>
 * 送信ログ: SlpZoomSendLog に sessionId=null, companyRecordId=relatedCompanyRecordId ?? null で記録
 */

import { prisma } from "@/lib/prisma";
import {
  submitForm18ReferrerNotification,
  REFERRER_NOTIFICATION_FORM,
} from "@/lib/proline-form";
import { logAutomationError } from "@/lib/automation-error";
import {
  MISSING_DATA_FALLBACK,
  orFallback,
  renderTemplateBody,
  type NotificationRenderVars,
} from "@/lib/slp/slp-session-notification";

export type ReferralTrigger = "friend_added" | "contract_signed";

export interface SendReferralNotificationParams {
  trigger: ReferralTrigger;
  /** 送信先: 紹介者のLINE UID（通常は「追加された人 / 契約締結した人」の SlpLineFriend.free1） */
  referrerUid: string;
  /** テンプレ本文の {{変数}} 置換用コンテキスト */
  context: {
    /** trigger=friend_added 用: 追加されたユーザーのLINE SNS名 */
    addedFriendLineName?: string;
    /** trigger=contract_signed 用: 組合員名簿の氏名 */
    memberName?: string;
    /** trigger=contract_signed 用: 組合員のLINE SNS名 */
    memberLineName?: string;
  };
  /**
   * ログ用: 対象組合員が事業者に紐づく場合は companyRecordId を渡す（friend_added は null 想定）。
   * SlpZoomSendLog.companyRecordId に入る。
   */
  relatedCompanyRecordId?: number | null;
}

export interface SendReferralNotificationResult {
  ok: boolean;
  bodyText?: string;
  errorMessage?: string;
  skipped?: boolean;
}

/**
 * 紹介者向け通知を Form18 経由で送信する。
 *
 * 処理フロー:
 *  1. referrerUid の空チェック
 *  2. テンプレ検索（recipient=referrer, category=referral, trigger=X）
 *  3. 未存在 → error / !isActive → skipped
 *  4. 変数置換（空白値は自動で "(データの取得に失敗しました)" に置換）
 *  5. Form18 で送信
 *  6. SlpZoomSendLog に成功/失敗ログ記録（sessionId=null）
 */
export async function sendReferralNotification(
  params: SendReferralNotificationParams
): Promise<SendReferralNotificationResult> {
  const targetUid = params.referrerUid?.trim();
  if (!targetUid) {
    return {
      ok: false,
      errorMessage: "紹介者のLINE UIDが空です（送信中止）",
    };
  }

  // テンプレート検索
  const template = await prisma.slpNotificationTemplate.findFirst({
    where: {
      recipient: "referrer",
      category: "referral",
      roundType: null,
      source: null,
      trigger: params.trigger,
    },
  });

  if (!template) {
    return {
      ok: false,
      errorMessage: `テンプレートが見つかりません: recipient=referrer, category=referral, trigger=${params.trigger}`,
    };
  }

  if (!template.isActive) {
    return { ok: true, skipped: true };
  }

  // 変数準備（空白値は一律フォールバック）
  // referralトリガーは商談系変数を持たないが、
  // スタッフが誤って {{companyName}} 等を書いた場合の破綻防止で
  // 全てフォールバック文字列で埋める
  const vars: NotificationRenderVars = {
    companyName: MISSING_DATA_FALLBACK,
    scheduledAt: MISSING_DATA_FALLBACK,
    staffName: MISSING_DATA_FALLBACK,
    zoomUrl: MISSING_DATA_FALLBACK,
    referrerName: MISSING_DATA_FALLBACK,
    roundNumber: MISSING_DATA_FALLBACK,
    addedFriendLineName: orFallback(params.context.addedFriendLineName),
    memberName: orFallback(params.context.memberName),
    memberLineName: orFallback(params.context.memberLineName),
  };

  const bodyText = renderTemplateBody(template.body, vars);

  // Form18 送信
  let result: { ok: boolean; httpStatus: number; responseJson: unknown } = {
    ok: false,
    httpStatus: 0,
    responseJson: null,
  };
  let thrown: unknown = null;

  try {
    result = await submitForm18ReferrerNotification(targetUid, bodyText);
  } catch (err) {
    thrown = err;
    result = { ok: false, httpStatus: 0, responseJson: null };
  }

  // 送信ログ記録（category="referral"）
  try {
    await prisma.slpZoomSendLog.create({
      data: {
        companyRecordId: params.relatedCompanyRecordId ?? null,
        sessionId: null,
        category: "referral",
        trigger: params.trigger,
        recipient: "referrer",
        uid: targetUid,
        formId: "form18",
        fieldKey: REFERRER_NOTIFICATION_FORM.fieldKey,
        bodyText,
        status: result.ok ? "success" : "failed",
        httpStatus: result.httpStatus || null,
        errorMessage: result.ok
          ? null
          : JSON.stringify({
              thrown: thrown instanceof Error ? thrown.message : thrown ?? null,
              response: result.responseJson,
            }),
      },
    });
  } catch (logErr) {
    // ログ記録自体の失敗は automation_errors に残す（送信結果には影響させない）
    await logAutomationError({
      source: `slp-referral-notification-log-${params.trigger}`,
      message: `送信ログ記録失敗: trigger=${params.trigger}, uid=${targetUid}`,
      detail: { error: logErr instanceof Error ? logErr.message : String(logErr) },
    });
  }

  if (!result.ok) {
    await logAutomationError({
      source: `slp-referral-notification-${params.trigger}`,
      message: `紹介者通知送信失敗 (trigger=${params.trigger}, uid=${targetUid})`,
      detail: {
        uid: targetUid,
        httpStatus: result.httpStatus,
        response: result.responseJson,
        thrown: thrown instanceof Error ? thrown.message : thrown ?? null,
        bodyPreview: bodyText.slice(0, 300),
      },
    });
    return {
      ok: false,
      bodyText,
      errorMessage:
        thrown instanceof Error ? thrown.message : `HTTP ${result.httpStatus}`,
    };
  }

  return { ok: true, bodyText };
}
