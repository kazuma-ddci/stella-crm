import { prisma } from "@/lib/prisma";
import {
  submitZoomGuideMessage,
  submitZoomConsultMessage,
  ZOOM_GUIDE_FORM,
  ZOOM_CONSULT_FORM,
} from "@/lib/proline-form";
import { renderTemplate, formatJstDateTime, type MessageVars } from "@/lib/zoom/templates";
import { logAutomationError } from "@/lib/automation-error";

export type ZoomCategory = "briefing" | "consultation";
export type ZoomTrigger =
  | "confirm"
  | "change"
  | "remind_day_before"
  | "remind_hour_before"
  | "regenerated_manual_notice";

async function getTemplate(category: ZoomCategory, trigger: ZoomTrigger) {
  const templateKey = `${category}_${trigger}`;
  const tpl = await prisma.slpZoomMessageTemplate.findUnique({
    where: { templateKey },
  });
  if (!tpl) {
    throw new Error(`メッセージテンプレートが存在しません: ${templateKey}`);
  }
  if (!tpl.isActive) {
    throw new Error(`メッセージテンプレートが無効化されています: ${templateKey}`);
  }
  return tpl;
}

export type RenderContext = {
  companyName: string | null;
  staffName: string | null;
  dateJst: Date | null;
  url: string | null;
};

export function buildMessageVars(
  category: ZoomCategory,
  ctx: RenderContext
): MessageVars {
  return {
    事業者名: ctx.companyName ?? "",
    商談種別: category === "briefing" ? "概要案内" : "導入希望商談",
    日時: ctx.dateJst ? formatJstDateTime(ctx.dateJst) : "",
    担当者: ctx.staffName ?? "",
    url: ctx.url ?? "",
  };
}

/**
 * テンプレートをレンダリングしてプロライン経由でLINEへ送信。
 * 送信結果（success/failed）をslp_zoom_send_logsに記録。
 * 返り値はsuccess/failedとレンダリング済み本文。
 */
export async function sendZoomMessageViaProline(params: {
  companyRecordId: number;
  uid: string;
  category: ZoomCategory;
  trigger: ZoomTrigger;
  ctx: RenderContext;
}): Promise<{ ok: boolean; bodyText: string; errorMessage?: string }> {
  const tpl = await getTemplate(params.category, params.trigger);
  const vars = buildMessageVars(params.category, params.ctx);
  const bodyText = renderTemplate(tpl.body, vars);

  const formMeta =
    params.category === "briefing" ? ZOOM_GUIDE_FORM : ZOOM_CONSULT_FORM;

  let result: {
    ok: boolean;
    httpStatus: number;
    responseJson: unknown;
  };
  let thrown: unknown = null;
  try {
    result =
      params.category === "briefing"
        ? await submitZoomGuideMessage(params.uid, bodyText)
        : await submitZoomConsultMessage(params.uid, bodyText);
  } catch (err) {
    thrown = err;
    result = { ok: false, httpStatus: 0, responseJson: null };
  }

  await prisma.slpZoomSendLog.create({
    data: {
      companyRecordId: params.companyRecordId,
      category: params.category,
      trigger: params.trigger,
      uid: params.uid,
      formId: formMeta.formUrl.split("/").pop() ?? "",
      fieldKey: formMeta.fieldKey,
      bodyText,
      status: result.ok ? "success" : "failed",
      httpStatus: result.httpStatus || null,
      errorMessage: result.ok
        ? null
        : JSON.stringify({
            thrown:
              thrown instanceof Error ? thrown.message : thrown ?? null,
            response: result.responseJson,
          }),
    },
  });

  if (!result.ok) {
    await logAutomationError({
      source: `slp-zoom-send-${params.category}-${params.trigger}`,
      message: `Zoomメッセージ送信失敗 (companyRecordId=${params.companyRecordId}, trigger=${params.trigger})`,
      detail: {
        uid: params.uid,
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
        thrown instanceof Error
          ? thrown.message
          : `HTTP ${result.httpStatus}`,
    };
  }

  return { ok: true, bodyText };
}
