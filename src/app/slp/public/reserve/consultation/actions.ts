"use server";

import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm14PreFillConsultationReservation } from "@/lib/proline-form";
import {
  generateReservationToken,
  PENDING_EXPIRES_MS,
} from "@/lib/slp/reserve/resolver";

export type CreateConsultationPendingResult =
  | {
      success: true;
      token: string;
      calendarUrl: string;
      expectedCompanyName: string;
    }
  | { success: false; error: string };

/**
 * 導入希望商談予約のペンディング情報を作成 + プロラインへフォーム事前送信
 *
 * 導入希望商談は「概要案内が完了している企業」のみから選択。
 * 新規企業の選択肢はない。
 */
export async function createConsultationPendingAction(params: {
  uid: string;
  companyRecordId: number;
}): Promise<CreateConsultationPendingResult> {
  const { uid, companyRecordId } = params;

  if (!uid) {
    return { success: false, error: "uidが指定されていません" };
  }

  // 対象企業を取得 + 概要案内完了チェック
  const record = await prisma.slpCompanyRecord.findFirst({
    where: {
      id: companyRecordId,
      deletedAt: null,
    },
    select: {
      id: true,
      companyName: true,
      briefingStatus: true,
    },
  });

  if (!record) {
    return { success: false, error: "選択した企業が見つかりません" };
  }

  if (record.briefingStatus !== "完了") {
    return {
      success: false,
      error: "この企業の概要案内が完了していないため、導入希望商談の予約はできません",
    };
  }

  const expectedCompanyName = record.companyName ?? "(企業名未登録)";
  const token = generateReservationToken();
  const expiresAt = new Date(Date.now() + PENDING_EXPIRES_MS);

  try {
    await prisma.slpReservationPending.create({
      data: {
        token,
        uid,
        reservationType: "consultation",
        companyRecordIds: [companyRecordId],
        newCompanyName: null,
        expectedCompanyName,
        expiresAt,
      },
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-reserve-consultation-pending",
      message: `ペンディング情報の保存に失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return { success: false, error: "システムエラーが発生しました" };
  }

  // プロライン側にフォーム事前送信（form14-1=企業名、form14-2=トークン）
  try {
    await submitForm14PreFillConsultationReservation(
      uid,
      expectedCompanyName,
      token
    );
  } catch (error) {
    await logAutomationError({
      source: "slp-reserve-consultation-prefill",
      message: `プロラインフォーム事前送信に失敗: uid=${uid}, token=${token}`,
      detail: {
        error: error instanceof Error ? error.message : String(error),
        expectedCompanyName,
      },
    });
    await prisma.slpReservationPending.update({
      where: { token },
      data: { consumedAt: new Date() },
    });
    return {
      success: false,
      error: "プロラインへの情報送信に失敗しました。しばらくしてからもう一度お試しください。",
    };
  }

  const calendarUrl = `https://zcr5z7pk.autosns.app/cl/K2J5RCSPKm?uid=${encodeURIComponent(uid)}`;

  return {
    success: true,
    token,
    calendarUrl,
    expectedCompanyName,
  };
}
