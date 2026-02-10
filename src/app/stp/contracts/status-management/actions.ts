"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireEdit } from "@/lib/auth";
import {
  ContractStatusManagementData,
  ContractStatusInfo,
  ContractStatusHistoryRecord,
  ContractStatusStatistics,
  ContractStatusUpdateParams,
  ContractStatusEventType,
} from "@/lib/contract-status/types";
import {
  detectContractStatusEvent,
  createInitialEvent,
} from "@/lib/contract-status/event-detector";
import {
  validateContractStatusChange,
  calculateDaysSinceStatusChange,
} from "@/lib/contract-status/alert-validator";

/**
 * 契約書のステータス管理データを取得
 */
export async function getContractStatusManagementData(
  contractId: number
): Promise<ContractStatusManagementData> {
  // 契約書情報を取得
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    include: {
      company: true,
      currentStatus: true,
    },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  // ステータスマスタを取得
  const statusRecords = await prisma.masterContractStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  const statuses: ContractStatusInfo[] = statusRecords.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isTerminal: s.isTerminal,
    isActive: s.isActive,
  }));

  // 履歴を取得
  const historyRecords = await prisma.masterContractStatusHistory.findMany({
    where: { contractId },
    include: {
      fromStatus: true,
      toStatus: true,
    },
    orderBy: { recordedAt: "desc" },
  });

  const histories: ContractStatusHistoryRecord[] = historyRecords.map((h) => ({
    id: h.id,
    contractId: h.contractId,
    eventType: h.eventType as ContractStatusEventType,
    fromStatusId: h.fromStatusId,
    toStatusId: h.toStatusId,
    recordedAt: h.recordedAt,
    changedBy: h.changedBy,
    note: h.note,
    fromStatus: h.fromStatus
      ? {
          id: h.fromStatus.id,
          name: h.fromStatus.name,
          displayOrder: h.fromStatus.displayOrder,
          isTerminal: h.fromStatus.isTerminal,
          isActive: h.fromStatus.isActive,
        }
      : null,
    toStatus: h.toStatus
      ? {
          id: h.toStatus.id,
          name: h.toStatus.name,
          displayOrder: h.toStatus.displayOrder,
          isTerminal: h.toStatus.isTerminal,
          isActive: h.toStatus.isActive,
        }
      : null,
  }));

  // 統計情報を計算
  const statistics = calculateStatistics(histories);

  // 現在のステータス情報
  const currentStatus = contract.currentStatus
    ? {
        id: contract.currentStatus.id,
        name: contract.currentStatus.name,
        displayOrder: contract.currentStatus.displayOrder,
        isTerminal: contract.currentStatus.isTerminal,
        isActive: contract.currentStatus.isActive,
      }
    : null;

  return {
    contractId: contract.id,
    contractTitle: contract.title,
    companyName: contract.company.name,
    assignedTo: contract.assignedTo,
    currentStatusId: contract.currentStatusId,
    currentStatus,
    histories,
    statistics,
    statuses,
  };
}

/**
 * 統計情報を計算
 */
function calculateStatistics(
  histories: ContractStatusHistoryRecord[]
): ContractStatusStatistics {
  // 履歴がない場合のデフォルト値
  if (histories.length === 0) {
    return {
      totalChanges: 0,
      averageDaysPerStatus: 0,
      currentStatusDays: 0,
      statusStartDate: null,
    };
  }

  // 総変更回数（createdイベントを除く）
  const totalChanges = histories.filter((h) => h.eventType !== "created").length;

  // 現在のステータス滞在日数
  const latestHistory = histories[0];
  const currentStatusDays = calculateDaysSinceStatusChange(latestHistory) ?? 0;
  const statusStartDate = latestHistory?.recordedAt ?? null;

  // 平均滞在日数を計算
  let averageDaysPerStatus = 0;
  if (histories.length >= 2) {
    // 各ステータス間の日数を計算
    let totalDays = 0;
    let statusCount = 0;

    for (let i = 0; i < histories.length - 1; i++) {
      const currentDate = new Date(histories[i].recordedAt);
      const prevDate = new Date(histories[i + 1].recordedAt);
      const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      totalDays += diffDays;
      statusCount++;
    }

    if (statusCount > 0) {
      averageDaysPerStatus = Math.round(totalDays / statusCount);
    }
  }

  return {
    totalChanges,
    averageDaysPerStatus,
    currentStatusDays,
    statusStartDate,
  };
}

/**
 * ステータスを更新し履歴を記録
 */
export async function updateContractStatusWithHistory(
  params: ContractStatusUpdateParams
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireEdit("stp");
    const { contractId, newStatusId, note, alertAcknowledged, signedDate } = params;

    // セッションからユーザー名を取得
    const session = await auth();
    const changedBy = session?.user?.name ?? null;

    // 現在の契約書情報を取得
    const contract = await prisma.masterContract.findUnique({
      where: { id: contractId },
      include: { currentStatus: true },
    });

    if (!contract) {
      return { success: false, error: "契約書が見つかりません" };
    }

    // ステータスマスタを取得
    const statusRecords = await prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    const statuses: ContractStatusInfo[] = statusRecords.map((s) => ({
      id: s.id,
      name: s.name,
      displayOrder: s.displayOrder,
      isTerminal: s.isTerminal,
      isActive: s.isActive,
    }));

    // イベントを検出
    const eventResult = detectContractStatusEvent(
      {
        currentStatusId: contract.currentStatusId,
        newStatusId,
        note,
      },
      statuses
    );

    // 変更がない場合
    if (!eventResult.hasChanges || !eventResult.event) {
      return { success: false, error: "ステータスに変更がありません" };
    }

    // バリデーション
    const validation = validateContractStatusChange(
      {
        currentStatusId: contract.currentStatusId,
        newStatusId,
        note,
      },
      statuses
    );

    // 理由必須のアラートがあり、メモがない場合
    const requiresNoteAlert = validation.alerts.find((a) => a.requiresNote);
    if (requiresNoteAlert && (!note || note.trim().length === 0)) {
      return { success: false, error: "理由を入力してください" };
    }

    // WARNINGがあり、確認されていない場合
    if (validation.hasWarnings && !alertAcknowledged) {
      return { success: false, error: "警告を確認してください" };
    }

    const event = eventResult.event;

    // トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // 契約書のステータスを更新
      const updateData: {
        currentStatusId: number | null;
        signedDate?: Date | null;
      } = {
        currentStatusId: newStatusId,
      };

      // 締結ステータスに変更した場合、締結日を設定
      const newStatus = statuses.find((s) => s.id === newStatusId);
      if (newStatus?.id === 7) {
        // TERMINAL_STATUS_IDS.SIGNED = 7
        // フォームから締結日が指定された場合はその日付を使用
        if (signedDate) {
          updateData.signedDate = new Date(signedDate);
        } else {
          // フォールバック: 今日の日付
          updateData.signedDate = new Date();
        }
      }

      await tx.masterContract.update({
        where: { id: contractId },
        data: updateData,
      });

      // 履歴を記録
      await tx.masterContractStatusHistory.create({
        data: {
          contractId,
          eventType: event.eventType,
          fromStatusId: event.fromStatusId,
          toStatusId: event.toStatusId,
          changedBy: changedBy ?? null,
          note: note ?? null,
          recordedAt: new Date(),
        },
      });
    });

    revalidatePath("/stp/contracts");
    return { success: true };
  } catch (error) {
    console.error("Failed to update contract status:", error);
    return { success: false, error: "ステータスの更新に失敗しました" };
  }
}

/**
 * 契約書作成時に履歴を記録
 */
export async function recordContractCreation(
  contractId: number,
  initialStatusId: number | null
): Promise<void> {
  await requireEdit("stp");
  if (initialStatusId === null) return;

  const event = createInitialEvent(initialStatusId);
  if (!event) return;

  // セッションからユーザー名を取得
  const session = await auth();
  const changedBy = session?.user?.name ?? null;

  await prisma.masterContractStatusHistory.create({
    data: {
      contractId,
      eventType: event.eventType,
      fromStatusId: event.fromStatusId,
      toStatusId: event.toStatusId,
      changedBy,
      note: null,
      recordedAt: new Date(),
    },
  });
}

/**
 * 一覧表示用の滞留日数を取得
 */
export async function getContractStaleInfo(
  contractId: number
): Promise<{ daysSinceStatusChange: number | null }> {
  const latestHistory = await prisma.masterContractStatusHistory.findFirst({
    where: { contractId },
    orderBy: { recordedAt: "desc" },
  });

  if (!latestHistory) {
    return { daysSinceStatusChange: null };
  }

  const daysSinceStatusChange = calculateDaysSinceStatusChange({
    id: latestHistory.id,
    contractId: latestHistory.contractId,
    eventType: latestHistory.eventType as ContractStatusEventType,
    fromStatusId: latestHistory.fromStatusId,
    toStatusId: latestHistory.toStatusId,
    recordedAt: latestHistory.recordedAt,
    changedBy: latestHistory.changedBy,
    note: latestHistory.note,
  });

  return { daysSinceStatusChange };
}

/**
 * 複数の契約書の滞留情報を一括取得
 */
export async function getContractsStaleInfoBatch(
  contractIds: number[]
): Promise<Map<number, number | null>> {
  const histories = await prisma.masterContractStatusHistory.findMany({
    where: { contractId: { in: contractIds } },
    orderBy: { recordedAt: "desc" },
    distinct: ["contractId"],
  });

  const result = new Map<number, number | null>();

  for (const contractId of contractIds) {
    const history = histories.find((h) => h.contractId === contractId);
    if (history) {
      const days = calculateDaysSinceStatusChange({
        id: history.id,
        contractId: history.contractId,
        eventType: history.eventType as ContractStatusEventType,
        fromStatusId: history.fromStatusId,
        toStatusId: history.toStatusId,
        recordedAt: history.recordedAt,
        changedBy: history.changedBy,
        note: history.note,
      });
      result.set(contractId, days);
    } else {
      result.set(contractId, null);
    }
  }

  return result;
}
