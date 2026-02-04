// 契約書ステータス変更の履歴記録ヘルパー
// 全体編集時にステータス変更を検出し、履歴を自動記録するための共通関数

import { Prisma, PrismaClient } from "@prisma/client";
import {
  ContractStatusInfo,
  DetectedContractStatusEvent,
} from "./types";
import { detectContractStatusEvent, createInitialEvent } from "./event-detector";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * ステータス変更を検出し履歴を記録する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param contractId - 契約書ID
 * @param currentStatusId - 変更前のステータスID
 * @param newStatusId - 変更後のステータスID
 * @param changedBy - 変更者（省略時は「システム（全体編集）」）
 * @returns 履歴が記録された場合はtrue
 */
export async function recordStatusChangeIfNeeded(
  tx: TransactionClient,
  contractId: number,
  currentStatusId: number | null,
  newStatusId: number | null,
  changedBy?: string
): Promise<boolean> {
  // 新しいステータスがnullの場合は記録しない
  if (newStatusId === null) {
    return false;
  }

  // ステータスが変わっていない場合は記録しない
  if (currentStatusId === newStatusId) {
    return false;
  }

  // ステータスマスタを取得
  const statusRecords = await tx.masterContractStatus.findMany({
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
      currentStatusId,
      newStatusId,
      note: undefined,
    },
    statuses
  );

  // 変更がない場合はスキップ
  if (!eventResult.hasChanges || !eventResult.event) {
    return false;
  }

  const event = eventResult.event;

  // 履歴を記録
  await tx.masterContractStatusHistory.create({
    data: {
      contractId,
      eventType: event.eventType,
      fromStatusId: event.fromStatusId,
      toStatusId: event.toStatusId,
      changedBy: changedBy ?? "システム（全体編集）",
      note: null,
      recordedAt: new Date(),
    },
  });

  return true;
}

/**
 * 契約書新規作成時の履歴を記録する
 *
 * @param tx - Prismaトランザクションクライアント
 * @param contractId - 契約書ID
 * @param initialStatusId - 初期ステータスID
 * @param changedBy - 作成者（省略時は「システム（全体編集）」）
 * @returns 履歴が記録された場合はtrue
 */
export async function recordContractCreationInTx(
  tx: TransactionClient,
  contractId: number,
  initialStatusId: number | null,
  changedBy?: string
): Promise<boolean> {
  if (initialStatusId === null) {
    return false;
  }

  const event = createInitialEvent(initialStatusId);
  if (!event) {
    return false;
  }

  await tx.masterContractStatusHistory.create({
    data: {
      contractId,
      eventType: event.eventType,
      fromStatusId: event.fromStatusId,
      toStatusId: event.toStatusId,
      changedBy: changedBy ?? "システム（全体編集）",
      note: null,
      recordedAt: new Date(),
    },
  });

  return true;
}
