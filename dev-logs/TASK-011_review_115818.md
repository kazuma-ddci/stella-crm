全ファイルの確認が完了しました。前回レビュー（attempt 1）の指摘事項と、今回の修正（attempt 2）を照合した上で、最終レビューをまとめます。

---

## TASK-011 レビュー結果（attempt 2）

### 前回レビュー指摘事項の修正状況

| # | 種別 | 指摘内容 | 修正状況 |
|---|------|----------|----------|
| 1 | major | APIルート認証チェック欠如 | ✅ `auth()` チェック追加 |
| 2 | major | `removeTransactionFromGroup` でグループ所属未検証 | ✅ `invoiceGroupId: groupId` をwhere句に追加 |
| 3 | major | `updateInvoiceGroup` のPDF無効化条件不整合（`&& group.pdfPath`） | ✅ `&& group.pdfPath` を削除し統一 |
| 4 | minor | `updateInvoiceGroup` のステータスブロックに `returned` 欠如 | ✅ `"returned"` を追加 |
| 5 | minor | `page.tsx` と `getInvoiceGroups` でクエリ重複 | ✅ `getInvoiceGroups()` 呼び出しに統一 |
| 6 | minor | 訂正請求書の差し替え時N+1パターン | ✅ `updateMany` に変更 |

**全6件修正済み。**

---

### 仕様整合性チェック

#### テーブル定義（Prisma vs 設計書 ②）
Prismaスキーマの `InvoiceGroup` モデルは設計書と完全一致。全カラム（id, counterpartyId, operatingCompanyId, bankAccountId, invoiceNumber, invoiceDate, paymentDueDate, subtotal, taxAmount, totalAmount, pdfPath, pdfFileName, originalInvoiceGroupId, correctionType, status, createdBy, updatedBy, createdAt, updatedAt, deletedAt）が揃っている。✓

#### 作成フロー（要望書 2.3.1）
3ステップウィザード: 取引先選択 → 確認済み＆未グループ化取引のチェック → 請求情報設定。仕様通り。✓

#### ステータス遷移（設計書 6.8）
```
draft → pdf_created → sent → awaiting_accounting → partially_paid → paid
                                                  → returned
sent → corrected
returned → draft
```
`updateInvoiceGroupStatus` の `validTransitions` マップと完全一致。✓

#### 操作制限（要望書 2.3.4 / 設計書 6.8.1）
- **draft**: 追加/削除/編集/PDF作成/削除可 ✓
- **pdf_created**: 追加/削除/編集可（PDF無効化）、送付可 ✓
- **sent/awaiting_accounting**: 編集不可、訂正のみ ✓
- **corrected**: 閲覧のみ ✓
- **returned**: 編集不可（draftに戻してから）✓

#### 請求書番号自動採番（設計書 8.7）
`generateInvoiceGroupNumber`: フォーマット `{abbreviation}-INV-{YYYYMM}-{NNNN}`、トランザクション内で排他制御。仕様通り。✓

#### 訂正請求書（要望書 2.3.3）
差し替え（replacement）: 元取引を新グループに移動、金額引き継ぎ。✓
追加請求（additional）: 新規空グループ作成。✓
元請求書は `corrected` ステータスに遷移。✓

---

### 新規指摘事項

#### Minor 1: APIルートの認可レベルが不足

`src/app/api/finance/invoice-groups/[id]/transactions/route.ts:9-12`

```typescript
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
}
```

認証（ログインチェック）は追加されたが、**認可**（プロジェクトアクセス権限チェック）がない。全Server Actionsは `requireEdit("stp")` でプロジェクトレベルの権限を検証しているが、このAPIルートは任意のログインユーザーがアクセス可能。権限管理が後日対応（要望書 §10）であることを考慮し minor とする。

**修正案**: APIルートにも `requireView` 相当のチェックを追加し一貫性を持たせる。

#### Minor 2: 税額計算方法が仕様と異なる（インボイス制度）

`src/app/stp/finance/invoices/actions.ts:173-184` (`createInvoiceGroup` 内)

```typescript
for (const t of transactions) {
  if (t.taxType === "tax_excluded") {
    subtotal += t.amount;
    taxTotal += t.taxAmount;
  }
}
```

要望書 §9.1では「明細ごとには税額を計算しない。請求グループの小計に対して一括で税額を計算する（インボイス制度準拠）」と規定。現在の実装は個別取引の税額を積み上げ（積上げ計算）しているが、仕様は割戻し計算（`floor(subtotal × rate)`）を要求している。端数処理で1円の差異が発生する可能性がある。

ただし、設計書 6.8「税額参照元」に「請求書PDFに記載する正式な税額は、必ず InvoiceGroup.taxAmount を使用」とあり、PDF生成タスク（TASK別）で最終的な税額を再計算する余地がある。また、混合税率対応（10%と8%の共存）の設計が未確定のため、現時点では minor とする。

**修正案**: `addTransactionToGroup` / `removeTransactionFromGroup` / `createInvoiceGroup` / `recalcInvoiceGroupTotals` の全箇所で、税率別にsubtotalをグループ化してから一括税額計算に変更。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/api/finance/invoice-groups/[id]/transactions/route.ts",
      "description": "APIルートの認可レベルが不足。auth()による認証のみで、requireEdit/requireView('stp')によるプロジェクトレベル認可がない。Server Actionsとの一貫性が欠ける",
      "suggestion": "requireView('stp') 相当の権限チェックを追加する。APIルート用のヘルパーが必要であれば、authヘルパーを拡張する"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/invoices/actions.ts",
      "description": "InvoiceGroupの税額を個別取引のtaxAmountの合計で設定しているが、要望書9.1は小計からの一括計算（割戻し計算、インボイス制度準拠）を要求。端数処理で1円の差異が発生する可能性がある",
      "suggestion": "税率別にsubtotalをグループ化し、floor(subtotal × rate / 100)で一括計算する。createInvoiceGroup, addTransactionToGroup, removeTransactionFromGroup, recalcInvoiceGroupTotals の全箇所で統一する"
    }
  ],
  "summary": "前回レビュー（attempt 1）で指摘した6件（major 3件 + minor 3件）は全て適切に修正されている。APIルート認証追加、returnedステータスのブロック、PDF無効化条件の統一、グループ所属検証の追加、N+1パターン解消、クエリ重複排除の全てが確認できた。残存する2件のminor指摘（APIルートの認可レベル、税額計算方法）はいずれも現時点で機能に致命的影響はなく、verdict は OK とする。"
}
```
