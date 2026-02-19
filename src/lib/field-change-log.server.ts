/**
 * フィールド変更履歴 - サーバー専用関数（Prisma依存）
 * createFieldChangeLogEntries: actions.ts の $transaction 内で使う内部関数
 *
 * クライアントコンポーネントからはこのファイルをimportしないこと
 * → クライアント向けserver actionは field-change-log.actions.ts を使う
 */

import "server-only";
import type { Prisma } from "@prisma/client";
import type { FieldChange } from "./field-change-log.shared";

// 型を再エクスポート（server側で使う場合の利便性）
export type { FieldChange } from "./field-change-log.shared";

/**
 * トランザクション内でフィールド変更履歴を一括作成
 * actions.ts の prisma.$transaction 内で使用する
 */
export function createFieldChangeLogEntries(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: number,
  changes: FieldChange[],
) {
  if (changes.length === 0) return Promise.resolve([]);
  return Promise.all(
    changes.map((change) =>
      tx.fieldChangeLog.create({
        data: {
          entityType,
          entityId,
          fieldName: change.fieldName,
          displayName: change.displayName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          note: change.note,
        },
      }),
    ),
  );
}
