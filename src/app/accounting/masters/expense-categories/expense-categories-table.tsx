"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import {
  createExpenseCategory,
  updateExpenseCategory,
  reorderExpenseCategories,
} from "./actions";

const TYPE_OPTIONS = [
  { value: "revenue", label: "売上用" },
  { value: "expense", label: "経費用" },
  { value: "both", label: "両方" },
];

type AccountOption = {
  value: string;
  label: string;
};

type ProjectOption = {
  value: string;
  label: string;
};

type Props = {
  data: Record<string, unknown>[];
  accountOptions: AccountOption[];
  projectOptions: ProjectOption[];
};

export function ExpenseCategoriesTable({ data, accountOptions, projectOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "name",
      header: "名称",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "type",
      header: "種別",
      type: "select",
      options: TYPE_OPTIONS,
      required: true,
      filterable: true,
    },
    {
      key: "projectId",
      header: "プロジェクト",
      type: "select",
      options: projectOptions,
      required: true,
      filterable: true,
    },
    {
      key: "defaultAccountId",
      header: "デフォルト勘定科目",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...accountOptions],
    },
    {
      key: "displayOrder",
      header: "表示順",
      type: "number",
      defaultValue: 0,
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
  ];

  const customRenderers: CustomRenderers = {
    defaultAccountId: (value, item) => {
      if (!value) return "（なし）";
      const option = accountOptions.find((o) => o.value === String(value));
      if (option) return option.label;
      const label = item?.defaultAccountLabel as string | undefined;
      return label ? `${label}（無効）` : "（なし）";
    },
    projectId: (value) => {
      if (!value) return "（未設定）";
      const option = projectOptions.find((o) => o.value === String(value));
      return option?.label ?? "（未設定）";
    },
  };

  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
    subLabel: TYPE_OPTIONS.find((o) => o.value === item.type)?.label,
  }));

  return (
    <CrudTable
      tableId="accounting.expense-categories"
      data={data}
      columns={columns}
      title="費目"
      onAdd={createExpenseCategory}
      onUpdate={updateExpenseCategory}
      emptyMessage="費目が登録されていません"
      sortableItems={sortableItems}
      onReorder={async (ids) => {
        const result = await reorderExpenseCategories(ids);
        if (!result.ok) throw new Error(result.error);
      }}
      customRenderers={customRenderers}
    />
  );
}
