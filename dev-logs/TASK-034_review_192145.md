レビューが完了しました。以下が結果です。

---

## TASK-034: STPプロジェクトダッシュボード レビュー結果

### 仕様との整合性チェック

| 要件 | 状態 |
|---|---|
| 取引サマリー（売上/経費の合計、ステータス別件数） | OK |
| 請求状況（請求グループのステータス別） | OK |
| 支払状況（支払グループのステータス別） | OK |
| 直近のアクティビティ | OK |
| Server Actions: getProjectDashboard | OK |
| ページ: /stp/finance/overview | OK |

### 詳細チェック

**1. ステータス定義 — Prismaスキーマとの一致**

- **Transaction**: `unconfirmed | confirmed | awaiting_accounting | returned | resubmitted | journalized | partially_paid | paid | hidden` — actions.ts / page.tsx のラベルマッピングと完全一致
- **InvoiceGroup**: `draft | pdf_created | sent | awaiting_accounting | partially_paid | paid | returned | corrected` — 完全一致
- **PaymentGroup**: `before_request | requested | invoice_received | rejected | re_requested | confirmed | paid` — 完全一致

**2. 税込計算ロジック**

`actions.ts:194-196` の `calcTotalWithTax`:
- `tax_included` → `amount`のみ返す（既に税込）
- `tax_excluded` → `amount + taxAmount` を返す

Prismaスキーマの `amount Int // 金額（税抜）`, `taxType String @default("tax_excluded")` と整合。正しい。

**3. データ取得**

- 全クエリに `deletedAt: null` フィルタあり — 論理削除対応OK
- `Promise.all` で6クエリを並列実行 — パフォーマンス考慮OK
- `counterpartyId` は必須FK（`Int`）なので `counterparty.name` へのアクセスは安全
- `expenseCategoryId` も必須FK — 同様に安全

**4. ページ構成**

- Server Component（`"use client"` なし）— データ取得パターンとして正しい
- リンク先: `/stp/finance/transactions`, `/stp/finance/invoices`, `/stp/finance/payment-groups` — 設計書1.2のページ構成と一致
- 空状態のハンドリングあり（各セクションで0件チェック）

**5. 月別推移**

- `periodFrom` を月初〜翌月初でフィルタ — 正しいロジック
- 直近6ヶ月を表示 — 旧実装を踏襲

### 検出した問題

**Minor 1**: `actions.ts:113` に未使用変数 `sixMonthsAgo` がある。`monthStarts[0]` を代入しているが、どこからも参照されていない。

**Minor 2**: `TRANSACTION_STATUS_LABELS` が `actions.ts:68-78` と `page.tsx:29-39` の両方に同一の定義がある。actions.ts 側をエクスポートして page.tsx から参照すればコードの重複とドリフトリスクを排除できる。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/stp/finance/overview/actions.ts",
      "description": "未使用変数 `sixMonthsAgo`（113行目）が残っている。monthStarts[0] を代入しているが、以降のコードで参照されていない",
      "suggestion": "`const sixMonthsAgo = monthStarts[0];` の行を削除する"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/overview/page.tsx",
      "description": "TRANSACTION_STATUS_LABELS が actions.ts と page.tsx の両方に同一定義されており、コード重複・ドリフトリスクがある",
      "suggestion": "actions.ts 側の TRANSACTION_STATUS_LABELS を export し、page.tsx からは import して使用する"
    }
  ],
  "summary": "仕様書（要望書8.1、設計書1.2）の要件を全て満たしている。Prismaスキーマとのステータス定義、税込計算ロジック、deletedAtフィルタ、リンク先パスの整合性は全てOK。旧STP固有テーブル（StpRevenueRecord等）から新統一テーブル（Transaction）への移行も正しく反映されている。検出された2件のminor issueは、未使用変数とラベル定義の重複であり、機能上の問題はない。"
}
```
