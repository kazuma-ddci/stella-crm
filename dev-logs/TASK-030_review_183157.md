全ての情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果: TASK-030 定期取引管理画面

### 1. テーブル定義 vs Prismaスキーマ vs 設計書

Prismaスキーマ（`prisma/schema.prisma:2380-2418`）と設計書④のRecurringTransactionモデルは**完全に一致**しています。実装が参照しているカラムもすべてスキーマに存在します。

### 2. 要望書2.7.2の設定項目チェック

| 要望書の設定項目 | 実装 | 結果 |
|---|---|---|
| 種別（売上/経費） | `type` select | ✓ |
| 取引先 | `counterpartyId` select+searchable | ✓ |
| 費目 | `expenseCategoryId` dynamicOptions | ✓ |
| 名称 | `name` text | ✓ |
| 金額、消費税額、税率 | `amount`, `taxAmount`, `taxRate` | ✓ |
| 金額タイプ（固定/変動） | `amountType` select | ✓ |
| 按分設定 | `costCenterId`, `allocationTemplateId` | ✓ |
| 決済手段 | `paymentMethodId` select | ✓ |
| プロジェクト | `projectId` select | ✓ |
| 頻度（毎月/毎年/毎週） | `frequency` select | ✓ |
| 実行日 | `executionDay` number | ✓ |
| 開始日、終了日 | `startDate`, `endDate` date | ✓ |
| 摘要・メモ | `note` textarea | ✓ |
| 有効フラグ | `isActive` boolean | ✓ |

→ **全項目が網羅されています。**

### 3. 設計書セクション6のバリデーションルール

- 6.1の「按分テンプレートIDとコストセンターIDは排他的」: createでは実装済み、**updateでは未実装**（後述）
- FK存在チェック: create/update共に全FK対象で実施済み ✓
- executionDayのfrequency依存バリデーション: 実装済み ✓

### 4. 設計書6.7 ポリモーフィック参照の排他制約

RecurringTransactionは6.7の対象テーブルに含まれていないため該当なし。ただし、costCenterId/allocationTemplateIdの排他制約（6.1由来）は適用されるべきで、create側のみ実装されている点が問題。

### 5. TypeScript型安全性・エラーハンドリング

- Server Actionsパターン: 既存マスタ画面と一致 ✓
- `throw new Error()` による日本語エラーメッセージ: 既存パターン準拠 ✓
- セッション取得 → バリデーション → DB操作 → revalidatePath: 既存パターン準拠 ✓
- 費目のtype別動的フィルタリング: 適切な実装 ✓
- 消費税額の自動計算（handleFieldChange）: ✓

### 6. 既存コードパターンとの整合性

- CrudTable利用: 既存マスタと同じパターン ✓
- page.tsxのPromise.all並列データ取得: ✓
- 論理削除（deletedAt）: ✓
- createdBy/updatedBy記録: ✓
- サイドバー追加: 適切な位置とアイコン ✓

---

### 検出された問題

**1. updateRecurringTransactionにcostCenterId/allocationTemplateId排他制約がない (major)**

`actions.ts:127-147` — createには排他チェックがあるが（L93-97）、updateにはない。CrudTableは編集時に全フィールドを送信するため、ユーザーがcostCenterIdとallocationTemplateIdを両方セットした場合に保存が成功してしまい、データ不整合が発生する。

**2. deleteRecurringTransactionに既存レコードの存在/削除済みチェックがない (minor)**

`actions.ts:334-356` — updateRecurringTransactionは`existing.deletedAt`を確認しているが（L150-153）、deleteRecurringTransactionにはこのチェックがない。既に論理削除されたレコードに対してもdeletedAtが再更新される。Prismaが存在チェックはしてくれるが、削除済みレコードの再削除は防げない。

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/masters/recurring-transactions/actions.ts",
      "description": "updateRecurringTransactionにcostCenterId/allocationTemplateIdの排他制約チェックがない。createRecurringTransactionにはL93-97で実装されているが、update側にはない。CrudTableは編集時に全フィールドを送信するため、両方が同時にセットされたデータが保存可能になる。設計書6.1の「按分テンプレートIDとコストセンターIDは排他的」に違反。",
      "suggestion": "updateRecurringTransactionのupdateData構築後、prisma.update呼び出し前に以下の排他チェックを追加する:\n\nconst effectiveCostCenterId = 'costCenterId' in updateData ? updateData.costCenterId : (await prisma.recurringTransaction.findUnique({ where: { id }, select: { costCenterId: true } }))?.costCenterId;\nconst effectiveAllocId = 'allocationTemplateId' in updateData ? updateData.allocationTemplateId : (await prisma.recurringTransaction.findUnique({ where: { id }, select: { allocationTemplateId: true } }))?.allocationTemplateId;\nif (effectiveCostCenterId && effectiveAllocId) { throw new Error('プロジェクト（按分なし）と按分テンプレートは同時に設定できません'); }\n\nまたは、既にexistingを取得しているのでそのselectにcostCenterId, allocationTemplateIdを追加し、updateDataとマージして判定する方がシンプル。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/recurring-transactions/actions.ts",
      "description": "deleteRecurringTransactionで対象レコードの存在チェック・論理削除済みチェックが未実装。updateRecurringTransactionは既存レコードの存在とdeletedAtを確認しているが、deleteではPrismaのupdateを直接呼び出しており、削除済みレコードを再削除できてしまう。",
      "suggestion": "deleteRecurringTransactionの冒頭で以下を追加する:\nconst existing = await prisma.recurringTransaction.findUnique({ where: { id }, select: { id: true, deletedAt: true } });\nif (!existing || existing.deletedAt) { throw new Error('定期取引が見つかりません'); }"
    }
  ],
  "summary": "要望書2.7.2の全設定項目を網羅し、設計書④のスキーマとも一致。CrudTableパターン、論理削除、費目の種別別動的フィルタリング、消費税自動計算など既存パターンに忠実な実装。ただしupdateRecurringTransactionにcostCenterId/allocationTemplateIdの排他制約チェックが欠落しており（createには存在する）、設計書6.1に違反するデータ不整合が発生しうるためmajor判定。この1点を修正すれば品質は十分。"
}
```
