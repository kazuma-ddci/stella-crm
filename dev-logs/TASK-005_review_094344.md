すべての情報が揃いました。レビューを実施します。

---

## コードレビュー: TASK-005 決済手段マスタ管理画面

### 確認対象
- コミット: `4606516` feat(TASK-005): 実装 (attempt 1)
- 変更ファイル: 3ファイル（actions.ts, page.tsx, payment-methods-table.tsx）

---

### 1. テーブル定義 vs Prismaスキーマ vs 設計書

**設計書⑱ PaymentMethod** と **prisma/schema.prisma** のPaymentMethodモデルは完全一致を確認済み。

実装でカバーされているフィールド:

| フィールド | create | update | 一覧表示 | フォーム |
|---|---|---|---|---|
| methodType | ✅ | ✅ | ✅ | ✅ |
| name | ✅ | ✅ | ✅ | ✅ |
| details (JSON) | ✅ | ✅ | - | ✅ (種別別) |
| initialBalance | ✅ | ✅ | ✅ | ✅ |
| initialBalanceDate | ✅ | ✅ | - | ✅ |
| balanceAlertThreshold | ✅ | ✅ | - | ✅ |
| closingDay | ✅ | ✅ | - | ✅ |
| paymentDay | ✅ | ✅ | - | ✅ |
| settlementAccountId | ✅ | ✅ | - | ✅ |
| isActive | ✅ | ✅ | ✅ | ✅ |
| createdBy | ✅ | - | - | - |
| updatedBy | - | ✅ | - | - |
| deletedAt | ✅ (フィルタ) | - | - | - |

全フィールドが設計書どおりに実装されています。

---

### 2. 要望書3.3.2との整合性

要望書の決済手段マスタ要件:

| 要件 | 実装状況 |
|---|---|
| 種別: 現金、銀行口座、クレジットカード、仮想通貨ウォレット | ✅ `VALID_METHOD_TYPES` |
| 名称（例: 三菱UFJ普通、会社用VISA） | ✅ |
| 種別ごとの詳細情報（JSON） | ✅ `buildDetails()` |
| 初期残高、初期残高日 | ✅ |
| 残高アラート閾値 | ✅ |
| クレカ用: 締め日、引落日、引落口座ID | ✅ `visibleWhen` で条件表示 |

---

### 3. バリデーションルール（設計書セクション6）

PaymentMethod固有のバリデーションは設計書6に明示されていないが、一般的なバリデーションとして:

| バリデーション | 実装 |
|---|---|
| methodType列挙値チェック | ✅ `VALID_METHOD_TYPES` |
| 名称必須 | ✅ create/update両方 |
| 名称重複チェック（論理削除考慮） | ✅ `deletedAt: null` |
| closingDay範囲チェック (1-31) | ✅ |
| paymentDay範囲チェック (1-31) | ✅ |
| credit_card以外ではクレカフィールド無視 | ✅ (create時) |

---

### 4. 設計書6.7 ポリモーフィック排他制約

PaymentMethodテーブルは6.7の排他制約テーブル（Attachment, InvoiceMail, TransactionComment, CryptoTransactionDetail, JournalEntry）に**含まれていない**ため該当なし。

---

### 5. 既存パターンとの整合性

| 観点 | 状態 |
|---|---|
| `"use server"` + `getSession()` | ✅ 既存パターン準拠 |
| `throw new Error()` によるエラー通知 | ✅ |
| 部分更新 `"key" in data` パターン | ✅ |
| `revalidatePath()` | ✅ |
| `deletedAt: null` フィルタ | ✅ |
| Card/CardHeader/CardContent レイアウト | ✅ |
| CrudTable + ColumnDef + customRenderers | ✅ |
| `visibleWhen` による種別別フォーム | ✅ |
| `Prisma.DbNull` でJson?フィールドのnull処理 | ✅ |
| details JSONのキーマッピング整合性（crypto: `cryptoCurrency`→`currency`等） | ✅ page.tsx ↔ actions.ts 一致 |

---

### 6. 検出された問題

#### Minor 1: 種別変更時のクレカ専用フィールドクリア不足

`updatePaymentMethod` で `methodType` を `credit_card` から他の種別に変更した場合、`closingDay`/`paymentDay`/`settlementAccountId` が自動クリアされません。CrudTableは `visibleWhen` で非表示にしたフィールドの値を `formData` から削除しないため、旧値がそのまま送信・保存される可能性があります。

**影響**: 通常の運用で種別変更は稀であり、表示上は `visibleWhen` で隠されるため機能的な問題は生じにくい。ただしデータの整合性としては不完全。

**修正案** (`actions.ts:updatePaymentMethod` の methodType 変更処理部分):
```typescript
if ("methodType" in data) {
  // ... 既存処理 ...
  // 種別変更時、旧種別のフィールドをクリア
  if (effectiveMethodType !== "credit_card") {
    updateData.closingDay = null;
    updateData.paymentDay = null;
    updateData.settlementAccountId = null;
  }
}
```

#### Minor 2: settlementAccountId の参照整合性チェック不足

`settlementAccountId` に対して、指定IDが実在する有効な銀行口座タイプの `PaymentMethod` か検証していません。UIの `select` 制約で通常は防がれますが、Server Action直接呼び出しでは不正値が入る可能性があります。

**影響**: 既存パターン（expense-categories の `defaultAccountId` 等）でもFKの存在チェックを省略している画面があるため、既存基準としては許容範囲。

**修正案** (`actions.ts` のcreate/update両方):
```typescript
if (settlementAccountId !== null) {
  const account = await prisma.paymentMethod.findFirst({
    where: { id: settlementAccountId, methodType: "bank_account", isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!account) throw new Error("引落口座が見つからないか無効です");
}
```

---

### 全体評価

3ファイル558行の変更で、設計書・要望書の要件を過不足なく実装しています。コードの構造・パターンは既存の会計マスタ画面（accounts, expense-categories, counterparties）と高い一貫性を保っています。`visibleWhen` を活用した種別別フォーム表示、`buildDetails()` による JSON 組み立て、`customRenderers` による表示カスタマイズなど、CrudTable の機能を適切に活用した実装です。

検出された2件はいずれも minor であり、通常の運用フローでは問題が顕在化しにくいものです。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/payment-methods/actions.ts",
      "description": "updatePaymentMethodでmethodTypeをcredit_cardから他の種別に変更した場合、closingDay/paymentDay/settlementAccountIdが自動クリアされず旧値が残る",
      "suggestion": "methodType変更時に、新しいmethodTypeがcredit_card以外であればclosingDay/paymentDay/settlementAccountIdをnullに明示設定する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/payment-methods/actions.ts",
      "description": "settlementAccountIdの参照整合性チェックがない。指定IDが実在する有効な銀行口座タイプのPaymentMethodか検証していない",
      "suggestion": "settlementAccountIdがnon-nullの場合、prisma.paymentMethod.findFirstで存在・種別・有効フラグを確認する"
    }
  ],
  "summary": "設計書・要望書の要件を忠実に実装しており、既存マスタ画面との一貫性も高い。minor 2件のみで、通常運用に支障なし。verdict: OK"
}
```
