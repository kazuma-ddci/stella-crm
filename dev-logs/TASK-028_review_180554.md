全ての変更内容と仕様書の確認が完了しました。

---

## レビュー結果

### コンテキスト
このコミット（attempt 2）は、前回レビュー（attempt 1）で指摘された6件の問題を修正するものです。

---

### 前回指摘の修正確認

#### Major 3件 — 更新操作で新日付のクローズチェック漏れ

| ファイル | 修正内容 | 判定 |
|---|---|---|
| `bank-transactions/actions.ts:409` | `ensureMonthNotClosed(validated.transactionDate)` 追加 | OK |
| `journal/actions.ts:324` | `ensureMonthNotClosed(validated.journalDate)` 追加 | OK |
| `transactions/actions.ts:341` | `checkMonthlyClose(validated.periodFrom, validated.periodTo)` 追加 | OK |

3ファイルとも、バリデーション後・DB更新前の正しい位置に配置されています。これにより「オープン月のレコードの日付をクローズ済み月に変更」する穴が塞がれました。

#### Minor 3件

| 指摘 | 修正 | 判定 |
|---|---|---|
| 仕様3.9.4: スナップショット未使用 | `snapshotMap` を構築し、クローズ済み月は `snapshot.totalRevenue/totalExpense/grossProfit` を使用。未クローズ月はライブ計算にフォールバック | OK |
| 権限チェックTODO未記載 | `closeMonthAction` / `reopenMonthAction` 両方に `// TODO: 経理管理者権限チェック（仕様3.9.1 / Section 10で後日実装）` 追加 | OK |
| STP側PL集計の差異 | `// NOTE: 経理側はJournalEntry（確定済み仕訳）ベース。移行完了後に統一予定` コメント追加 | OK |

---

### 新規チェック

#### 1. スナップショット読み取りロジックの整合性
- `generatePLSnapshot` の出力構造: `{ summary: { totalRevenue, totalExpense, grossProfit }, accounts, ... }`
- 読み取り側: `(log.snapshotData as { summary?: { totalRevenue, totalExpense, grossProfit } })` — `summary?` で旧データ（スナップショットなし）にも安全にフォールバック
- **問題なし**

#### 2. 再オープン後の挙動
- `logs` は `performedAt: "desc"` でソート、`statusMap` は最初に見つかった（＝最新の）アクションのみ記録
- 再オープン済み月: 最新 action が `"reopen"` → `isClosed = false` → スナップショットは使われず、ライブ計算に戻る
- **正しい動作**

#### 3. 設計書㉓ MonthlyCloseLog テーブル定義との一致
- `projectId`, `targetMonth`, `action`, `reason`, `snapshotData`, `performedBy`, `performedAt` — 全カラム使用済み
- **完全一致**

#### 4. 設計書6.6 月次クローズのバリデーションルール
- クローズ済み月の取引編集不可: `transactions`, `bank-transactions`, `journal` 全てに新旧両日付ガード追加 → **準拠**
- 消込変更不可: `reconciliation/actions.ts` は今回の変更範囲外だが既存実装で `checkMonthlyCloseForReconciliation` が仕訳日・入出金日の両方をチェック済み → **準拠**
- 再オープン理由必須: `monthly-close.ts:80` で `!reason.trim()` チェック → **準拠**

#### 5. TypeScript型安全性
- `snapshotData` の型キャスト（`as { summary?: ... }`）は `Json?` に対する合理的な narrowing
- 各 `ensureMonthNotClosed` / `checkMonthlyClose` 呼び出しの引数型は `Date` で一致
- **問題なし**

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "前回レビュー（attempt 1）で指摘されたMajor 3件（更新操作での新日付クローズチェック漏れ）、Minor 3件（スナップショット未使用、権限TODO未記載、STP側PL差異コメント）の全てが正しく修正されている。新旧両日付のクローズチェックにより、クローズ済み月へのデータ流入を防ぐガードが3ファイル全てに追加された。スナップショット活用ロジックも仕様3.9.4に準拠し、再オープン時のフォールバック動作も正しい。新たな問題は検出されず、設計書・要望書との整合性も確認完了。"
}
```
