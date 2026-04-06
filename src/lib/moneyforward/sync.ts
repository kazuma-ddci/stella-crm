// ============================================
// MoneyForward 同期処理
// DBから接続情報を読み込み → API取得 → 変換 → 保存
// ============================================

import { prisma } from "@/lib/prisma";
import { MoneyForwardClient } from "./client";
import { transformMFTransaction } from "./transform";
import type { MFTransaction, SyncResult } from "./types";

/** 日付を "YYYY-MM-DD" 文字列に変換 */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 全ページの取引を取得（ページネーション対応） */
async function fetchAllTransactions(
  client: MoneyForwardClient,
  fromDate: string,
  toDate: string
): Promise<MFTransaction[]> {
  const allTransactions: MFTransaction[] = [];
  const pageSize = 100;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await client.getTransactions({
      fromDate,
      toDate,
      offset,
      limit: pageSize,
    });

    allTransactions.push(...res.transactions);

    // 全件取得済みか確認
    if (offset + res.transactions.length >= res.total_count) {
      break;
    }
    offset += pageSize;
  }

  return allTransactions;
}

/**
 * MoneyForward の取引データを同期する
 *
 * 1. DB から接続情報を読み込み
 * 2. 日付範囲を決定（lastSyncedAt ~ 今日、初回は syncFromDate から）
 * 3. MF API から取引を全件取得
 * 4. 既存の sourceTransactionId と突合して重複スキップ
 * 5. 新規取引を一括登録
 * 6. AccountingImportBatch を作成
 * 7. lastSyncedAt を更新
 */
export async function syncMoneyForwardTransactions(
  connectionId: number
): Promise<SyncResult> {
  // 1. 接続情報を取得
  const connection = await prisma.moneyForwardConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) {
    throw new Error(
      `MoneyForwardConnection id=${connectionId} が見つかりません`
    );
  }
  if (!connection.isActive) {
    throw new Error(
      `MoneyForwardConnection id=${connectionId} は無効です`
    );
  }

  // 2. 日付範囲を決定
  const toDate = formatDate(new Date());
  let fromDate: string;

  if (connection.lastSyncedAt) {
    // 前回同期日の1日前から取得（境界の取りこぼし防止）
    const from = new Date(connection.lastSyncedAt);
    from.setDate(from.getDate() - 1);
    fromDate = formatDate(from);
  } else if (connection.syncFromDate) {
    fromDate = formatDate(connection.syncFromDate);
  } else {
    // デフォルト: 3ヶ月前から
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    fromDate = formatDate(threeMonthsAgo);
  }

  // 3. MF API から取引を全件取得
  const client = new MoneyForwardClient(connectionId);
  const mfTransactions = await fetchAllTransactions(client, fromDate, toDate);
  const totalCount = mfTransactions.length;

  if (totalCount === 0) {
    // 取引がなくてもバッチ記録は作成する
    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.accountingImportBatch.create({
        data: {
          source: "moneyforward",
          sourceService: "moneyforward",
          periodFrom: new Date(fromDate),
          periodTo: new Date(toDate),
          totalCount: 0,
          newCount: 0,
          duplicateCount: 0,
          status: "completed",
          importedBy: connection.createdBy,
        },
      });

      await tx.moneyForwardConnection.update({
        where: { id: connectionId },
        data: { lastSyncedAt: new Date() },
      });

      return b;
    });

    return { newCount: 0, duplicateCount: 0, totalCount: 0, batchId: batch.id };
  }

  // 4. 既存の sourceTransactionId を取得して重複判定
  const mfSourceIds = mfTransactions.map((tx) => String(tx.id));
  const existingRecords = await prisma.accountingTransaction.findMany({
    where: {
      source: "moneyforward",
      sourceTransactionId: { in: mfSourceIds },
    },
    select: { sourceTransactionId: true },
  });
  const existingIdSet = new Set(
    existingRecords.map((r) => r.sourceTransactionId)
  );

  // 新規のみ抽出
  const newTransactions = mfTransactions.filter(
    (tx) => !existingIdSet.has(String(tx.id))
  );
  const duplicateCount = totalCount - newTransactions.length;

  // 5-7. トランザクション内で一括登録 + バッチ作成 + lastSyncedAt更新
  const result = await prisma.$transaction(async (tx) => {
    // バッチを作成
    const batch = await tx.accountingImportBatch.create({
      data: {
        source: "moneyforward",
        sourceService: "moneyforward",
        periodFrom: new Date(fromDate),
        periodTo: new Date(toDate),
        totalCount,
        newCount: newTransactions.length,
        duplicateCount,
        status: "completed",
        importedBy: connection.createdBy,
      },
    });

    // 新規取引を一括登録
    if (newTransactions.length > 0) {
      const createData = newTransactions.map((mfTx) => ({
        ...transformMFTransaction(mfTx, connection.operatingCompanyId),
        importBatchId: batch.id,
      }));

      await tx.accountingTransaction.createMany({
        data: createData,
      });
    }

    // lastSyncedAt を更新
    await tx.moneyForwardConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });

    return { batchId: batch.id };
  });

  return {
    newCount: newTransactions.length,
    duplicateCount,
    totalCount,
    batchId: result.batchId,
  };
}
