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
