"use server";

import { prisma } from "@/lib/prisma";
import { submitProlineForm } from "@/lib/proline-form";
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

  return { success: false, message: "リトライ対象ではありません" };
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
    return { success: true, message: "ProLineフォーム送信に成功しました" };
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
