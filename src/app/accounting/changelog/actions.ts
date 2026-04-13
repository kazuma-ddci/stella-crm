"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { requireStaffForFinance } from "@/lib/auth/staff-action";

// ============================================
// 型定義
// ============================================

export type ChangeLogEntry = {
  id: number;
  tableName: string;
  recordId: number;
  changeType: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedBy: number;
  changedAt: Date;
  changer: { id: number; name: string };
};

type ChangeLogInput = {
  tableName: string;
  recordId: number;
  changeType: "create" | "update" | "delete";
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
};

// ============================================
// recordChangeLog（変更履歴の記録）
// ============================================

/**
 * 変更履歴を記録する。
 * Server Actionsから明示的に呼び出す。
 * txが渡された場合はそのトランザクション内で記録する。
 */
export async function recordChangeLog(
  input: ChangeLogInput,
  staffId: number,
  tx?: Prisma.TransactionClient
) {
  const db = tx || prisma;

  await db.changeLog.create({
    data: {
      tableName: input.tableName,
      recordId: input.recordId,
      changeType: input.changeType,
      oldData: (input.oldData as InputJsonValue) ?? undefined,
      newData: (input.newData as InputJsonValue) ?? undefined,
      changedBy: staffId,
    },
  });
}

/**
 * 複数の変更履歴を一括記録する。
 */
export async function recordChangeLogs(
  inputs: ChangeLogInput[],
  staffId: number,
  tx?: Prisma.TransactionClient
) {
  if (inputs.length === 0) return;

  const db = tx || prisma;

  await db.changeLog.createMany({
    data: inputs.map((input) => ({
      tableName: input.tableName,
      recordId: input.recordId,
      changeType: input.changeType,
      oldData: (input.oldData as InputJsonValue) ?? undefined,
      newData: (input.newData as InputJsonValue) ?? undefined,
      changedBy: staffId,
    })),
  });
}

// ============================================
// getChangeLogs（変更履歴の取得）
// ============================================

/**
 * 特定テーブル・レコードの変更履歴を取得する。
 */
export async function getChangeLogs(
  tableName: string,
  recordId: number
): Promise<ChangeLogEntry[]> {
  // 認証: 経理 OR 任意の事業PJ の閲覧権限以上（Phase 0暫定）
  // Phase 5 で tableName に応じた per-record helper に置換予定
  await requireStaffForFinance("view");

  const logs = await prisma.changeLog.findMany({
    where: { tableName, recordId },
    include: {
      changer: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    tableName: log.tableName,
    recordId: log.recordId,
    changeType: log.changeType,
    oldData: log.oldData as Record<string, unknown> | null,
    newData: log.newData as Record<string, unknown> | null,
    changedBy: log.changedBy,
    changedAt: log.changedAt,
    changer: log.changer,
  }));
}

/**
 * 特定レコードに関連する全ての変更履歴を取得する。
 * 例: 取引IDから、その取引自体 + 紐づく仕訳の変更履歴を一括取得。
 */
export async function getChangeLogsForTransaction(
  transactionId: number
): Promise<ChangeLogEntry[]> {
  // Phase 0暫定: 経理 OR 任意PJ の view 以上
  // Phase 5 で requireFinanceTransactionAccess(transactionId, "view") に置換予定
  await requireStaffForFinance("view");

  // 取引自体の変更履歴
  const transactionLogs = await prisma.changeLog.findMany({
    where: { tableName: "Transaction", recordId: transactionId },
    include: {
      changer: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  // 紐づく仕訳の変更履歴
  const journalEntries = await prisma.journalEntry.findMany({
    where: { transactionId },
    select: { id: true },
  });
  const journalIds = journalEntries.map((je) => je.id);

  let journalLogs: typeof transactionLogs = [];
  if (journalIds.length > 0) {
    journalLogs = await prisma.changeLog.findMany({
      where: { tableName: "JournalEntry", recordId: { in: journalIds } },
      include: {
        changer: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "desc" },
    });
  }

  const allLogs = [...transactionLogs, ...journalLogs].sort(
    (a, b) => b.changedAt.getTime() - a.changedAt.getTime()
  );

  return allLogs.map((log) => ({
    id: log.id,
    tableName: log.tableName,
    recordId: log.recordId,
    changeType: log.changeType,
    oldData: log.oldData as Record<string, unknown> | null,
    newData: log.newData as Record<string, unknown> | null,
    changedBy: log.changedBy,
    changedAt: log.changedAt,
    changer: log.changer,
  }));
}

// ============================================
// ヘルパー: 変更差分の抽出
// ============================================

/**
 * 2つのオブジェクトの差分を抽出する。
 * recordChangeLog に渡す oldData/newData を生成するために使う。
 * 変更のあったフィールドのみを含むオブジェクトを返す。
 */
export async function extractChanges(
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  fields: string[]
): Promise<{ oldData: Record<string, unknown>; newData: Record<string, unknown> } | null> {
  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};
  let hasChanges = false;

  for (const field of fields) {
    const oldVal = oldRecord[field];
    const newVal = newRecord[field];

    // Date同士の比較
    if (oldVal instanceof Date && newVal instanceof Date) {
      if (oldVal.getTime() !== newVal.getTime()) {
        oldData[field] = oldVal.toISOString();
        newData[field] = newVal.toISOString();
        hasChanges = true;
      }
      continue;
    }

    // JSON / オブジェクト同士の比較
    if (
      typeof oldVal === "object" &&
      oldVal !== null &&
      typeof newVal === "object" &&
      newVal !== null
    ) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        oldData[field] = oldVal;
        newData[field] = newVal;
        hasChanges = true;
      }
      continue;
    }

    // プリミティブ値の比較
    if (oldVal !== newVal) {
      oldData[field] = oldVal ?? null;
      newData[field] = newVal ?? null;
      hasChanges = true;
    }
  }

  return hasChanges ? { oldData, newData } : null;
}

/**
 * レコードから変更履歴に記録する主要フィールドを抽出する。
 * リレーション等を除外し、データフィールドのみを返す。
 */
export async function pickRecordData(
  record: Record<string, unknown>,
  fields: string[]
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    const val = record[field];
    if (val instanceof Date) {
      data[field] = val.toISOString();
    } else {
      data[field] = val ?? null;
    }
  }
  return data;
}


