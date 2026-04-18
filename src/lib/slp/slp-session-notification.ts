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
import { resolveProlineStaffName } from "@/lib/slp/proline-staff-name";
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
  /**
   * お客様通知の送信先を明示指定したい場合の LineFriend ID
   * （1事業者に複数担当者がいるケースで呼び出し側が解決した1人を指定するため）
   * 未指定 + recipient=customer の場合は従来通りメイン担当者を引く
   */
  customerLineFriendId?: number;
  /**
   * 紹介者通知の送信先を明示指定したい場合の LineFriend ID
   * （複数紹介者がいるケースでスタッフが選択した1人を指定するため）
   * 未指定 + recipient=referrer の場合は従来通りメイン担当者の free1 を引く
   */
  referrerLineFriendId?: number;
}

/**
 * 空白値のフォールバック文字列。
 * テンプレ本文で {{xxx}} が空で「様」だけ残る、などの文字列破綻を防ぐ。
 */
const MISSING_DATA_FALLBACK = "(データの取得に失敗しました)";

function orFallback(v: string | null | undefined): string {
  const t = v?.trim();
  return t && t.length > 0 ? t : MISSING_DATA_FALLBACK;
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
      assignedStaff: { select: { id: true, name: true } },
      contactHistories: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          zoomRecordings: {
            where: { deletedAt: null, isPrimary: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { joinUrl: true },
          },
        },
      },
    },
  });

  if (!session) {
    return { ok: false, errorMessage: `Session not found: ${params.sessionId}` };
  }

  // 基本変数の準備
  const primaryContact = session.companyRecord.contacts[0];
  const lineFriend = primaryContact?.lineFriend;
  const primaryCustomerUid = lineFriend?.uid ?? null;
  const referrerUid = lineFriend?.free1?.trim() || null;

  // お客様向けに LineFriend が明示指定されていればそちらの UID を優先。
  // 重要: 指定された LineFriend が存在しない/uid空 の場合は、プライマリへのサイレントフォールバックは絶対にしない。
  // （指定した人以外に誤って通知が飛ぶのを防ぐため、明示的にエラーで返す）
  let overrideCustomerUid: string | null = null;
  if (params.recipient === "customer" && params.customerLineFriendId) {
    const lf = await prisma.slpLineFriend.findUnique({
      where: { id: params.customerLineFriendId },
      select: { uid: true, deletedAt: true },
    });
    if (!lf || lf.deletedAt || !lf.uid?.trim()) {
      return {
        ok: false,
        errorMessage: `指定のお客様LineFriend(id=${params.customerLineFriendId})が見つからないか無効です（送信中止）`,
      };
    }
    overrideCustomerUid = lf.uid;
  }
  const customerUid =
    params.recipient === "customer" && params.customerLineFriendId
      ? overrideCustomerUid
      : primaryCustomerUid;

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

  // 担当者名解決: プロライン受信生テキスト > MasterStaff.name > "未登録"
  const resolvedStaffName = await resolveProlineStaffName({
    staffId: session.assignedStaffId,
    webhookFallback: session.prolineStaffName,
  });

  // 紹介者LineFriendが明示指定されていればそちらの情報で上書き。
  // 重要: 指定された紹介者が見つからない場合、サイレントフォールバックはせず明示エラー。
  let overrideReferrerUid: string | null = null;
  let overrideReferrerName: string | null = null;
  if (params.recipient === "referrer" && params.referrerLineFriendId) {
    const lf = await prisma.slpLineFriend.findUnique({
      where: { id: params.referrerLineFriendId },
      select: { uid: true, snsname: true, deletedAt: true },
    });
    if (!lf || lf.deletedAt || !lf.uid?.trim()) {
      return {
        ok: false,
        errorMessage: `指定の紹介者LineFriend(id=${params.referrerLineFriendId})が見つからないか無効です（送信中止）`,
      };
    }
    overrideReferrerUid = lf.uid;
    overrideReferrerName = lf.snsname;
  }

  // {{referrerName}} は「紹介者本人のSNS表示名」を意味するので、
  // override 指定がない場合も referrerUid (= primary.free1) から LineFriend を逆引きして解決する。
  // （従来は primaryContact.name にフォールバックしていたため「顧客名」が入って意味が食い違っていた）
  let resolvedReferrerName: string | null = overrideReferrerName;
  if (!resolvedReferrerName && referrerUid) {
    const ref = await prisma.slpLineFriend.findUnique({
      where: { uid: referrerUid },
      select: { snsname: true },
    });
    resolvedReferrerName = ref?.snsname ?? null;
  }

  // 変数準備（空白時は一律「(データの取得に失敗しました)」に置換）
  const primaryRecording = session.contactHistories[0]?.zoomRecordings[0];
  const vars: NotificationRenderVars = {
    companyName: orFallback(session.companyRecord.companyName),
    scheduledAt: orFallback(
      session.scheduledAt ? formatJstDateTime(session.scheduledAt) : null
    ),
    staffName: orFallback(resolvedStaffName),
    zoomUrl: orFallback(primaryRecording?.joinUrl),
    referrerName: orFallback(resolvedReferrerName),
    roundNumber: String(session.roundNumber),
  };

  const bodyText = renderTemplateBody(template.body, vars);

  // 送信先 UID
  // 明示指定(customer/referrer LineFriendId)がある場合は、必ずそのLineFriendへ送る（フォールバックしない）
  const targetUid =
    params.recipient === "customer"
      ? customerUid
      : params.referrerLineFriendId
        ? overrideReferrerUid
        : referrerUid;
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
