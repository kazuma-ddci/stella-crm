"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { detectInitialEvents } from "@/lib/stage-transition/event-detector";
import { validateInitialStage } from "@/lib/stage-transition/alert-validator";
import { StageInfo, StageType } from "@/lib/stage-transition/types";

// 配列またはカンマ区切り文字列を文字列に変換するヘルパー関数
function toCommaSeparatedString(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter((v) => v).join(",") || null;
  }
  return String(value) || null;
}

export async function addStpCompany(data: Record<string, unknown>) {
  await requireEdit("stp");
  const currentStageId = data.currentStageId ? Number(data.currentStageId) : null;
  const nextTargetStageId = data.nextTargetStageId ? Number(data.nextTargetStageId) : null;
  const nextTargetDate = data.nextTargetDate ? new Date(data.nextTargetDate as string) : null;

  // ステージマスタを取得してバリデーション
  const stages = await prisma.stpStage.findMany({
    where: { isActive: true },
    orderBy: [
      { displayOrder: { sort: "asc", nulls: "last" } },
      { id: "asc" },
    ],
  });
  const stageInfos: StageInfo[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    stageType: s.stageType as StageType,
    isActive: s.isActive,
  }));

  // バリデーション
  const validation = validateInitialStage(
    currentStageId,
    nextTargetStageId,
    nextTargetDate,
    stageInfos
  );

  if (!validation.isValid) {
    const errorMessages = validation.alerts
      .filter((a) => a.severity === "ERROR")
      .map((a) => a.message)
      .join("\n");
    throw new Error(errorMessages || "バリデーションエラー");
  }

  // 企業IDの重複チェック
  const companyId = Number(data.companyId);
  const existingStpCompany = await prisma.stpCompany.findFirst({
    where: { companyId },
    select: { id: true },
  });

  if (existingStpCompany) {
    throw new Error(
      `この企業はすでにSTPプロジェクトに登録されています（プロジェクトNo. ${existingStpCompany.id}）`
    );
  }

  // トランザクションで企業作成と履歴作成を実行
  await prisma.$transaction(async (tx) => {
    // 請求先担当者ID
    const billingContactIds = toCommaSeparatedString(data.billingContactIds);

    // 1. 企業を作成
    const company = await tx.stpCompany.create({
      data: {
        companyId,
        agentId: data.agentId ? Number(data.agentId) : null,
        currentStageId,
        nextTargetStageId,
        nextTargetDate,
        leadAcquiredDate: data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null,
        forecast: (data.forecast as string) || null,
        plannedHires: data.plannedHires ? Number(data.plannedHires) : null,
        leadSourceId: data.leadSourceId ? Number(data.leadSourceId) : null,
        salesStaffId: data.salesStaffId ? Number(data.salesStaffId) : null,
        // 請求先情報（複数選択はカンマ区切りで保存）
        billingLocationId: data.billingLocationId ? Number(data.billingLocationId) : null,
        billingAddress: toCommaSeparatedString(data.billingAddress),
        // billingContactIds（担当者ID）をbillingRepresentativeに保存
        billingRepresentative: billingContactIds,
        // その他
        note: (data.note as string) || null,
        pendingReason: (data.pendingReason as string) || null,
        lostReason: (data.lostReason as string) || null,
      },
    });

    // 2. 初回履歴を作成
    const events = detectInitialEvents(currentStageId, nextTargetStageId, nextTargetDate);

    for (const event of events) {
      await tx.stpStageHistory.create({
        data: {
          stpCompanyId: company.id,
          eventType: event.eventType,
          fromStageId: event.fromStageId,
          toStageId: event.toStageId,
          targetDate: event.targetDate,
          note: "新規登録",
          alertAcknowledged: false,
        },
      });
    }
  });

  revalidatePath("/stp/companies");
}

export async function updateStpCompany(id: number, data: Record<string, unknown>) {
  await requireEdit("stp");
  // 更新データを動的に構築（渡されたフィールドのみを更新）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  // 企業ID（companyIdが渡された場合のみ）
  if ("companyId" in data) {
    updateData.companyId = Number(data.companyId);
  }

  // 代理店ID
  if ("agentId" in data) {
    updateData.agentId = data.agentId ? Number(data.agentId) : null;
  }

  // リード獲得日
  if ("leadAcquiredDate" in data) {
    updateData.leadAcquiredDate = data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null;
  }

  // ヨミ
  if ("forecast" in data) {
    updateData.forecast = (data.forecast as string) || null;
  }

  // 採用予定人数
  if ("plannedHires" in data) {
    updateData.plannedHires = data.plannedHires ? Number(data.plannedHires) : null;
  }

  // 流入経路ID
  if ("leadSourceId" in data) {
    updateData.leadSourceId = data.leadSourceId ? Number(data.leadSourceId) : null;
  }

  // 担当営業ID
  if ("salesStaffId" in data) {
    updateData.salesStaffId = data.salesStaffId ? Number(data.salesStaffId) : null;
  }

  // 請求先住所（複数選択はカンマ区切りで保存）
  if ("billingAddress" in data) {
    updateData.billingAddress = toCommaSeparatedString(data.billingAddress);
  }

  // 請求先拠点ID
  if ("billingLocationId" in data) {
    updateData.billingLocationId = data.billingLocationId ? Number(data.billingLocationId) : null;
  }

  // 請求先担当者IDs（複数）- billingRepresentativeに保存
  if ("billingContactIds" in data) {
    const billingContactIds = toCommaSeparatedString(data.billingContactIds);
    updateData.billingRepresentative = billingContactIds;
  }

  // 企業メモ
  if ("note" in data) {
    updateData.note = (data.note as string) || null;
  }

  // 検討理由・失注理由の更新時は履歴も記録する
  const isPendingReasonChanged = "pendingReason" in data;
  const isLostReasonChanged = "lostReason" in data;

  if (isPendingReasonChanged || isLostReasonChanged) {
    // 現在の値を取得
    const company = await prisma.stpCompany.findUnique({
      where: { id },
      select: { pendingReason: true, lostReason: true },
    });

    // トランザクションで企業更新と履歴作成を実行
    await prisma.$transaction(async (tx) => {
      // 検討理由
      if (isPendingReasonChanged) {
        const newValue = (data.pendingReason as string) || null;
        // 値が変更された場合のみ履歴を記録
        if (company?.pendingReason !== newValue) {
          await tx.stpStageHistory.create({
            data: {
              stpCompanyId: id,
              eventType: "reason_updated",
              fromStageId: null,
              toStageId: null,
              targetDate: null,
              note: null,
              alertAcknowledged: false,
              pendingReason: newValue,
            },
          });
        }
        updateData.pendingReason = newValue;
      }

      // 失注理由
      if (isLostReasonChanged) {
        const newValue = (data.lostReason as string) || null;
        // 値が変更された場合のみ履歴を記録
        if (company?.lostReason !== newValue) {
          await tx.stpStageHistory.create({
            data: {
              stpCompanyId: id,
              eventType: "reason_updated",
              fromStageId: null,
              toStageId: null,
              targetDate: null,
              note: null,
              alertAcknowledged: false,
              lostReason: newValue,
            },
          });
        }
        updateData.lostReason = newValue;
      }

      // データベースを更新
      await tx.stpCompany.update({
        where: { id },
        data: updateData,
      });
    });
  } else {
    // 理由の変更がない場合は通常の更新
    await prisma.stpCompany.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/stp/companies");
}

export async function deleteStpCompany(id: number) {
  await requireEdit("stp");
  await prisma.stpCompany.delete({
    where: { id },
  });
  revalidatePath("/stp/companies");
}

// 企業IDの重複チェック（リアルタイム用）
export async function checkDuplicateCompanyId(companyId: number): Promise<{ isDuplicate: boolean; stpCompanyId?: number }> {
  const existing = await prisma.stpCompany.findFirst({
    where: { companyId },
    select: { id: true },
  });

  if (existing) {
    return { isDuplicate: true, stpCompanyId: existing.id };
  }
  return { isDuplicate: false };
}
