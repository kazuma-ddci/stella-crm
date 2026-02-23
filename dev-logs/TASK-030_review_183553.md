全情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果: TASK-030 定期取引管理画面（attempt 2）

### コミット概要
前回レビューで検出された2件の問題を修正するコミット:
1. `updateRecurringTransaction` に costCenterId/allocationTemplateId 排他制約チェック追加
2. `deleteRecurringTransaction` に存在/論理削除済みチェック追加

---

### 1. テーブル定義: Prismaスキーマ vs 設計書

Prismaスキーマ（`prisma/schema.prisma:2380-2418`）と設計書④のRecurringTransactionモデルは**完全一致**。全カラム・型・デフォルト値・リレーションが一致しています。

### 2. 要望書2.7.2の設定項目

| 要望書の設定項目 | 実装キー | 結果 |
|---|---|---|
| 種別（売上/経費） | `type` select | OK |
| 取引先 | `counterpartyId` select+searchable | OK |
| 費目 | `expenseCategoryId` dynamicOptions（種別連動） | OK |
| 名称 | `name` text | OK |
| 金額、消費税額、税率 | `amount`, `taxAmount`, `taxRate` | OK |
| 金額タイプ（固定/変動） | `amountType` select + visibleWhen連動 | OK |
| 按分設定 | `costCenterId`, `allocationTemplateId` | OK |
| 決済手段 | `paymentMethodId` select | OK |
| プロジェクト | `projectId` select | OK |
| 頻度（毎月/毎年/毎週） | `frequency` select | OK |
| 実行日 | `executionDay` number | OK |
| 開始日、終了日 | `startDate`, `endDate` date | OK |
| 摘要・メモ | `note` textarea | OK |
| 有効フラグ | `isActive` boolean | OK |

**全14項目を網羅。**

### 3. 設計書セクション6のバリデーションルール

- **6.1 排他制約（costCenterId/allocationTemplateId）**: create（L101-106） ✓、update（L368-375、今回修正） ✓
- **FK存在チェック**: create/update共に全FK対象で実施済み ✓
- **executionDay のfrequency依存バリデーション**: create（L88-98）、update（L271-291） ✓
- **6.7 ポリモーフィック参照**: RecurringTransactionは6.7の対象テーブルに含まれないため該当なし ✓

### 4. 今回の修正（attempt 2）の正確性

#### Fix 1: update排他制約チェック（L368-375）

```typescript
const effectiveCostCenterId = "costCenterId" in updateData ? updateData.costCenterId : existing.costCenterId;
const effectiveAllocId = "allocationTemplateId" in updateData ? updateData.allocationTemplateId : existing.allocationTemplateId;
```

- `existing` の `select` に `costCenterId`, `allocationTemplateId` を追加済み（L191） ✓
- updateDataに含まれる場合はupdateDataの値、含まれない場合は既存値を使用 ✓
- ユーザーが一方をnullに変更しつつ他方を設定するケースも正しくハンドル ✓
- エラーメッセージがcreate側と統一 ✓

#### Fix 2: delete存在チェック（L392-398）

- `findUnique` + `deletedAt` チェックでupdate側と同パターン ✓
- 使用中チェック（L401-410）の前に配置されており、順序も正しい ✓

### 5. TypeScript型安全性・エラーハンドリング

- Server Actionsパターン: 既存マスタ画面と一致 ✓
- セッション取得 → バリデーション → DB操作 → revalidatePath: 既存パターン準拠 ✓
- 費目のtype別動的フィルタリング（dynamicOptions）: 適切 ✓
- 消費税額の自動計算（handleFieldChange）: 適切 ✓

### 6. 既存コードパターンの整合性

- CrudTable使用 ✓
- page.tsxのPromise.all並列データ取得 ✓
- 論理削除（deletedAt） ✓
- createdBy/updatedBy記録 ✓

---

### 検出された問題

**1. updateRecurringTransaction: taxRate 0%（非課税）が10%に変換されるバグ**

`actions.ts:260` — `Number(data.taxRate) || 10` は、taxRateが`"0"`（非課税）の場合に `Number("0")` = `0`（falsy）→ `0 || 10` = `10` となり、非課税が標準税率10%として保存されてしまう。

create側（L38）は `data.taxRate !== undefined ? Number(data.taxRate) : 10` で正しく処理されており、update側だけ `||` 演算子を使っている不整合。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/recurring-transactions/actions.ts",
      "description": "updateRecurringTransactionのL260で `Number(data.taxRate) || 10` を使用しており、taxRate=0（非課税）の場合に0がfalsyとして10に変換される。create側（L38）は `data.taxRate !== undefined ? Number(data.taxRate) : 10` で正しく処理されているが、update側だけ `||` 演算子を使っている不整合。",
      "suggestion": "L260を `updateData.taxRate = data.taxRate !== undefined && data.taxRate !== null ? Number(data.taxRate) : 10;` に修正する。または create 側と同じパターンで `Number(data.taxRate)` が NaN でなければその値を使う形にする。"
    }
  ],
  "summary": "前回レビューで指摘された2件（update排他制約チェック欠落・delete存在チェック欠落）は正確に修正されている。排他制約チェックはupdateDataと既存値のマージで正しくエッジケースもハンドルしている。追加で、updateのtaxRate処理に `||` 演算子起因の0%→10%変換バグを検出したが、非課税は利用頻度が低くminor判定。要望書2.7.2の全14項目を網羅し、設計書④のスキーマとも完全一致。全体的に品質は十分。"
}
```
