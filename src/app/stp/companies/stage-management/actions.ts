"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  StageManagementData,
  StageStatistics,
  StageInfo,
  StageHistoryRecord,
  StageUpdateParams,
  DetectedEvent,
  StageEventType,
  RecommitSubType,
  StageType,
} from "@/lib/stage-transition/types";
import { detectEvents } from "@/lib/stage-transition/event-detector";
import { validateStageChange } from "@/lib/stage-transition/alert-validator";
import { EXCLUDED_FROM_STATS } from "@/lib/stage-transition/constants";

/**
 * ステージ管理モーダル用のデータを取得
 */
export async function getStageManagementData(
  stpCompanyId: number
): Promise<StageManagementData | null> {
  // 企業情報を取得
  const company = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    include: {
      company: true,
      currentStage: true,
      nextTargetStage: true,
      stageHistories: {
        where: { isVoided: false }, // 論理削除されていないもののみ
        include: {
          fromStage: true,
          toStage: true,
        },
        orderBy: { recordedAt: "desc" },
      },
    },
  });

  if (!company) {
    return null;
  }

  // ステージマスタを取得（displayOrderがnullのものも含む）
  const stages = await prisma.stpStage.findMany({
    where: { isActive: true },
    orderBy: [
      { displayOrder: { sort: "asc", nulls: "last" } },
      { id: "asc" },
    ],
  });

  // 統計情報を計算（論理削除されていないもののみ）
  const statistics = calculateStatistics(company.stageHistories);

  // 目標設定日を取得（最新のcommitまたはrecommitのrecordedAt）
  const targetSetRecord = company.stageHistories.find(
    (h) => !h.isVoided && (h.eventType === "commit" || h.eventType === "recommit")
  );

  // ステージ開始日を計算（現在のステージに遷移した最新の履歴）
  const stageStartRecord = company.stageHistories.find(
    (h) =>
      !h.isVoided &&
      (h.eventType === "progress" ||
        h.eventType === "achieved" ||
        h.eventType === "back" ||
        h.eventType === "won" ||
        h.eventType === "lost" ||
        h.eventType === "suspended" ||
        h.eventType === "resumed" ||
        h.eventType === "revived") &&
      h.toStageId === company.currentStageId
  );

  const stageStartDate = stageStartRecord?.recordedAt ?? null;
  const currentStageDays = stageStartDate
    ? Math.floor(
        (Date.now() - new Date(stageStartDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  return {
    companyId: company.id,
    companyName: company.company.name,
    currentStageId: company.currentStageId,
    currentStage: company.currentStage
      ? mapStageToInfo(company.currentStage)
      : null,
    nextTargetStageId: company.nextTargetStageId,
    nextTargetStage: company.nextTargetStage
      ? mapStageToInfo(company.nextTargetStage)
      : null,
    nextTargetDate: company.nextTargetDate,
    // 理由（検討中・失注の場合）
    pendingReason: company.pendingReason,
    lostReason: company.lostReason,
    pendingResponseDate: company.pendingResponseDate,
    histories: company.stageHistories.map(mapHistoryToRecord),
    statistics: {
      ...statistics,
      currentStageDays,
      stageStartDate,
    },
    stages: stages.map(mapStageToInfo),
    targetSetDate: targetSetRecord?.recordedAt ?? null,
  };
}

/**
 * ステージを更新（履歴も同時に作成）
 */
export async function updateStageWithHistory(
  params: StageUpdateParams
): Promise<{
  success: boolean;
  error?: string;
  events?: DetectedEvent[];
}> {
  const {
    stpCompanyId,
    newStageId,
    newTargetStageId,
    newTargetDate,
    note,
    changedBy,
    alertAcknowledged = false,
    lostReason,
    pendingReason,
    pendingResponseDate,
  } = params;

  // 現在の状態を取得
  const company = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    include: {
      stageHistories: {
        where: { isVoided: false },
        orderBy: { recordedAt: "desc" },
        include: {
          fromStage: true,
          toStage: true,
        },
      },
    },
  });

  if (!company) {
    return { success: false, error: "企業が見つかりません" };
  }

  // ステージマスタを取得
  const stages = await prisma.stpStage.findMany({
    where: { isActive: true },
    orderBy: [
      { displayOrder: { sort: "asc", nulls: "last" } },
      { id: "asc" },
    ],
  });
  const stageInfos = stages.map(mapStageToInfo);

  // イベントを検出
  const { events, hasChanges } = detectEvents(
    {
      currentStageId: company.currentStageId,
      currentTargetStageId: company.nextTargetStageId,
      currentTargetDate: company.nextTargetDate,
      newStageId,
      newTargetStageId,
      newTargetDate,
      note,
    },
    stageInfos
  );

  if (!hasChanges) {
    return { success: false, error: "変更がありません" };
  }

  // バリデーション
  const validation = validateStageChange({
    input: {
      currentStageId: company.currentStageId,
      currentTargetStageId: company.nextTargetStageId,
      currentTargetDate: company.nextTargetDate,
      newStageId,
      newTargetStageId,
      newTargetDate,
      note,
    },
    stages: stageInfos,
    detectedEvents: events,
    histories: company.stageHistories.map(mapHistoryToRecord),
    isNewRecord: false,
  });

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.alerts
        .filter((a) => a.severity === "ERROR")
        .map((a) => a.message)
        .join("\n"),
    };
  }

  // トランザクションで更新
  try {
    await prisma.$transaction(async (tx) => {
      // 1. 履歴を作成
      for (const event of events) {
        await tx.stpStageHistory.create({
          data: {
            stpCompanyId,
            eventType: event.eventType,
            fromStageId: event.fromStageId,
            toStageId: event.toStageId,
            targetDate: event.targetDate,
            changedBy: changedBy ?? null,
            note: note ?? null,
            alertAcknowledged,
            // 失注・検討中理由
            lostReason: event.eventType === "lost" ? lostReason : null,
            pendingReason: event.eventType === "suspended" ? pendingReason : null,
            // recommitのサブタイプ
            subType: event.subType ?? null,
          },
        });
      }

      // 2. 企業情報を更新
      const isAchieved = events.some((e) => e.eventType === "achieved");
      const isWon = events.some((e) => e.eventType === "won");
      const isLost = events.some((e) => e.eventType === "lost");
      const isSuspended = events.some((e) => e.eventType === "suspended");
      const hasNewCommit = events.some((e) => e.eventType === "commit");

      let finalTargetStageId = newTargetStageId;
      let finalTargetDate = newTargetDate;

      // 達成、受注、失注、検討中の場合で次の目標が設定されていない場合はクリア
      if ((isAchieved || isWon || isLost || isSuspended) && !hasNewCommit) {
        finalTargetStageId = null;
        finalTargetDate = null;
      }

      // 更新データ
      const updateData: Record<string, unknown> = {
        currentStageId: newStageId,
        nextTargetStageId: finalTargetStageId,
        nextTargetDate: finalTargetDate,
      };

      // 失注の場合、失注理由を更新
      if (isLost && lostReason) {
        updateData.lostReason = lostReason;
      }

      // 検討中の場合、検討中理由と回答予定日を更新
      if (isSuspended) {
        if (pendingReason) {
          updateData.pendingReason = pendingReason;
        }
        updateData.pendingResponseDate = pendingResponseDate ?? null;
      }

      // 検討中から別のステージに変更した場合、回答予定日をクリア
      const currentStage = stageInfos.find((s) => s.id === company.currentStageId);
      const newStage = stageInfos.find((s) => s.id === newStageId);
      if (currentStage?.stageType === "pending" && newStage?.stageType !== "pending") {
        updateData.pendingResponseDate = null;
      }

      await tx.stpCompany.update({
        where: { id: stpCompanyId },
        data: updateData,
      });
    });

    revalidatePath("/stp/companies");
    return { success: true, events };
  } catch (error) {
    console.error("Failed to update stage:", error);
    return { success: false, error: "ステージの更新に失敗しました" };
  }
}

/**
 * 統計情報を計算（論理削除・除外イベントを除く）
 */
function calculateStatistics(
  histories: Array<{
    eventType: string;
    recordedAt: Date;
    toStageId: number | null;
    isVoided: boolean;
  }>
): Omit<StageStatistics, "currentStageDays" | "stageStartDate"> {
  // 論理削除されていない、統計対象のイベントのみフィルタ
  const validHistories = histories.filter(
    (h) => !h.isVoided && !EXCLUDED_FROM_STATS.includes(h.eventType as StageEventType)
  );

  const achievedCount = validHistories.filter(
    (h) => h.eventType === "achieved"
  ).length;
  const cancelCount = validHistories.filter((h) => h.eventType === "cancel").length;
  const backCount = validHistories.filter((h) => h.eventType === "back").length;

  const totalTargets = achievedCount + cancelCount;
  const achievementRate =
    totalTargets > 0 ? Math.round((achievedCount / totalTargets) * 100) : 0;

  return {
    achievedCount,
    cancelCount,
    achievementRate,
    backCount,
  };
}

/**
 * Prismaモデルを型に変換
 */
function mapStageToInfo(stage: {
  id: number;
  name: string;
  displayOrder: number | null;
  stageType: string;
  isActive: boolean;
}): StageInfo {
  return {
    id: stage.id,
    name: stage.name,
    displayOrder: stage.displayOrder,
    stageType: stage.stageType as StageType,
    isActive: stage.isActive,
  };
}

function mapHistoryToRecord(history: {
  id: number;
  stpCompanyId: number;
  eventType: string;
  fromStageId: number | null;
  toStageId: number | null;
  targetDate: Date | null;
  recordedAt: Date;
  changedBy: string | null;
  note: string | null;
  alertAcknowledged: boolean;
  lostReason: string | null;
  pendingReason: string | null;
  subType: string | null;
  isVoided: boolean;
  fromStage?: { id: number; name: string; displayOrder: number | null; stageType: string; isActive: boolean } | null;
  toStage?: { id: number; name: string; displayOrder: number | null; stageType: string; isActive: boolean } | null;
}): StageHistoryRecord {
  return {
    id: history.id,
    stpCompanyId: history.stpCompanyId,
    eventType: history.eventType as StageEventType,
    fromStageId: history.fromStageId,
    toStageId: history.toStageId,
    targetDate: history.targetDate,
    recordedAt: history.recordedAt,
    changedBy: history.changedBy,
    note: history.note,
    alertAcknowledged: history.alertAcknowledged,
    lostReason: history.lostReason,
    pendingReason: history.pendingReason,
    subType: history.subType as RecommitSubType | null,
    isVoided: history.isVoided,
    fromStage: history.fromStage ? mapStageToInfo(history.fromStage) : null,
    toStage: history.toStage ? mapStageToInfo(history.toStage) : null,
  };
}

/**
 * 理由のみを更新（ステージ変更なし）
 * 履歴にreason_updatedイベントを記録する
 */
export async function updateReasonOnly(params: {
  stpCompanyId: number;
  lostReason?: string | null;
  pendingReason?: string | null;
  pendingResponseDate?: Date | null;
}): Promise<{ success: boolean; error?: string }> {
  const { stpCompanyId, lostReason, pendingReason, pendingResponseDate } = params;

  // 現在の状態を取得
  const company = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    select: { pendingReason: true, lostReason: true, pendingResponseDate: true },
  });

  if (!company) {
    return { success: false, error: "企業が見つかりません" };
  }

  // 変更があるかチェック
  const isPendingReasonChanged = pendingReason !== undefined && company.pendingReason !== pendingReason;
  const isLostReasonChanged = lostReason !== undefined && company.lostReason !== lostReason;
  const isPendingResponseDateChanged = pendingResponseDate !== undefined &&
    (company.pendingResponseDate?.getTime() !== pendingResponseDate?.getTime());

  if (!isPendingReasonChanged && !isLostReasonChanged && !isPendingResponseDateChanged) {
    return { success: false, error: "変更がありません" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 検討理由が変更された場合、履歴を記録
      if (isPendingReasonChanged) {
        await tx.stpStageHistory.create({
          data: {
            stpCompanyId,
            eventType: "reason_updated",
            fromStageId: null,
            toStageId: null,
            targetDate: null,
            note: null,
            alertAcknowledged: false,
            pendingReason: pendingReason ?? null,
          },
        });
      }

      // 失注理由が変更された場合、履歴を記録
      if (isLostReasonChanged) {
        await tx.stpStageHistory.create({
          data: {
            stpCompanyId,
            eventType: "reason_updated",
            fromStageId: null,
            toStageId: null,
            targetDate: null,
            note: null,
            alertAcknowledged: false,
            lostReason: lostReason ?? null,
          },
        });
      }

      // 企業情報を更新
      const updateData: Record<string, unknown> = {};
      if (pendingReason !== undefined) {
        updateData.pendingReason = pendingReason;
      }
      if (lostReason !== undefined) {
        updateData.lostReason = lostReason;
      }
      if (pendingResponseDate !== undefined) {
        updateData.pendingResponseDate = pendingResponseDate;
      }

      await tx.stpCompany.update({
        where: { id: stpCompanyId },
        data: updateData,
      });
    });

    revalidatePath("/stp/companies");
    return { success: true };
  } catch (error) {
    console.error("Failed to update reason:", error);
    return { success: false, error: "理由の更新に失敗しました" };
  }
}
