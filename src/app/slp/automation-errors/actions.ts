"use server";

import { prisma } from "@/lib/prisma";
import {
  submitProlineForm,
  submitForm6BriefingReservation,
  submitForm7BriefingChange,
  submitForm9BriefingCancel,
  submitForm10BriefingComplete,
  submitForm11BriefingThankYou,
  submitForm12ContractReminder,
  addBriefingCompleteTag,
  removeBriefingCompleteTag,
} from "@/lib/proline-form";
import { sendSlpContract } from "@/lib/slp-cloudsign";
import type { ProlineFormData } from "@/lib/proline-form";

export async function retryAutomationError(
  errorId: number
): Promise<{ success: boolean; message: string }> {
  const error = await prisma.automationError.findUnique({
    where: { id: errorId },
  });

  if (!error) {
    return { success: false, message: "エラーレコードが見つかりません" };
  }

  if (error.resolved) {
    return { success: false, message: "このエラーは既に解決済みです" };
  }

  let detail: Record<string, unknown>;
  try {
    detail = JSON.parse(error.detail || "{}");
  } catch {
    return { success: false, message: "エラー詳細の解析に失敗しました" };
  }

  const retryAction = detail.retryAction as string | undefined;

  if (retryAction === "proline-form-submit") {
    return retryProlineFormSubmit(errorId, detail);
  }
  if (retryAction === "cloudsign-send") {
    return retryCloudsignSend(errorId, detail);
  }
  if (retryAction === "tag-briefing-complete-add") {
    return retryTagOperation(errorId, detail, "add");
  }
  if (retryAction === "tag-briefing-complete-remove") {
    return retryTagOperation(errorId, detail, "remove");
  }
  if (retryAction === "form6-briefing-reservation") {
    return retryForm6(errorId, detail);
  }
  if (retryAction === "form7-briefing-change") {
    return retryForm7(errorId, detail);
  }
  if (retryAction === "form9-briefing-cancel") {
    return retryForm9(errorId, detail);
  }
  if (retryAction === "form10-briefing-complete") {
    return retryForm10(errorId, detail);
  }
  if (retryAction === "form11-briefing-thank-you") {
    return retryForm11(errorId, detail);
  }
  if (retryAction === "form12-contract-reminder") {
    return retryForm12(errorId, detail);
  }

  return { success: false, message: "リトライ対象ではありません" };
}

async function markResolved(errorId: number): Promise<void> {
  await prisma.automationError.update({
    where: { id: errorId },
    data: { resolved: true },
  });
}

function fail(prefix: string, err: unknown): { success: false; message: string } {
  return {
    success: false,
    message: `${prefix}: ${err instanceof Error ? err.message : String(err)}`,
  };
}

async function retryTagOperation(
  errorId: number,
  detail: Record<string, unknown>,
  action: "add" | "remove"
): Promise<{ success: boolean; message: string }> {
  const uid = detail.uid as string | undefined;
  if (!uid) return { success: false, message: "uidが不足しています" };
  try {
    if (action === "add") {
      await addBriefingCompleteTag(uid);
    } else {
      await removeBriefingCompleteTag(uid);
    }
    await markResolved(errorId);
    return {
      success: true,
      message: `タグ${action === "add" ? "付与" : "削除"}に成功しました`,
    };
  } catch (e) {
    return fail(`タグ${action === "add" ? "付与" : "削除"}に失敗しました`, e);
  }
}

async function retryForm6(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const referrerUid = detail.referrerUid as string | undefined;
  const snsname = detail.snsname as string | undefined;
  const briefingDate = (detail.briefingDate as string | undefined) ?? "";
  if (!referrerUid || !snsname) return { success: false, message: "必要情報が不足しています" };
  try {
    await submitForm6BriefingReservation(referrerUid, snsname, briefingDate);
    await markResolved(errorId);
    return { success: true, message: "概要案内予約通知の再送に成功しました" };
  } catch (e) {
    return fail("再送に失敗しました", e);
  }
}

async function retryForm7(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const referrerUid = detail.referrerUid as string | undefined;
  const snsname = detail.snsname as string | undefined;
  const briefingDate = (detail.briefingDate as string | undefined) ?? "";
  if (!referrerUid || !snsname) return { success: false, message: "必要情報が不足しています" };
  try {
    await submitForm7BriefingChange(referrerUid, snsname, briefingDate);
    await markResolved(errorId);
    return { success: true, message: "概要案内変更通知の再送に成功しました" };
  } catch (e) {
    return fail("再送に失敗しました", e);
  }
}

async function retryForm9(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const referrerUid = detail.referrerUid as string | undefined;
  const snsname = detail.snsname as string | undefined;
  if (!referrerUid || !snsname) return { success: false, message: "必要情報が不足しています" };
  try {
    await submitForm9BriefingCancel(referrerUid, snsname);
    await markResolved(errorId);
    return { success: true, message: "概要案内キャンセル通知の再送に成功しました" };
  } catch (e) {
    return fail("再送に失敗しました", e);
  }
}

async function retryForm10(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const referrerUid = detail.referrerUid as string | undefined;
  const snsname = detail.snsname as string | undefined;
  if (!referrerUid || !snsname) return { success: false, message: "必要情報が不足しています" };
  try {
    await submitForm10BriefingComplete(referrerUid, snsname);
    await markResolved(errorId);
    return { success: true, message: "概要案内完了通知の再送に成功しました" };
  } catch (e) {
    return fail("再送に失敗しました", e);
  }
}

async function retryForm11(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const uid = detail.uid as string | undefined;
  const freeText = detail.freeText as string | undefined;
  if (!uid || !freeText) return { success: false, message: "必要情報が不足しています" };
  try {
    await submitForm11BriefingThankYou(uid, freeText);
    await markResolved(errorId);
    return { success: true, message: "お礼メッセージの再送に成功しました" };
  } catch (e) {
    return fail("再送に失敗しました", e);
  }
}

async function retryForm12(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const uid = detail.uid as string | undefined;
  const sentDate = (detail.sentDate as string | undefined) ?? "";
  const email = detail.email as string | undefined;
  if (!uid || !email) return { success: false, message: "必要情報が不足しています" };
  try {
    await submitForm12ContractReminder(uid, sentDate, email);
    await markResolved(errorId);
    return { success: true, message: "契約書リマインドLINEの再送に成功しました" };
  } catch (e) {
    return fail("再送に失敗しました", e);
  }
}

async function retryProlineFormSubmit(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const uid = detail.uid as string;
  const formData: ProlineFormData = {
    memberCategory: detail.memberCategory as string,
    name: detail.name as string,
    position: detail.position as string,
    email: detail.email as string,
    phone: detail.phone as string,
    company: (detail.company as string | null) ?? null,
    address: detail.address as string,
    note: (detail.note as string | null) ?? null,
  };

  try {
    await submitProlineForm(uid, formData);
    await prisma.automationError.update({
      where: { id: errorId },
      data: { resolved: true },
    });
    return { success: true, message: "プロラインフォーム送信に成功しました" };
  } catch (err) {
    return {
      success: false,
      message: `再送信に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function retryCloudsignSend(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const uid = detail.uid as string;
  const name = detail.name as string;
  const email = detail.email as string;

  if (!uid || !name || !email) {
    return { success: false, message: "リトライに必要な情報が不足しています" };
  }

  const member = await prisma.slpMember.findUnique({
    where: { uid },
  });

  if (!member || member.deletedAt) {
    return { success: false, message: "該当する組合員が見つかりません" };
  }

  if (member.status === "契約書送付済" || member.status === "組合員契約書締結") {
    await prisma.automationError.update({
      where: { id: errorId },
      data: { resolved: true },
    });
    return { success: true, message: "既に契約書は送付済みです。解決済みにしました" };
  }

  try {
    const result = await sendSlpContract({ email, name, slpMemberId: member.id });

    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        documentId: result.documentId,
        cloudsignUrl: result.cloudsignUrl,
        contractSentDate: new Date(),
        status: "契約書送付済",
      },
    });

    await prisma.automationError.update({
      where: { id: errorId },
      data: { resolved: true },
    });

    return { success: true, message: "契約書の送付に成功しました" };
  } catch (err) {
    return {
      success: false,
      message: `契約書の再送付に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function resolveError(
  errorId: number
): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.automationError.update({
      where: { id: errorId },
      data: { resolved: true },
    });
    return { success: true, message: "解決済みに更新しました" };
  } catch {
    return { success: false, message: "更新に失敗しました" };
  }
}
