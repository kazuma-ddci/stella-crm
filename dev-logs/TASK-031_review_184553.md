すべての情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果: TASK-031 取引先重複チェック・統合機能（attempt 1）

### コミット概要
- `actions.ts`: 3つのServer Action追加（`detectDuplicates`, `getCounterpartyMergeImpact`, `mergeCounterparties`）
- `duplicates/page.tsx`: 重複チェック画面（サーバーコンポーネント）
- `duplicates/duplicates-check.tsx`: 重複候補一覧＋統合フローUI（クライアントコンポーネント）

---

### 1. テーブル定義: Prismaスキーマ vs 設計書

Prismaスキーマの `Counterparty` モデルに `mergedIntoId Int?`, `mergedAt DateTime?`, `deletedAt DateTime?` が存在し、設計書5.7の統合フィールドと**完全一致**。リレーション（6テーブル: Transaction, RecurringTransaction, BankTransaction, AutoJournalRule, InvoiceGroup, PaymentGroup）も全て定義済み。

### 2. 要望書2.8.2のフロー

| 要望書の要件 | 実装 | 結果 |
|---|---|---|
| 類似名称チェック（新規追加時） | `checkSimilarCounterparties`（既存） | ✅ |
| 定期的な重複チェック画面 | `/accounting/masters/counterparties/duplicates` | ✅ |
| 統合機能（FK付替え + 論理削除 + 変更履歴） | `mergeCounterparties` | ✅ |
| 統合前に影響範囲確認画面 | `getCounterpartyMergeImpact` + Dialog | ✅ |

### 3. 設計書5.7との対応

| 設計書5.7の要件 | 実装 | 結果 |
|---|---|---|
| 正規化比較（全角/半角、カタカナ/ひらがな統一） | `normalizeCounterpartyName`（既存関数を利用） | ✅ |
| 重複候補ペア一覧 | `detectDuplicates` → 完全一致 + 部分包含の2段階 | ✅ |
| アクション: 統合する / 別物として扱う | ボタン2つ実装 | ✅ |
| 影響範囲件数表示 | Transaction, RecurringTransaction, BankTransaction, AutoJournalRule + InvoiceGroup, PaymentGroup（設計書より包括的） | ✅ |
| 重複ルール警告 | `duplicateRuleWarning`（両方にAutoJournalRuleがある場合） | ✅ |
| DBトランザクション内FK付替え | `prisma.$transaction` + `Promise.all` | ✅ |
| 統合元に mergedIntoId, mergedAt, deletedAt 設定 | ✅ | ✅ |
| ChangeLog記録 | `recordChangeLog` にtx渡しで記録（詳細なoldData/newData含む） | ✅ |

### 4. 設計書6.7 ポリモーフィック参照の排他制約

Counterpartyの統合はcounterpartyIdの単一FK付替えであり、6.7の排他制約対象テーブル（Attachment, InvoiceMail, TransactionComment等）には直接関係しない。**該当なし、問題なし。**

### 5. TypeScript型安全性・エラーハンドリング

- `mergeCounterparties`: セッション取得 → 同一ID検証 → 存在/削除/統合済みチェック → トランザクション実行 → revalidatePath ✅
- `getCounterpartyMergeImpact`: 存在チェック → Promise.all並列カウント → 重複ルール警告 ✅
- `detectDuplicates`: `take: 5000` の上限あり（大規模データ対策） ✅
- `DuplicatePair` / `MergeImpact` 型エクスポート ✅
- クライアント側: `useTransition` でリフレッシュ、`isMerging` state でダブルクリック防止 ✅
- エラーハンドリング: try/catch + `toast.error` ✅

### 6. 既存コードパターンの整合性

- Server Action パターン（`"use server"` ファイル内）: 既存と一致 ✅
- 読み取り専用アクションでのセッションスキップ: `checkSimilarCounterparties` 等と一致 ✅
- Dialog + 確認フロー: 既存モーダルパターンに準拠 ✅
- `recordChangeLog` の呼び出し: 他のアクションと同一パターン ✅
- `revalidatePath`: 関連パス2つを更新 ✅

---

### 検出された問題

**1. 影響範囲プレビューと実際の更新件数の不一致**

`getCounterpartyMergeImpact`（`actions.ts:384`付近）は `deletedAt: null` フィルタ付きでカウントするが、`mergeCounterparties`（`actions.ts:453`付近）の `updateMany` はフィルタなしで全レコードを更新する。

結果として、影響範囲ダイアログで「5件」と表示された後、統合完了トーストで「8件のレコードを付替え」と表示される（論理削除済みの3件も更新されるため）可能性がある。

データ整合性の観点では全レコード更新が正しい（un-delete時に正しいFKを保持するため）が、UIの表示数値に齟齬が出る。

**2. 重複チェック画面への導線がない**

`/accounting/masters/counterparties/duplicates` ページは作成されているが、取引先一覧ページからの遷移リンク/ボタンが追加されていない。ユーザーがURLを直接入力しない限りアクセスできない。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/actions.ts",
      "description": "getCounterpartyMergeImpact は deletedAt: null フィルタ付きでカウントするが、mergeCounterparties の updateMany はフィルタなしで全レコードを更新する。影響範囲ダイアログの件数と統合完了トーストの件数が一致しない可能性がある。",
      "suggestion": "mergeCounterparties の totalUpdated 計算時に deletedAt: null の件数のみ使用するか、影響範囲ダイアログで「※論理削除済みレコードも含めて付替えられます」の注記を追加する。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/duplicates/page.tsx",
      "description": "重複チェック画面への導線（ナビゲーションリンク）が取引先一覧ページに追加されていない。ユーザーがURLを直接入力しないとアクセスできない。",
      "suggestion": "取引先一覧ページ（counterparties/page.tsx）のヘッダーエリアに「重複チェック」ボタン/リンクを追加する。"
    }
  ],
  "summary": "設計書5.7・要望書2.8.2の全要件を忠実に実装。重複検出（正規化名の完全一致+部分包含）、影響範囲確認ダイアログ、統合実行（$transaction内でFK付替え6テーブル + 論理削除 + ChangeLog記録）、統合方向切替、別物除外の各機能が揃っている。型安全性・エラーハンドリング・既存パターンとの整合性も良好。検出された2件はいずれもminorレベルのUX改善点であり、機能的な正確性に問題はない。"
}
```
