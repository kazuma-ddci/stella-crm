# CrudTable コンポーネント

このドキュメントはCrudTableコンポーネントの使用方法を記述したものです。

---

## 目次

1. [概要](#概要)
2. [主な機能](#主な機能)
3. [ColumnDefの主要プロパティ](#columndefs主要プロパティ)
4. [使用例](#使用例)

---

## 概要

`src/components/crud-table.tsx` に実装された汎用CRUDテーブルコンポーネント。

---

## 主な機能

- 一覧表示（フィルタリング、ソート）
- 新規追加ダイアログ
- 編集ダイアログ
- 削除確認ダイアログ
- 簡易/詳細入力モード切り替え
- カスタムアクションボタン
- インライン編集（別ドキュメント参照: `docs/components/inline-edit.md`）

---

## ColumnDefの主要プロパティ

```typescript
type ColumnDef = {
  key: string;
  header: string;
  type?: "text" | "number" | "date" | "datetime" | "boolean" | "textarea" | "select";
  editable?: boolean;           // 編集可否（デフォルトtrue）
  editableOnCreate?: boolean;   // 新規作成時のみ編集可能
  editableOnUpdate?: boolean;   // 編集時のみ編集可能
  options?: { value: string; label: string }[];
  required?: boolean;
  searchable?: boolean;         // selectで検索可能にする
  simpleMode?: boolean;         // 簡易入力モードで表示するか
  hidden?: boolean;             // テーブル表示時に非表示
  inlineEditable?: boolean;     // インライン編集可能
  dynamicOptionsKey?: string;   // 動的オプションのキー
  dependsOn?: string;           // 依存するカラム
};
```

---

## 使用例

### 基本的な使用例

```tsx
import { CrudTable } from "@/components/crud-table";

const columns: ColumnDef[] = [
  { key: "name", header: "名前", type: "text", required: true },
  { key: "email", header: "メール", type: "text" },
  { key: "status", header: "ステータス", type: "select", options: [
    { value: "active", label: "アクティブ" },
    { value: "inactive", label: "非アクティブ" },
  ]},
  { key: "createdAt", header: "作成日", type: "date", editable: false },
];

export default function MyTable({ data }) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="ユーザー一覧"
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
}
```

### カスタムアクションボタン

```tsx
<CrudTable
  data={data}
  columns={columns}
  customActions={(row) => (
    <Button onClick={() => openModal(row)}>
      詳細
    </Button>
  )}
/>
```

### 更新APIの実装パターン（⚠️必須）

crud-tableは**差分送信方式**を採用しています：
- **インライン編集**: 変更した1項目のみ送信 `{ [columnKey]: newValue }`
- **通常編集（モーダル）**: 変更のあった項目のみ送信（`computeChangedData()`）

このため、`onUpdate` で呼ばれる更新関数は**必ず `"key" in data` パターンで差分対応**すること。

```typescript
// ❌ 間違い: 全項目上書き（未送信項目が null/false/NaN で破壊される）
export async function updateXxx(id: number, data: Record<string, unknown>) {
  await prisma.xxx.update({
    where: { id },
    data: {
      name: (data.name as string) || "",        // 未送信時に "" で上書き
      isActive: data.isActive === true,          // 未送信時に false 化
      companyId: Number(data.companyId),          // 未送信時に NaN
    },
  });
}

// ✅ 正しい: 差分更新（送信されたフィールドのみ更新）
export async function updateXxx(id: number, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = (data.name as string) || "";
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";
  if ("companyId" in data) updateData.companyId = Number(data.companyId);

  if (Object.keys(updateData).length > 0) {
    await prisma.xxx.update({ where: { id }, data: updateData });
  }
}
```

> **関連**: `docs/troubleshooting.md` の「update関数の部分更新未対応でフィールドがnull/falseに上書きされる」も参照。

---

### selectの「-」(null)オプションと「なし」(none)の重複に注意

CrudTableのselectは自動で「-」（値=`null`）オプションを先頭に追加する。optionsに `{ value: "none", label: "なし" }` が含まれている場合は自動的に非表示になるが、新しいselectフィールドを追加する際は以下に注意：

- **optionsに「未選択」相当がある場合**（`value: "none"` 等）→ CrudTableが自動で「-」を非表示にする
- **optionsに「未選択」相当がない場合** → CrudTableが「-」を自動追加する（従来の動作）

> **関連**: `docs/troubleshooting.md` の「CrudTableのselectで「-」(null)オプションが「なし」(none)と重複し意図しない変更が発生する」も参照。

---

### インライン編集を有効にする場合

インライン編集の詳細については `docs/components/inline-edit.md` を参照してください。

```tsx
<CrudTable
  data={data}
  columns={columns}
  enableInlineEdit={true}
  inlineEditConfig={{
    columns: ["name", "email", "status"],
    getOptions: (row, columnKey) => {
      if (columnKey === "status") {
        return [
          { value: "active", label: "アクティブ" },
          { value: "inactive", label: "非アクティブ" },
        ];
      }
      return [];
    },
  }}
/>
```
