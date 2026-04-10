"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { Badge } from "@/components/ui/badge";
import {
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  reorderExpenseCategories,
} from "./actions";

const TYPE_OPTIONS = [
  { value: "revenue", label: "売上用" },
  { value: "expense", label: "経費用" },
  { value: "both", label: "両方" },
];

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

export function ExpenseCategoriesTable({ data, canEdit }: Props) {
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
      key: "displayOrder",
      header: "表示順",
      type: "number",
      defaultValue: 0,
      hidden: true,
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
  ];

  const sortableItems: SortableItem[] = data
    .map((item) => ({
      id: item.id as number,
      label: item.name as string,
      subLabel: TYPE_OPTIONS.find((o) => o.value === item.type)?.label,
    }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="費目"
      onAdd={canEdit ? createExpenseCategory : undefined}
      onUpdate={canEdit ? updateExpenseCategory : undefined}
      onDelete={canEdit ? deleteExpenseCategory : undefined}
      isDeleteDisabled={(item) => !!item.systemCode}
      emptyMessage="費目が登録されていません"
      sortableItems={sortableItems}
      onReorder={canEdit ? async (ids: number[]) => { await reorderExpenseCategories(ids); } : undefined}
      customRenderers={{
        name: (value, row) => (
          <span className="flex items-center gap-2">
            {String(value)}
            {!!row.systemCode && (
              <Badge variant="secondary" className="text-xs">
                システム
              </Badge>
            )}
          </span>
        ),
      }}
    />
  );
}
