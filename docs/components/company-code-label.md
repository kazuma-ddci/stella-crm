# CompanyCodeLabel - 企業コード・企業名表示コンポーネント

## 概要

テーブル等で企業を表示する際、`{企業コード} {企業名}` 形式で統一表示するコンポーネント。
企業コードの桁数（SC-1, SC-10, SC-100）に関わらず、企業名の開始位置が揃う。

## コンポーネント

**ファイル:** `src/components/company-code-label.tsx`

### Props

| Props | 型 | 説明 |
|-------|-----|------|
| code | string | 企業コード（例: SC-1） |
| name | string | 企業名 |

### 使用例

```tsx
import { CompanyCodeLabel } from "@/components/company-code-label";

// 基本使用
<CompanyCodeLabel code="SC-1" name="株式会社テスト" />

// Link内で使用（customRenderer内）
<Link href={`/companies/${companyId}`}>
  <CompanyCodeLabel code={companyCode} name={companyName} />
</Link>
```

### 桁揃えの仕組み

- 企業コード部分に `font-mono` + `style={{ minWidth: "7ch" }}` + `shrink-0` を適用
- CSS `ch` 単位はモノスペースフォントの「0」の幅に基づくため、文字幅に正確に連動
- 企業コード部分に `mr-2` で企業名との余白を確保
- SC-1 でも SC-100 でも企業名が同じ位置から開始

**CSS単位の選択理由:**

| 単位 | 問題点 |
|------|--------|
| `em` / `rem` | フォントサイズ基準のため、モノスペースの文字幅と一致しない |
| `min-w-[Xrem]` | Tailwindの固定値では桁数変化に対応しにくい |
| **`ch`（採用）** | モノスペースフォントの1文字幅に正確に対応。7ch = 最大7文字分 |

## 使用箇所

### テーブル表示（customRenderer / JSX直接使用）

| 画面 | ファイル | 対象カラム |
|------|---------|-----------|
| 代理店情報 | `stp/agents/agents-table.tsx` | companyName, referrerCompanyName |
| STP企業情報 | `stp/companies/stp-companies-table.tsx` | companyName, agentName |
| 契約書情報 | `stp/contracts/contracts-table.tsx` | companyName |
| 代理店接触履歴 | `stp/records/agent-contacts/agent-contacts-table.tsx` | agentName（TableCell直接） |
| 企業接触履歴 | `stp/records/company-contacts/company-contacts-table.tsx` | companyName（TableCell直接） |
| 売上管理 | `stp/finance/revenue/revenue-table.tsx` | stpCompanyId（customRenderer） |
| 経費管理 | `stp/finance/expenses/expenses-table.tsx` | stpCompanyId（customRenderer） |
| 求職者情報 | `stp/candidates/candidates-table.tsx` | stpCompanyId（customRenderer） |

### データ生成（page.tsx）の注意点

CompanyCodeLabel を使う場合、page.tsx のデータマッピングでは **企業コードと企業名を別フィールドで渡す** 必要がある。

```typescript
// ✅ 正しい（別フィールドで渡す）
companyCode: c.company.companyCode,
companyName: c.company.name,

// ❌ 間違い（旧形式: 文字列結合）
companyName: `（${c.companyId}）${c.company.name}`,
companyName: `(${c.company.id})${c.company.name}`,
```

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-02-07 | 初版作成。旧形式 `（ID）企業名` から `SC-X - 企業名` に全画面統一 |
| 2026-02-07 | 桁揃えCSSを `min-w-[4rem]` → `minWidth: "7ch"` に変更。セパレーター余白を `mx-1` → `mx-2` に拡大。finance/candidates ページの使用箇所を追記 |
