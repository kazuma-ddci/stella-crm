全ての関連ファイルの確認が完了しました。レビュー結果をまとめます。

---

## レビュー結果: TASK-022 按分確定フロー

### 概要

変更ファイル4つ（ソースコード）:
- `actions.ts`: createTransaction/confirmTransactionへの按分連携追加、getTransactionsの拡張
- `allocation-actions.ts` (新規): 按分計算、確定状況取得、確定アクション、自動確定
- `allocation-confirmation-panel.tsx` (新規): 按分確定UI（ダイアログ + 操作ボタン）
- `transactions-table.tsx`: 取引テーブルに按分ボタン追加

### 設計書との整合性チェック

| 仕様項目 | 状態 | 詳細 |
|---|---|---|
| 自動確定（作成者プロジェクト） | OK | `autoConfirmCreatorAllocations` でCostCenter.projectIdとcreator's projectIdを比較して自動確定 |
| 他プロジェクトへの通知 | **未実装** | タスク定義に含まれるが、通知基盤自体が未作成。コード上にTODOもなし |
| 確認・確定画面 | OK | `AllocationConfirmationPanel` ダイアログ + `AlertDialog` で確認後に確定 |
| 全プロジェクト確定→経理引き渡し | OK | `checkAndTransitionToAwaitingAccounting` で全確定チェック→`awaiting_accounting`遷移 |
| PL計算での按分金額の動的計算 | OK | `calculateAllocatedAmounts` で税込金額×按分率を動的計算 |
| 端数処理（1円未満切り捨て、最後に寄せ） | OK | `Math.floor` + `remainder`を最後の要素に加算 |
| AllocationTemplateOverride考慮 | OK | `getAllocationStatus` でoverride存在時にsnapshotRatesを使用 |
| DB一意制約（設計書6.3） | OK | P2002エラーハンドリングで重複確定を防止 |
| Server Actions定義 | OK | `confirmAllocation`, `getAllocationStatus` の2つを実装 |

### 問題点

**1. [Major] 他プロジェクトへの通知が未実装**

設計書5.4:「他プロジェクト → 通知 → 確認・確定」、タスク定義にも「他プロジェクトへの通知」が含まれるが、コード上に通知処理もTODOコメントもない。通知基盤（`src/lib/notifications/create-notification.ts` - 設計書8.5）が未作成のため実装不可能な状況だが、少なくともTODOコメントで意図を明示すべき。

**2. [Major] 全確定チェックロジックの重複**

`confirmTransaction`（`actions.ts:550-577`）と `checkAndTransitionToAwaitingAccounting`（`allocation-actions.ts:246-284`）で同一の「全コストセンター確定済みチェック→`awaiting_accounting`遷移」ロジックが重複している。`confirmTransaction`側は`checkAndTransitionToAwaitingAccounting`を呼ぶべき。現状では片方だけ修正されてもう片方が放置されるリスクがある。

```typescript
// actions.ts:550-577 は以下で置き換え可能:
import { checkAndTransitionToAwaitingAccounting } from "./allocation-actions";
// ...
if (updatedTx?.allocationTemplateId) {
  await checkAndTransitionToAwaitingAccounting(id);
}
```

ただし `checkAndTransitionToAwaitingAccounting` は現在 private（export されていない）ため、export化が必要。

**3. [Minor] confirmAllocationでのステータス事前チェック不足**

`confirmAllocation` は取引の`deletedAt: null`は確認しているが、ステータスチェックがない。例えば `status === "journalized"` や `status === "paid"` の取引に対しても按分確定が可能になっている。`checkAndTransitionToAwaitingAccounting`側で `status === "confirmed"` のみ遷移するため実害は小さいが、不要な AllocationConfirmation レコード作成を防ぐべき。

**4. [Minor] UI: 経理処理待ち状態のフィードバック不足**

`allocation-confirmation-panel.tsx:197-203` で全確定メッセージが `transactionStatus === "confirmed"` の場合しか自動遷移メッセージを表示しない。すでに `awaiting_accounting` に遷移済みの場合に「経理処理待ち状態です」等のメッセージがないため、ユーザーが状態を把握しにくい。

### 良い点

- **端数処理の実装が正確**: `Math.floor` で1円未満切り捨て → 差額を最後の按分先に寄せる、という設計書6.3の仕様に忠実
- **AllocationTemplateOverride の考慮**: `getAllocationStatus` でoverride有無を確認し、snapshotRatesを使い分けている（設計書の計算ルール通り）
- **P2002エラーのハンドリング**: 一意制約違反を適切にキャッチしてユーザー向けメッセージに変換
- **Prismaトランザクション内での自動確定**: `autoConfirmCreatorAllocations` がcreateTransactionのトランザクション内で実行される
- **UIのUX**: AlertDialogで確認ステップを設けており、誤操作防止

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/transactions/allocation-actions.ts",
      "description": "他プロジェクトへの通知が未実装。設計書5.4「他プロジェクト → 通知 → 確認・確定」およびタスク定義に含まれるが、コード上に通知処理もTODOコメントもない",
      "suggestion": "autoConfirmCreatorAllocations内で、自動確定されなかったコストセンター（他プロジェクト）に対してTODOコメントを追加: // TODO: 通知基盤(create-notification.ts)作成後に按分確定依頼の通知を送信"
    },
    {
      "severity": "major",
      "file": "src/app/accounting/transactions/actions.ts",
      "description": "confirmTransaction内(550-577行目)の全確定チェックロジックが、allocation-actions.tsのcheckAndTransitionToAwaitingAccounting(246-284行目)と完全に重複。保守性リスク",
      "suggestion": "checkAndTransitionToAwaitingAccountingをexportし、confirmTransaction内の重複コード(550-577行目)をcheckAndTransitionToAwaitingAccounting(id)の呼び出しに置き換える"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/transactions/allocation-actions.ts",
      "description": "confirmAllocationで取引ステータスの事前チェックがない。journalized/paid等の完了済み取引にも按分確定レコードが作成可能",
      "suggestion": "confirmAllocation冒頭で、transaction.statusが按分確定可能なステータス（unconfirmed/confirmed）であることをチェックし、そうでなければエラーを投げる"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/transactions/allocation-confirmation-panel.tsx",
      "description": "全確定後かつtransactionStatusがawaiting_accounting/journalized等の場合にステータス表示がない。ユーザーが現在の遷移状態を把握できない",
      "suggestion": "status.transactionStatus === 'awaiting_accounting'の場合「経理処理待ちに移行済みです」のメッセージを追加表示"
    }
  ],
  "summary": "按分計算・端数処理・確定フロー・UI は設計書に忠実に実装されている。AllocationTemplateOverrideの考慮もあり計算ロジックは堅実。ただし、タスク定義に含まれる「他プロジェクトへの通知」が未実装（通知基盤未作成のため）、confirmTransactionとcheckAndTransitionToAwaitingAccountingの全確定チェックロジック重複が保守性リスク。この2点のmajor issueの修正が必要。"
}
```
