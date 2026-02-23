全ファイルと仕様書を確認しました。以下がレビュー結果です。

---

## レビュー結果

### コミット: `f325a51 feat(TASK-009): 実装 (attempt 1)`

---

### チェック観点別レビュー

**1. テーブル定義がPrismaスキーマと設計書で完全一致か**

- Transaction.status の値 (`unconfirmed` | `confirmed` | `awaiting_accounting` | `returned` | `resubmitted` | `journalized` | `partially_paid` | `paid` | `hidden`) がPrismaスキーマ・設計書と完全一致 ✅
- TransactionComment の `commentType`（`normal` | `return` | `approval` | `question`）と `returnReasonType`（`question` | `correction_request` | `approval_check` | `other`）がPrismaスキーマ・設計書と一致 ✅
- AccountingMonthlyClose の `status` フィルタ (`project_closed` | `accounting_closed`) がPrismaスキーマと一致 ✅

**2. 要望書のフロー・ステータス遷移が正しいか**

要望書 2.1.3 のフロー:
```
未確認 → 確認済み → 経理処理待ち → 差し戻し → 再提出 → 経理処理待ち → 仕訳済み → 入金完了/支払完了 → 非表示
```

実装の `VALID_STATUS_TRANSITIONS` との照合:
| 遷移 | 要望書 | 実装 | 状態 |
|---|---|---|---|
| unconfirmed → confirmed | ✅ | ✅ | 一致 |
| confirmed → awaiting_accounting | ✅ | ✅ | 一致 |
| confirmed → returned | 明示なし | ✅ | 追加（合理的） |
| awaiting_accounting → returned | ✅ | ✅ | 一致 |
| awaiting_accounting → journalized | ✅ | ✅ | 一致 |
| returned → resubmitted | ✅ | ✅ | 一致 |
| resubmitted → awaiting_accounting | ✅ | ✅ | 一致 |
| journalized → partially_paid, paid | ✅ | ✅ | 一致 |
| partially_paid → paid | ✅ | ✅ | 一致 |
| paid → hidden | ✅ | ✅ | 一致 |

`confirmed → returned` は要望書フローに明示されていないが、確認済み段階で問題発見時に差し戻す合理的なショートカットであり、設計上問題なし。

**3. 設計書セクション6のバリデーションルール**

- 設計書 6.6 月次クローズ: 「クローズ済みの月の取引は編集不可」 → `checkMonthlyClose` で confirmTransaction, returnTransaction, resubmitTransaction, hideTransaction, updateTransaction 全てに適用 ✅
- 設計書 5.8 差し戻しフロー: `commentType=return`, `returnReasonType` 必須 → `returnTransaction` で実装 ✅
- updateTransaction の編集可能ステータス制限（`unconfirmed`, `returned` のみ） ✅

**4. 設計書6.7のポリモーフィック参照の排他制約**

- TransactionComment 作成時: `transactionId` のみ設定、`invoiceGroupId` と `paymentGroupId` は null（デフォルト） ✅

**5. TypeScript型安全性、エラーハンドリング**

- 各 Server Action で getSession → findFirst → status check → checkMonthlyClose → update の安全なパターン ✅
- UIコンポーネントで `useTransition` + try/catch のエラーハンドリング ✅
- `TransactionRow` 型が `getTransactions` の返り値の部分型として正しい ✅
- ダイアログの disabled 制御 (`isPending` + 必須フィールド) ✅

**6. 既存コードパターンに従っているか**

- Server Action パターン（getSession → バリデーション → DB操作 → revalidatePath）踏襲 ✅
- prisma.$transaction でステータス更新+コメント作成をアトミックに実行 ✅
- AlertDialog / Dialog の使い分け（破壊的操作と入力付き操作）が適切 ✅
- `group/row` クラスの使用パターン踏襲 ✅

---

### 仕様との照合（要望書 2.1.3 + 設計書 6.6 + 設計書 5.8）

| 要件 | 実装状態 |
|---|---|
| 確認ボタン（unconfirmed → confirmed） | ✅ AlertDialog + confirmedBy/confirmedAt記録 |
| 差し戻し（confirmed/awaiting_accounting → returned） | ✅ Dialog + 理由種別 + コメント必須 |
| 再提出（returned → resubmitted） | ✅ Dialog + コメント任意 |
| 非表示（paid → hidden） | ✅ AlertDialog + deletedAt設定（論理削除） |
| 月次クローズチェック | ✅ 全ステータス変更アクションに適用 |
| 編集制限（unconfirmed/returnedのみ） | ✅ updateTransactionにガード追加 |
| 差し戻し時コメント記録 | ✅ TransactionComment に commentType=return + returnReasonType |
| ステータスバッジ（9種） | ✅ カラーコーディング付き |
| 一覧取得（hidden/deleted除外） | ✅ deletedAt: null + status: { not: "hidden" } |

---

### 指摘事項

**minor-1**: `actions.ts:473-474` — `checkMonthlyClose` は `projectId` が null の場合に早期リターンする。現行の `AccountingMonthlyClose` テーブルは `projectId` が NOT NULL なのでこの実装は正しいが、将来 `MonthlyCloseLog`（projectId nullable = 全社クローズ対応）に移行する際には、プロジェクト未指定の取引に対しても全社クローズをチェックするよう修正が必要。

**minor-2**: `actions.ts:703-718` — `getTransactions` の where 句で `status: { not: "hidden" }` が `filters?.status` 指定時にオーバーライドされる。`deletedAt: null` で hidden 取引は除外されるため実害はないが、意図が不明確。

**minor-3**: `transaction-status-badge.tsx:13` — ステータス `paid` のラベルが「完了」だが、要望書 2.1.3 では「入金完了/支払完了」。バッジの文字数制約から短縮は理解できるが、種別（売上/経費）に応じて「入金完了」/「支払完了」と表示する方が仕様に忠実。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/transactions/actions.ts",
      "description": "checkMonthlyClose は projectId が null の場合スキップするが、将来 MonthlyCloseLog（全社クローズ対応・projectId nullable）移行時に修正が必要",
      "suggestion": "現時点では対応不要。MonthlyCloseLog 移行タスク時に、projectId null の全社クローズチェックを追加する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/transactions/actions.ts",
      "description": "getTransactions の where.status が filters.status 指定時にオーバーライドされ、{ not: \"hidden\" } フィルタが消える。deletedAt: null で実害はないが意図が不明確",
      "suggestion": "filters.status 指定時は status を直接代入するのではなく、deletedAt: null に依存する旨をコメントで明記する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/transactions/transaction-status-badge.tsx",
      "description": "ステータス paid のラベルが「完了」だが、要望書 2.1.3 では「入金完了/支払完了」。種別に応じた表示の方が仕様に忠実",
      "suggestion": "TransactionStatusBadge に type prop を追加し、revenue なら「入金完了」、expense なら「支払完了」と表示する。現時点ではラベル変更のみでも可"
    }
  ],
  "summary": "TASK-009 の実装は仕様に忠実で、要望書 2.1.3 のステータス遷移フロー、設計書 6.6 の月次クローズチェック、設計書 5.8 の差し戻しフロー（commentType=return + returnReasonType必須）が全て正しく実装されている。Server Actions は全アクションで getSession → 存在チェック → ステータスチェック → 月次クローズチェック → DB操作の安全なパターンを踏襲しており、UIも確認ダイアログ・入力ダイアログの使い分けが適切。critical/major の問題はなく、minor 3件（将来の月次クローズ移行時の考慮点、フィルタ条件の明示性、ステータスラベルの精度）のみ。"
}
```
