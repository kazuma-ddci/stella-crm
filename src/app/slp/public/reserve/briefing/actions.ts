"use server";

import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm3PreFillBriefingReservation } from "@/lib/proline-form";
import {
  generateReservationToken,
  PENDING_EXPIRES_MS,
} from "@/lib/slp/reserve/resolver";

export type CreateBriefingPendingResult =
  | {
      success: true;
      token: string;
      calendarUrl: string;
      expectedCompanyName: string;
    }
  | { success: false; error: string };

/**
 * 概要案内予約のペンディング情報を作成 + プロラインへフォーム事前送信
 *
 * 既存企業の予約: companyRecordIds に既存レコードIDを入れる
 * 新規企業の予約: newCompanyName に企業名（カンマ区切り可）を入れる
 */
export async function createBriefingPendingAction(params: {
  uid: string;
  companyRecordIds?: number[];
  newCompanyName?: string;
}): Promise<CreateBriefingPendingResult> {
  const { uid, companyRecordIds, newCompanyName } = params;

  if (!uid) {
    return { success: false, error: "uidが指定されていません" };
  }

  // どちらか必須
  if (!companyRecordIds?.length && !newCompanyName?.trim()) {
    return {
      success: false,
      error: "企業を選択するか企業名を入力してください",
    };
  }

  // 企業名を構築（フォームに送る用 + 整合性チェック用）
  let expectedCompanyName: string;
  if (companyRecordIds?.length) {
    // 既存企業: DB から名前を取得して結合
    const records = await prisma.slpCompanyRecord.findMany({
      where: {
        id: { in: companyRecordIds },
        deletedAt: null,
      },
      select: { id: true, companyName: true },
    });
    if (records.length === 0) {
      return { success: false, error: "選択した企業が見つかりません" };
    }
    expectedCompanyName = records
      .map((r) => r.companyName ?? "(企業名未登録)")
      .join(", ");
  } else {
    expectedCompanyName = newCompanyName!.trim();
  }

  // トークン生成 + ペンディング情報保存
  const token = generateReservationToken();
  const expiresAt = new Date(Date.now() + PENDING_EXPIRES_MS);

  try {
    await prisma.slpReservationPending.create({
      data: {
        token,
        uid,
        reservationType: "briefing",
        companyRecordIds: companyRecordIds ?? [],
        newCompanyName: newCompanyName?.trim() || null,
        expectedCompanyName,
        expiresAt,
      },
    });
  } catch (error) {
    await logAutomationError({
      source: "slp-reserve-briefing-pending",
      message: `ペンディング情報の保存に失敗: uid=${uid}`,
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return { success: false, error: "システムエラーが発生しました" };
  }

  // プロライン側にフォーム事前送信（form3-1=企業名、form3-5=トークン）
  try {
    await submitForm3PreFillBriefingReservation(uid, expectedCompanyName, token);
  } catch (error) {
    await logAutomationError({
      source: "slp-reserve-briefing-prefill",
      message: `プロラインフォーム事前送信に失敗: uid=${uid}, token=${token}`,
      detail: {
        error: error instanceof Error ? error.message : String(error),
        expectedCompanyName,
      },
    });
    // ペンディング情報を即座に消費済みにしてクリーンアップ
    await prisma.slpReservationPending.update({
      where: { token },
      data: { consumedAt: new Date() },
    });
    return {
      success: false,
      error: "プロラインへの情報送信に失敗しました。しばらくしてからもう一度お試しください。",
    };
  }

  // 予約カレンダーURL（uidをクエリで渡す）
  const calendarUrl = `https://zcr5z7pk.autosns.app/cl/gUoC9cmzVa?uid=${encodeURIComponent(uid)}`;

  return {
    success: true,
    token,
    calendarUrl,
    expectedCompanyName,
  };
}
