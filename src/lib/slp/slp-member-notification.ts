/**
 * SLP 組合員向け通知統合レイヤー
 *
 * 「契約書リマインド」「契約書メール不達通知」など、組合員本人向けの
 * 契約書関連通知を Form15 経由で送信する。
 *
 * テンプレート検索キー: recipient="member" × category="contract" × trigger=<contract_reminder|contract_bounced>
 * 送信ログ: SlpZoomSendLog に sessionId=null, companyRecordId=null, category="contract" で記録
 */

import { prisma } from "@/lib/prisma";
import {
  submitForm15Message,
  MEMBER_CONTRACT_FORM,
} from "@/lib/proline-form";
import { logAutomationError } from "@/lib/automation-error";
import {
  MISSING_DATA_FALLBACK,
  orFallback,
  renderTemplateBody,
  type NotificationRenderVars,
} from "@/lib/slp/slp-session-notification";

export type MemberTrigger = "contract_reminder" | "contract_bounced";

export interface SendMemberNotificationParams {
  trigger: MemberTrigger;
  /** 送信先: 組合員本人の LINE UID */
  memberUid: string;
  /** テンプレ本文の {{変数}} 置換用コンテキスト */
  context: {
    /** 組合員名簿の氏名 */
    memberName?: string;
    /**
     * 契約書送付日（フォーマット済み、例「2026年4月1日」）。
     * 呼び出し側で formatJpDate() 等で整形してから渡す。
     */
    contractSentDate?: string;
    /** 契約書送付先メールアドレス（バウンス時は失敗したアドレスを渡す） */
    contractSentEmail?: string;
  };
}

export interface SendMemberNotificationResult {
  ok: boolean;
  bodyText?: string;
  errorMessage?: string;
  skipped?: boolean;
}

/**
 * 組合員向けの契約書通知を Form15 経由で送信する。
 *
 * 処理フロー:
 *  1. memberUid の空チェック
 *  2. テンプレ検索（recipient=member, category=contract, trigger=X）
 *  3. 未存在 → error / !isActive → skipped
 *  4. 変数置換（空白値は自動で "(データの取得に失敗しました)" に置換）
 *  5. Form15 で送信
 *  6. SlpZoomSendLog に成功/失敗ログ記録（sessionId=null, companyRecordId=null）
 */
export async function sendMemberNotification(
  params: SendMemberNotificationParams
): Promise<SendMemberNotificationResult> {
  const targetUid = params.memberUid?.trim();
  if (!targetUid) {
    return {
      ok: false,
      errorMessage: "組合員のLINE UIDが空です（送信中止）",
    };
  }

  // テンプレート検索
  const template = await prisma.slpNotificationTemplate.findFirst({
    where: {
      recipient: "member",
      category: "contract",
      roundType: null,
      source: null,
      trigger: params.trigger,
    },
  });

  if (!template) {
    return {
      ok: false,
      errorMessage: `テンプレートが見つかりません: recipient=member, category=contract, trigger=${params.trigger}`,
    };
  }

  if (!template.isActive) {
    return { ok: true, skipped: true };
  }

  // 変数準備（空白値は一律フォールバック）
  // contract 系トリガーは商談/紹介系変数を持たないが、
  // スタッフが誤って {{companyName}} 等を書いた場合の破綻防止で
  // 商談系変数は全て MISSING_DATA_FALLBACK で埋める
  const vars: NotificationRenderVars = {
    companyName: MISSING_DATA_FALLBACK,
    scheduledAt: MISSING_DATA_FALLBACK,
    staffName: MISSING_DATA_FALLBACK,
    zoomUrl: MISSING_DATA_FALLBACK,
    referrerName: MISSING_DATA_FALLBACK,
    roundNumber: MISSING_DATA_FALLBACK,
    memberName: orFallback(params.context.memberName),
    contractSentDate: orFallback(params.context.contractSentDate),
    contractSentEmail: orFallback(params.context.contractSentEmail),
  };

  const bodyText = renderTemplateBody(template.body, vars);

  // Form15 送信
  let result: { ok: boolean; httpStatus: number; responseJson: unknown } = {
    ok: false,
    httpStatus: 0,
    responseJson: null,
  };
  let thrown: unknown = null;

  try {
    result = await submitForm15Message(targetUid, bodyText);
  } catch (err) {
    thrown = err;
    result = { ok: false, httpStatus: 0, responseJson: null };
  }

  // 送信ログ記録（category="contract"）
  try {
    await prisma.slpZoomSendLog.create({
      data: {
        companyRecordId: null,
        sessionId: null,
        category: "contract",
        trigger: params.trigger,
        recipient: "member",
        uid: targetUid,
        formId: "form15",
        fieldKey: MEMBER_CONTRACT_FORM.fieldKey,
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
      source: `slp-member-notification-log-${params.trigger}`,
      message: `送信ログ記録失敗: trigger=${params.trigger}, uid=${targetUid}`,
      detail: {
        error: logErr instanceof Error ? logErr.message : String(logErr),
      },
    });
  }

  if (!result.ok) {
    await logAutomationError({
      source: `slp-member-notification-${params.trigger}`,
      message: `組合員通知送信失敗 (trigger=${params.trigger}, uid=${targetUid})`,
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
