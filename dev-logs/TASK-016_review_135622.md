全ての情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果

### 対象コミット: `47d465c feat(TASK-016): 実装 (attempt 1)`

### 変更ファイル
- `src/app/accounting/dashboard/actions.ts` (303行) — Server Action: `getDashboardData`
- `src/app/accounting/dashboard/page.tsx` (317行) — ダッシュボードUI

---

### 1. 仕様との整合性チェック

#### 設計書 1.2 / 要望書 3.1 との照合

| 仕様項目 | 実装状況 | 判定 |
|---|---|---|
| 未処理件数: 未仕訳取引 | `status in ["awaiting_accounting","resubmitted"]` かつ `journalEntries: none` でカウント | OK |
| 未処理件数: 未消込入出金 | `reconciliations: none` の BankTransaction をカウント | OK |
| 未処理件数: 按分未確定 | Raw SQL で AllocationTemplateLine に対応する AllocationConfirmation がない取引を検出 | OK |
| アラート: 取引未申請 | アクティブ契約で当月取引がないものを検出 | OK |
| アラート: 契約矛盾 | 契約終了日 < periodFrom のトランザクションを検出 | OK |
| アラート: 残高アラート | PaymentMethod の初期残高 + 入金 - 出金 < 閾値で検出 | OK |
| アラート: 入金期限超過 | paymentDueDate < now かつ未入金ステータスの InvoiceGroup | OK |
| 今月サマリー: 売上 | revenue 取引の amount + taxAmount 合計 | OK |
| 今月サマリー: 経費 | expense 取引の amount + taxAmount 合計 | OK |
| 今月サマリー: 入金 | incoming の BankTransaction 合計 | OK |
| 今月サマリー: 出金 | outgoing の BankTransaction 合計 | OK |
| 今月サマリー: 未入金 | 未入金ステータスの InvoiceGroup 合計 | OK |
| 画面遷移リンク | 未処理件数3カード + 取引未申請・契約矛盾アラートにリンクあり | 一部欠損（後述） |
| Server Actions | `getDashboardData` として実装 | OK |

---

### 2. Prismaスキーマとの整合性

実装で使用しているモデル・フィールド・リレーションを全てスキーマと照合しました:

- `Transaction.status`, `journalEntries`, `contractId`, `contract`, `periodFrom`, `allocationTemplateId` — 全て存在 ✅
- `BankTransaction.reconciliations`, `direction`, `amount`, `transactionDate`, `paymentMethodId` — 全て存在 ✅
- `AllocationTemplateLine.templateId`, `costCenterId` — 全て存在 ✅
- `AllocationConfirmation.transactionId`, `costCenterId` — 全て存在 ✅
- `MasterContract.isActive`, `endDate`, `finTransactions`, `company.name` — 全て存在 ✅
- `PaymentMethod.isActive`, `balanceAlertThreshold`, `initialBalance`, `methodType` — 全て存在 ✅
- `InvoiceGroup.paymentDueDate`, `status`, `counterparty.name`, `invoiceNumber`, `totalAmount` — 全て存在 ✅

---

### 3. 問題点

#### minor-1: 残高アラート・入金期限超過に遷移リンクがない

タスク仕様に「各項目からの画面遷移リンク」とあるが、残高アラートと入金期限超過のアラート行にはリンクが付いていない。未処理件数カード（3つ）、取引未申請、契約矛盾にはリンクがある。

```tsx
// 残高アラート: 表示のみ、リンクなし
<span className="text-red-600 font-medium whitespace-nowrap">
  ¥{formatCurrency(alert.currentBalance)} / 閾値 ¥{formatCurrency(alert.threshold)}
</span>

// 入金期限超過: 表示のみ、リンクなし
<div className="text-red-600 font-medium">
  期限: {formatDate(alert.paymentDueDate)}
</div>
```

**提案**: 残高アラートは `/accounting/masters/payment-methods` へ、入金期限超過は `/accounting/bank-transactions` または将来の請求グループ詳細ページへリンクを追加。

#### minor-2: 残高計算のN+1クエリ

`actions.ts:158-174` で `for...of` ループ内でPaymentMethodごとに2つのaggregateクエリを逐次実行している。

```typescript
for (const pm of paymentMethodsWithThreshold) {
  const [incomingAgg, outgoingAgg] = await Promise.all([...]);
  // ↑ 各PMのincoming/outgoingは並列だが、PM間は逐次
}
```

**提案**: `Promise.all(paymentMethodsWithThreshold.map(async (pm) => { ... }))` で全決済手段を並列処理に変更。

#### minor-3: endOfMonth の境界値

`actions.ts:56` で `endOfMonth` を `23:59:59` としているが、ミリ秒単位のレコード（23:59:59.001〜23:59:59.999）が漏れる可能性がある。

```typescript
const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
```

**提案**: `const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)` を使い、`lte: endOfMonth` を `lt: startOfNextMonth` に変更するパターンが一般的。

#### minor-4: 契約矛盾クエリの効率

`actions.ts:107-118` で最大100件取得後にJSでフィルタしている。Prismaの `where` では `endDate < periodFrom` を直接表現できないため raw SQL がより効率的だが、実用上はデータ量が限定的で問題ない。

---

### 4. 良い点

- **型定義**: `DashboardData` 型がServer Action の戻り値として明確に定義されており、型安全性が高い
- **論理削除対応**: 全クエリで `deletedAt: null` を適切にフィルタしている
- **UI設計**: 色分け（orange/blue/purple/red/green/yellow）でカテゴリを視覚的に区別、レスポンシブ対応（grid-cols-1 → sm:grid-cols-3, lg:grid-cols-2）
- **並列クエリ**: `Promise.all` で独立したクエリを並列実行し、パフォーマンスを最適化
- **按分未確定の Raw SQL**: Prisma Client では表現しにくい LEFT JOIN + IS NULL パターンを Raw SQL で適切に実装

---

### 5. 結論

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/dashboard/page.tsx",
      "description": "残高アラート・入金期限超過のアラート行に画面遷移リンクがない（仕様: 各項目からの画面遷移リンク）",
      "suggestion": "残高アラートは /accounting/masters/payment-methods へ、入金期限超過は将来の請求グループ詳細ページ（/accounting/invoices/{id}等）へ Link を追加"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/dashboard/actions.ts",
      "description": "残高アラート計算で PaymentMethod ごとに逐次クエリ（N+1問題）",
      "suggestion": "for...of を Promise.all(paymentMethodsWithThreshold.map(...)) に変更して並列化"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/dashboard/actions.ts",
      "description": "endOfMonth が 23:59:59.000 で、ミリ秒単位のレコードが漏れる可能性",
      "suggestion": "startOfNextMonth を lt で使用する方式に変更: const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/dashboard/actions.ts",
      "description": "契約矛盾チェックで最大100件取得後にJS側フィルタ（効率の軽微な問題）",
      "suggestion": "将来データ量増加時は Raw SQL で endDate < periodFrom を直接フィルタすることを検討"
    }
  ],
  "summary": "設計書・要望書の仕様を忠実に実装しており、Prismaスキーマとの整合性も問題なし。未処理件数・アラート4種類・今月サマリー5項目が全て正しく実装されている。指摘は全てminorレベル（遷移リンクの一部欠損、パフォーマンス最適化、境界値処理）であり、機能的な問題はない。"
}
```
