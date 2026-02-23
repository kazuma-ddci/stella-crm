全ファイルと仕様書の確認が完了しました。レビュー結果をまとめます。

---

## TASK-017 仕訳処理画面 レビュー

### チェック結果

#### 1. テーブル定義 (Prismaスキーマ vs 設計書)
**JournalEntry (⑪)** / **JournalEntryLine (⑫)** ともに、Prismaスキーマ (`schema.prisma:2566-2622`) と設計書のカラム定義が完全に一致しています。ステータス値 (`draft` / `confirmed`)、FK構成、`approvedBy`/`approvedAt` 等すべて正しい。

#### 2. ステータス遷移 (要望書 3.2)
- `draft` → `confirmed` フローが `confirmJournalEntry` で正しく実装 ✓
- 確定時に `approvedBy`/`approvedAt` をセット ✓
- 紐づいた取引の `awaiting_accounting` → `journalized` ステータス更新あり ✓
- 確定済み仕訳の編集・削除をブロック ✓

#### 3. バリデーション (設計書 6.2)
- `debit合計 = credit合計` のチェック: `validateJournalEntryData` (actions.ts:97-108) で実装 ✓
- 確定時にも再検証 (actions.ts:370-382) ✓
- 合計0円チェック ✓
- 明細最低2行チェック ✓

#### 4. ポリモーフィック参照の排他制約 (設計書 6.7)
- `invoiceGroupId` / `paymentGroupId` / `transactionId` が「いずれか1つのみ、全てnullも可」の排他制約: `validateJournalEntryData` (actions.ts:50-68) で正しく実装 ✓

#### 5. 型安全性・エラーハンドリング
- `getSession()` によるスタッフID取得 ✓
- FK参照先の存在チェック（`createJournalEntry` 内） ✓
- `Prisma.$transaction` でアトミック操作 ✓
- クライアント側の `toast` によるエラー表示 ✓
- 勘定科目の存在チェック ✓

#### 6. 既存パターン準拠
- Server Component (page.tsx) + Client Table (journal-table.tsx) + Modal パターン ✓
- Card/CardHeader/CardContent レイアウト ✓
- AlertDialog による確定・削除確認 ✓
- StatusBadge コンポーネント分離 ✓

---

### 発見した問題点

**1. `updateJournalEntry` でFK存在チェックが欠落** (actions.ts:281-347)
`createJournalEntry` には `invoiceGroupId`/`paymentGroupId`/`transactionId` の存在チェック (actions.ts:202-228) があるが、`updateJournalEntry` にはない。DBのFK制約でcatchされるものの、Prismaの生エラーが返りユーザーフレンドリーではない。

**2. InvoiceGroup/PaymentGroupの `deletedAt` チェック漏れ** (actions.ts:203-218)
`transaction` は `findFirst` + `deletedAt: null` で正しくチェックしているが、`invoiceGroup` と `paymentGroup` は `findUnique` で `deletedAt` を考慮していない。論理削除済みのグループが参照可能になる。

**3. 未使用import** (journal-entry-modal.tsx:7)
`Textarea` がインポートされているが使用されていない。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/journal/actions.ts",
      "description": "updateJournalEntry (L281-347) に invoiceGroupId / paymentGroupId / transactionId のFK存在チェックがない。createJournalEntry (L202-228) には存在するため不整合。DBのFK制約でcatchされるが、エラーメッセージがユーザーフレンドリーでなくなる",
      "suggestion": "createJournalEntry と同様の存在チェックロジックを updateJournalEntry にも追加する。共通ヘルパー関数に切り出すとDRYになる"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/journal/actions.ts",
      "description": "createJournalEntry (L203-218) で invoiceGroup/paymentGroup の存在チェックに findUnique を使用しているが、deletedAt: null を条件に含めていない。transaction (L221) は findFirst + deletedAt: null で正しくチェックしている。論理削除済みグループが参照可能",
      "suggestion": "invoiceGroup/paymentGroup のチェックも findFirst + where: { id, deletedAt: null } に統一する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/journal/journal-entry-modal.tsx",
      "description": "Textarea (L7) がインポートされているが未使用",
      "suggestion": "import文から Textarea を削除する"
    }
  ],
  "summary": "TASK-017の仕訳処理画面は、設計書 ⑪ JournalEntry + ⑫ JournalEntryLine のテーブル定義、要望書 3.2 の仕訳管理フロー、設計書 6.2 の借方/貸方合計一致バリデーション、6.7 のポリモーフィック排他制約のすべてを正しく実装している。CRUD操作（作成・取得・更新・確定・論理削除）、確定時の取引ステータス連動更新、勘定科目マスタのカテゴリ別グループ表示など、仕訳処理に必要な機能が網羅されている。指摘はいずれもminorレベルの整合性・コード品質の問題のみ"
}
```
