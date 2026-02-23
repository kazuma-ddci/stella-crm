設計書の状態遷移・操作制限セクションを確認しました。すべてのファイルの読み込みが完了したので、レビュー結果をまとめます。

---

## TASK-011 レビュー結果

### 全体評価

請求グループ管理画面の主要な機能（一覧表示、新規作成ウィザード、詳細モーダル、取引の追加/削除、訂正請求書作成、ステータス遷移、請求書番号自動採番）は仕様書に概ね忠実に実装されています。UIの3ステップ作成フロー（取引先選択→取引選択→情報設定）は要望書2.3.1に沿っており、ステータス別の操作制限も設計書6.8.1に基づいています。ただし、セキュリティとデータ整合性に関して以下の問題があります。

---

### 指摘事項

#### Major 1: APIルートに認証チェックがない

`src/app/api/finance/invoice-groups/[id]/transactions/route.ts:1-42`

```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
```

他のServer Actionsでは全て `await requireEdit("stp")` または同等の認証チェックを行っていますが、このAPIルートには認証が一切ありません。認証なしで任意の請求グループの取引明細を取得できてしまいます。

**修正案**: `requireEdit("stp")` または `requireView("stp")` の追加。

---

#### Major 2: `removeTransactionFromGroup` で取引の所属グループを検証していない

`src/app/stp/finance/invoices/actions.ts` — `removeTransactionFromGroup`内:

```typescript
await tx.transaction.update({
  where: { id: transactionId },
  data: { invoiceGroupId: null },
});
```

`where` に `invoiceGroupId: groupId` がないため、指定された `transactionId` が別のグループに属していても `invoiceGroupId` が null に上書きされます。グループ所属の検証なしにFK解除が行われるため、データ破損の可能性があります。

**修正案**:
```typescript
await tx.transaction.update({
  where: { id: transactionId, invoiceGroupId: groupId },
  data: { invoiceGroupId: null },
});
```

---

#### Major 3: `updateInvoiceGroup` のPDF無効化条件が `addTransaction`/`removeTransaction` と不整合

`src/app/stp/finance/invoices/actions.ts` — `updateInvoiceGroup`内:

```typescript
// updateInvoiceGroup: pdfPath条件あり（不整合）
if (group.status === "pdf_created" && group.pdfPath) {
```

一方、`addTransactionToGroup` と `removeTransactionFromGroup` では:

```typescript
// addTransactionToGroup / removeTransactionFromGroup: pdfPath条件なし（正しい）
if (group.status === "pdf_created") {
```

`assignInvoiceNumber` は `status: "pdf_created"` に変更しますが `pdfPath` は設定しません。そのため、採番後に `updateInvoiceGroup`（請求日・口座変更等）を行っても、`pdfPath` が null であるためステータスが `draft` に戻りません。取引の追加/削除では正しくリバートされるのに、情報編集では戻らないという不整合が発生します。

**修正案**: `&& group.pdfPath` を削除して `if (group.status === "pdf_created")` に統一。

---

#### Minor 1: `updateInvoiceGroup` が `returned` ステータスをブロックしていない

`src/app/stp/finance/invoices/actions.ts`:

```typescript
if (["sent", "awaiting_accounting", "partially_paid", "paid", "corrected"].includes(group.status)) {
```

設計書6.8.1では `returned` は編集可能なステータスとして記載されていません。状態遷移は `returned → draft` であり、`draft` に戻してから編集するのが正しいフローです。`returned` もブロック対象に追加すべきです。

---

#### Minor 2: `page.tsx` と `getInvoiceGroups` でクエリ・マッピングが重複

`page.tsx` で直接 `prisma.invoiceGroup.findMany` を実行してマッピングしていますが、同一のロジックが `getInvoiceGroups` Server Actionにも存在します。`page.tsx` から `getInvoiceGroups()` を呼ぶ形にすれば重複を排除できます。

---

#### Minor 3: `createCorrectionInvoiceGroup` の差し替え時にN+1更新パターン

`src/app/stp/finance/invoices/actions.ts`:

```typescript
for (const t of original.transactions) {
  await tx.transaction.update({
    where: { id: t.id },
    data: { invoiceGroupId: correction.id },
  });
}
```

`updateMany` で一括更新可能です:
```typescript
await tx.transaction.updateMany({
  where: { id: { in: original.transactions.map(t => t.id) } },
  data: { invoiceGroupId: correction.id },
});
```

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/api/finance/invoice-groups/[id]/transactions/route.ts",
      "description": "APIルートに認証チェックがない。認証なしで任意の請求グループの取引明細を取得可能",
      "suggestion": "import { requireEdit } from '@/lib/auth'; を追加し、ハンドラ冒頭で await requireEdit('stp') を呼ぶ"
    },
    {
      "severity": "major",
      "file": "src/app/stp/finance/invoices/actions.ts",
      "description": "removeTransactionFromGroup で transaction.update の where に invoiceGroupId: groupId がなく、別グループの取引を誤って解除する可能性がある",
      "suggestion": "where: { id: transactionId, invoiceGroupId: groupId } に変更"
    },
    {
      "severity": "major",
      "file": "src/app/stp/finance/invoices/actions.ts",
      "description": "updateInvoiceGroup のPDF無効化条件が group.status === 'pdf_created' && group.pdfPath となっているが、assignInvoiceNumber は pdfPath を設定しないため、採番後の情報編集でステータスが draft に戻らない。addTransaction/removeTransaction との不整合",
      "suggestion": "&& group.pdfPath を削除し、if (group.status === 'pdf_created') に統一"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/invoices/actions.ts",
      "description": "updateInvoiceGroup のステータスブロックリストに 'returned' が含まれていない。設計書6.8.1では returned は編集不可（draft に戻してから編集）",
      "suggestion": "ブロックリストに 'returned' を追加"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/invoices/page.tsx",
      "description": "page.tsx で prisma.invoiceGroup.findMany を直接呼びマッピングしているが、同一ロジックが getInvoiceGroups Server Action にも存在する（コード重複）",
      "suggestion": "page.tsx から getInvoiceGroups() を呼ぶ形に統一"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/invoices/actions.ts",
      "description": "createCorrectionInvoiceGroup の差し替え時、forループで個別 update しておりN+1パターン",
      "suggestion": "updateMany で一括更新に変更"
    }
  ],
  "summary": "主要機能は仕様に忠実に実装されているが、APIルートの認証欠如（セキュリティ）、取引削除時のグループ所属検証不足（データ整合性）、PDF無効化条件の不整合（ステータス管理の一貫性）の3つのmajor issueがあるためNG。修正は局所的で影響範囲は小さい。"
}
```
