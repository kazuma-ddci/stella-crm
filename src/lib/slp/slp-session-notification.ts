/**
 * SLP 商談セッション用の通知送信統合レイヤー
 *
 * - SlpMeetingSession + SlpNotificationTemplate をベースに、
 *   recipient × category × roundType × source × trigger で最適なテンプレートを選択
 * - 変数置換（{{companyName}} 等）してレンダリング
 * - formId に応じた送信関数（Form11/13/16/17/18）を呼び出し
 * - SlpZoomSendLog に送信結果を記録
 */

import { prisma } from "@/lib/prisma";
import {
  submitZoomGuideMessage,
  submitZoomConsultMessage,
  submitForm11BriefingThankYou,
  submitForm13ConsultationThankYou,
  submitForm18ReferrerNotification,
  ZOOM_GUIDE_FORM,
  ZOOM_CONSULT_FORM,
  REFERRER_NOTIFICATION_FORM,
} from "@/lib/proline-form";
import { formatJstDateTime } from "@/lib/zoom/templates";
import { logAutomationError } from "@/lib/automation-error";
import { roundTypeOf } from "@/lib/slp/session-helper";
import type { SessionCategory } from "@/lib/slp/session-helper";

export type NotificationRecipient = "customer" | "referrer";
export type NotificationTrigger =
  | "confirm"
  | "change"
  | "cancel"
  | "complete"
  | "no_show"
  | "remind_day_before"
  | "remind_hour_before";

export interface SendSessionNotificationParams {
  sessionId: number;
  recipient: NotificationRecipient;
  trigger: NotificationTrigger;
}

export interface NotificationRenderVars {
  companyName: string;
  scheduledAt: string;
  staffName: string;
  zoomUrl: string;
  referrerName: string;
  roundNumber: string;
  [key: string]: string;
}

/**
 * {{key}} 形式の変数を置換する（未定義変数はそのまま残す）
 */
function renderTemplateBody(body: string, vars: NotificationRenderVars): string {
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, keyRaw: string) => {
    const key = keyRaw.trim();
    const v = vars[key];
    return v === undefined ? match : v;
  });
}

/**
 * セッションに関連する通知を送信する
 *
 * 処理フロー:
 * 1. セッション情報と関連データ取得（企業、担当者、Zoom URL、紹介者UID）
 * 2. テンプレート検索（recipient × category × roundType × source × trigger）
 * 3. 変数置換してレンダリング
 * 4. formId に応じた送信関数を呼び出し
 * 5. SlpZoomSendLog に記録
 *
 * 返り値: { ok, bodyText, errorMessage }
 */
export async function sendSessionNotification(
  params: SendSessionNotificationParams
): Promise<{ ok: boolean; bodyText?: string; errorMessage?: string; skipped?: boolean }> {
  const session = await prisma.slpMeetingSession.findUnique({
    where: { id: params.sessionId },
    include: {
      companyRecord: {
        include: {
          contacts: {
            where: { isPrimary: true },
            include: { lineFriend: true },
            take: 1,
          },
        },
      },
      assignedStaff: { select: { name: true } },
      zoomRecords: {
        where: { deletedAt: null, isPrimary: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { joinUrl: true },
      },
    },
  });

  if (!session) {
    return { ok: false, errorMessage: `Session not found: ${params.sessionId}` };
  }

  // 基本変数の準備
  const primaryContact = session.companyRecord.contacts[0];
  const lineFriend = primaryContact?.lineFriend;
  const customerUid = lineFriend?.uid ?? null;
  const referrerUid = lineFriend?.free1?.trim() || null;

  const roundType = roundTypeOf(session.roundNumber);
  const category = session.category as SessionCategory;
  const source = session.source as "proline" | "manual";

  // テンプレート検索条件:
  // - customer: recipient="customer", category, roundType, source, trigger
  // - referrer: recipient="referrer", category="briefing", roundType=null, source=null, trigger
  const templateWhere =
    params.recipient === "customer"
      ? {
          recipient: "customer",
          category,
          roundType,
          source,
          trigger: params.trigger,
        }
      : {
          recipient: "referrer",
          category: "briefing" as const,
          roundType: null,
          source: null,
          trigger: params.trigger,
        };

  const template = await prisma.slpNotificationTemplate.findFirst({
    where: templateWhere,
  });

  if (!template) {
    return {
      ok: false,
      errorMessage: `テンプレートが見つかりません: ${JSON.stringify(templateWhere)}`,
    };
  }

  if (!template.isActive) {
    return { ok: true, skipped: true };
  }

  // 変数準備
  const vars: NotificationRenderVars = {
    companyName: session.companyRecord.companyName ?? "（事業者名未登録）",
    scheduledAt: session.scheduledAt ? formatJstDateTime(session.scheduledAt) : "",
    staffName: session.assignedStaff?.name ?? "",
    zoomUrl: session.zoomRecords[0]?.joinUrl ?? "",
    referrerName: primaryContact?.name ?? lineFriend?.snsname ?? "",
    roundNumber: String(session.roundNumber),
  };

  const bodyText = renderTemplateBody(template.body, vars);

  // 送信先 UID
  const targetUid = params.recipient === "customer" ? customerUid : referrerUid;
  if (!targetUid) {
    return {
      ok: false,
      errorMessage:
        params.recipient === "customer"
          ? "お客様のLINE UIDが取得できません（公式LINE連携が未完了）"
          : "紹介者のLINE UIDが取得できません（free1未設定）",
    };
  }

  // formId に応じて送信関数をディスパッチ
  const formId = template.formId;
  let result: { ok: boolean; httpStatus: number; responseJson: unknown } = {
    ok: false,
    httpStatus: 0,
    responseJson: null,
  };
  let thrown: unknown = null;

  try {
    if (formId === "form16") {
      result = await submitZoomGuideMessage(targetUid, bodyText);
    } else if (formId === "form17") {
      result = await submitZoomConsultMessage(targetUid, bodyText);
    } else if (formId === "form18") {
      result = await submitForm18ReferrerNotification(targetUid, bodyText);
    } else if (formId === "form11") {
      await submitForm11BriefingThankYou(targetUid, bodyText);
      result = { ok: true, httpStatus: 200, responseJson: null };
    } else if (formId === "form13") {
      await submitForm13ConsultationThankYou(targetUid, bodyText);
      result = { ok: true, httpStatus: 200, responseJson: null };
    } else {
      return { ok: false, errorMessage: `未知のformId: ${formId}` };
    }
  } catch (err) {
    thrown = err;
    result = { ok: false, httpStatus: 0, responseJson: null };
  }

  // 送信ログ記録
  const fieldKey =
    formId === "form16"
      ? ZOOM_GUIDE_FORM.fieldKey
      : formId === "form17"
        ? ZOOM_CONSULT_FORM.fieldKey
        : formId === "form18"
          ? REFERRER_NOTIFICATION_FORM.fieldKey
          : formId === "form11"
            ? "form11-1"
            : formId === "form13"
              ? "form13-1"
              : "";

  await prisma.slpZoomSendLog.create({
    data: {
      companyRecordId: session.companyRecordId,
      sessionId: session.id,
      category: category,
      trigger: params.trigger,
      recipient: params.recipient,
      uid: targetUid,
      formId,
      fieldKey,
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

  if (!result.ok) {
    await logAutomationError({
      source: `slp-session-notification-${params.recipient}-${params.trigger}`,
      message: `通知送信失敗 (sessionId=${session.id}, recipient=${params.recipient}, trigger=${params.trigger})`,
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
