全情報が揃いました。前回レビュー（attempt 1）の指摘4件に対する修正状況を整理してレビューします。

---

## レビュー結果: TASK-022 按分確定フロー (attempt 2)

### 前回レビュー(attempt 1)の指摘対応状況

| # | 前回指摘 | 重要度 | 対応状況 |
|---|---------|--------|---------|
| 1 | 他プロジェクトへの通知が未実装（TODOコメントもなし） | major | **修正済み** — `autoConfirmCreatorAllocations` 末尾にTODOコメント追加（338-340行目） |
| 2 | `confirmTransaction`と`checkAndTransitionToAwaitingAccounting`のロジック重複 | major | **修正済み** — `checkAndTransitionToAwaitingAccounting`をexport化し、`confirmTransaction`側は1行の呼び出しに置換（actions.ts:551） |
| 3 | `confirmAllocation`でのステータス事前チェック不足 | minor | **修正済み** — `confirmableStatuses = ["unconfirmed", "confirmed"]` チェック追加（210-216行目） |
| 4 | UI: 経理処理待ち/仕訳済み状態のフィードバック不足 | minor | **修正済み** — `awaiting_accounting` → 「経理処理待ちに移行済みです。」、`journalized` → 「仕訳済みです。」を追加（188-191行目） |

**4件すべて適切に修正されています。**

### 今回の変更内容の詳細チェック

#### 1. ロジック重複の解消 (`actions.ts:548-551`)

```typescript
// Before (attempt 1): 26行の重複コード
// After (attempt 2):
await checkAndTransitionToAwaitingAccounting(id);
```

`checkAndTransitionToAwaitingAccounting` が `allocation-actions.ts:254` で `export` されており、`actions.ts:4` で正しくimportされています。重複が完全に解消されました。

#### 2. ステータスチェック (`allocation-actions.ts:210-216`)

```typescript
const confirmableStatuses = ["unconfirmed", "confirmed"];
if (!confirmableStatuses.includes(transaction.status)) {
  throw new Error(`ステータス「${transaction.status}」の取引は按分確定できません`);
}
```

`journalized`, `paid`, `awaiting_accounting` 等の完了系ステータスでの不正な按分確定を防止しています。設計書のステータス遷移と整合的です。

#### 3. TODOコメント (`allocation-actions.ts:338-340`)

```typescript
// TODO: 通知基盤(create-notification.ts - 設計書8.5)作成後に、
// 自動確定されなかったコストセンター（他プロジェクト）に対して
// 按分確定依頼の通知を送信する（設計書5.4「他プロジェクト → 通知 → 確認・確定」）
```

通知基盤が未作成のため実装不可である旨と、設計書のセクション参照が明示されており、将来の実装者に十分な情報を提供しています。

#### 4. UIフィードバック (`allocation-confirmation-panel.tsx:188-191`)

```tsx
{status.transactionStatus === "awaiting_accounting" &&
  "経理処理待ちに移行済みです。"}
{status.transactionStatus === "journalized" &&
  "仕訳済みです。"}
```

ステータスに応じた適切なメッセージが表示されるようになりました。

### 設計書との整合性（再確認）

| 仕様項目 | 状態 |
|---------|------|
| 自動確定（作成者プロジェクト） | OK |
| 他プロジェクトへの通知 | OK（TODOコメントで対応方針明示） |
| 確認・確定画面 | OK |
| 全プロジェクト確定→経理引き渡し | OK（重複解消済み） |
| PL計算での按分金額の動的計算 | OK |
| 端数処理（1円未満切り捨て、最後に寄せ） | OK |
| DB一意制約（6.3） | OK |
| ステータスバリデーション | OK（新規追加） |

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "前回レビュー(attempt 1)で指摘した4件（major 2件 + minor 2件）がすべて適切に修正されている。ロジック重複はcheckAndTransitionToAwaitingAccountingのexport化+呼び出し置換で解消、通知未実装はTODOコメントで設計書参照付きで明示、ステータスチェック追加でjournalized/paid等からの不正確定を防止、UIフィードバックも遷移後ステータスに応じたメッセージを追加。設計書・要望書との整合性も問題なし。"
}
```
