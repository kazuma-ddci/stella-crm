"use server";

import { prisma } from "@/lib/prisma";
import {
  submitProlineForm,
  submitForm11BriefingThankYou,
  submitForm12ContractReminder,
  submitForm13ConsultationThankYou,
} from "@/lib/proline-form";
import { sendSlpContract } from "@/lib/slp-cloudsign";
import type { ProlineFormData } from "@/lib/proline-form";
import { getOptionalSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

export async function retryAutomationError(
  errorId: number
): Promise<{ success: boolean; message: string }> {
  // 認証: SLPプロジェクトの編集権限以上(自動化エラーの再試行は重要操作)
  // 戻り値が独自形式のため、redirect を飲まないよう getOptionalSession を使う
  const session = await getOptionalSession();
  if (!session) return { success: false, message: "認証が必要です" };
  if (session.userType !== "staff") {
    return { success: false, message: "社内スタッフのみ実行可能です" };
  }
  if (!hasPermission(session.permissions ?? [], "slp", "edit")) {
    return { success: false, message: "SLPプロジェクトの編集権限が必要です" };
  }

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
  // タグ機能は 2026-04-17 に全削除、旧エラーログがあれば retryAction には一致しない
  // Phase 1c で旧 form6/7/9/10 リトライは撤去（新 Form18 は過去エラーから
  // 送信内容を再現できないため、手動再送はスタッフが公式LINE管理画面から実施）
  if (retryAction === "form11-briefing-thank-you") {
    return retryForm11(errorId, detail);
  }
  if (retryAction === "form12-contract-reminder") {
    return retryForm12(errorId, detail);
  }
  if (retryAction === "form13-consultation-thank-you") {
    return retryForm13(errorId, detail);
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

// retryTagOperation は 2026-04-17 のタグ機能全削除で撤去
// retryForm6 / retryForm7 / retryForm9 / retryForm10 は撤去
// （Form6/7/9/10 は Form18 に統合済み、Phase 1c-6b で削除）

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

async function retryForm13(
  errorId: number,
  detail: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const uid = detail.uid as string | undefined;
  const freeText = detail.freeText as string | undefined;
  if (!uid || !freeText) return { success: false, message: "必要情報が不足しています" };
  try {
    await submitForm13ConsultationThankYou(uid, freeText);
    await markResolved(errorId);
    return { success: true, message: "導入希望商談お礼メッセージの再送に成功しました" };
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
  // 認証: SLPプロジェクトの編集権限以上
  const session = await getOptionalSession();
  if (!session) return { success: false, message: "認証が必要です" };
  if (session.userType !== "staff") {
    return { success: false, message: "社内スタッフのみ実行可能です" };
  }
  if (!hasPermission(session.permissions ?? [], "slp", "edit")) {
    return { success: false, message: "SLPプロジェクトの編集権限が必要です" };
  }

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
