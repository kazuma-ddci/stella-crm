# SPEC-UI-002: 企業選択UI/UXパターン

## メタ情報

| 項目 | 値 |
|------|-----|
| SPEC ID | SPEC-UI-002 |
| ステータス | ✅ confirmed |
| オーナー | - |
| 最終更新 | 2026-02-07 |
| 関連ファイル | `src/components/crud-table.tsx`, `src/components/editable-cell.tsx`, `src/components/company-code-label.tsx`, 全STPテーブル |

## 背景（なぜこの仕様が必要か）

STPプロジェクトでは企業選択（STP企業、代理店企業、全顧客マスタ企業など）を行うプルダウンが複数の画面に存在する。
画面ごとにUI/UXがバラつくと、ユーザーの混乱や実装ミスにつながるため、統一パターンを確定仕様とする。

## 決定事項

### 1. 選択肢のラベル形式

**必ず `{企業コード} {企業名}` 形式を使用する。**

```typescript
// ✅ 正しい形式
const options = companies.map((c) => ({
  value: String(c.id),
  label: `${c.company.companyCode} ${c.company.name}`,
}));
// 例: "SC-1 株式会社テスト"

// ❌ 間違い（過去ミスあり）
label: `（${c.company.name}）${c.company.companyCode}`  // 括弧形式は不可
label: `${c.company.name}`                              // 企業コードなしは不可
label: `${c.id} - ${c.company.name}`                    // IDではなく企業コードを使う
```

### 2. セレクトUIコンポーネント

**検索可能なCombobox（Command/Popover）を使用する。**

CrudTableのColumnDefでは `searchable: true` を設定：

```typescript
{
  key: "stpCompanyId",
  header: "入社先",       // 用途に応じたヘッダー名
  type: "select",
  options: stpCompanyOptions,
  searchable: true,        // ← 必須: Combobox検索を有効化
}
```

これにより：
- テキスト入力で選択肢を絞り込める
- 選択肢が多くても素早く見つけられる
- 空選択（"-"）で値をクリアできる

### 3. テーブル表示値とインライン編集

**displayToEditMappingパターンを使用する。**

テーブルでは企業IDではなく、ラベル形式の表示値を見せる。
インライン編集時はIDフィールドに切り替える。

```typescript
// --- page.tsx（サーバーコンポーネント）---
const data = items.map((item) => ({
  // 編集用（IDをstring化）
  stpCompanyId: item.stpCompanyId ? String(item.stpCompanyId) : null,
  // 表示用（ラベル形式）
  stpCompanyDisplay: item.stpCompany
    ? `${item.stpCompany.company.companyCode} - ${item.stpCompany.company.name}`
    : null,
}));

// --- table.tsx（クライアントコンポーネント）---

// InlineEditConfig
const inlineEditConfig: InlineEditConfig = {
  columns: ["stpCompanyId"],  // 編集対象はIDカラム
  displayToEditMapping: {
    stpCompanyDisplay: "stpCompanyId",  // 表示→編集のマッピング
  },
  getOptions: (_row, columnKey) => {
    if (columnKey === "stpCompanyId") {
      return stpCompanyOptions;
    }
    return [];
  },
};

// customRenderers（通常表示時はラベルを表示）
customRenderers={{
  stpCompanyId: (value: unknown, row: Record<string, unknown>) => {
    return (row.stpCompanyDisplay as string) || "-";
  },
}}
```

### 4. サーバーアクション（保存時）

**IDはNumber型に変換して保存する。**

```typescript
// actions.ts
if ("stpCompanyId" in data) {
  updateData.stpCompanyId = data.stpCompanyId
    ? Number(data.stpCompanyId)
    : null;
}
```

### 5. テーブルセルの企業名表示（CompanyCodeLabel）

**テーブルセルで企業名を表示する際は `CompanyCodeLabel` コンポーネントを使用する。**

企業コードの桁数（SC-1, SC-10, SC-100）に関わらず、企業名の開始位置が揃う。

```tsx
import { CompanyCodeLabel } from "@/components/company-code-label";

// customRenderer内での使用例
companyName: (value, row) => {
  const companyCode = row.companyCode as string;
  return (
    <Link href={`/companies/${row.companyId}`}>
      <CompanyCodeLabel code={companyCode} name={String(value)} />
    </Link>
  );
},
```

**page.tsx のデータマッピングでは企業コードと企業名を別フィールドで渡す：**

```typescript
// ✅ 正しい（別フィールドで渡す）
companyCode: c.company.companyCode,
companyName: c.company.name,

// ❌ 間違い（旧形式: IDを括弧で囲む文字列結合）
companyName: `（${c.companyId}）${c.company.name}`,
companyName: `(${c.company.id})${c.company.name}`,
```

詳細: `docs/components/company-code-label.md`

### 6. オプション値の型

```typescript
type CompanyOption = {
  value: string;   // ID（string化）— CrudTableのselect仕様に合わせる
  label: string;   // `{企業コード} {企業名}`
};
```

## 禁止事項（forbidden_changes）

- ❌ ラベル形式を `（企業名）企業コード` などに変更すること
- ❌ 企業コードなしで企業名のみを表示すること
- ❌ 企業選択で `searchable: true` を付けないこと（検索不可になる）
- ❌ テーブル表示でIDをそのまま表示すること（displayToEditMapping必須）
- ❌ 新規画面で独自の企業選択UIを作ること（既存パターンを使う）
- ❌ テーブル表示で `（ID）企業名` や `(ID)企業名` 形式を使うこと（CompanyCodeLabel必須）

## 影響範囲

現在このパターンを使用しているファイル：

| 画面 | ファイル | 対象カラム |
|------|---------|-----------|
| STP企業情報 | `stp/companies/stp-companies-table.tsx` | companyName, agentName |
| 代理店情報 | `stp/agents/agents-table.tsx` | companyName, referrerCompanyName |
| 契約書情報 | `stp/contracts/contracts-table.tsx` | companyName |
| 求職者情報 | `stp/candidates/candidates-table.tsx` | stpCompanyId（入社先） |
| リード回答 | `stp/lead-submissions/submissions-table.tsx` | stpCompanyId（STP企業） |
| 代理店接触履歴 | `stp/records/agent-contacts/agent-contacts-table.tsx` | agentName |
| 企業接触履歴 | `stp/records/company-contacts/company-contacts-table.tsx` | companyName |

## 検証方法

- 企業選択プルダウンが検索可能であること
- 選択肢の表示が `{企業コード} {企業名}` であること
- テーブル上の表示値もラベル形式であること
- インライン編集時にComboboxで選択できること
- 空選択（"-"）でnullに戻せること

## ロールバック手順

この仕様を取り消す場合の手順：

1. 各テーブルの `stpCompanyOptions` のlabel形式を変更
2. `displayToEditMapping` のマッピングを更新
3. `customRenderers` の表示を更新

## 変更履歴

| 日付 | 変更内容 | 承認者 |
|------|---------|--------|
| 2026-02-06 | 初版作成 | - |
| 2026-02-07 | テーブル表示のCompanyCodeLabel仕様追加、禁止事項追加、影響範囲を更新 | - |
