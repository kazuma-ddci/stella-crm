"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { createAccount, updateAccount, reorderAccounts } from "./actions";

const CATEGORY_OPTIONS = [
  { value: "asset", label: "資産" },
  { value: "liability", label: "負債" },
  { value: "equity", label: "純資産" },
  { value: "revenue", label: "売上高" },
  { value: "cost_of_sales", label: "売上原価" },
  { value: "sga", label: "販売費及び一般管理費" },
  { value: "non_operating_revenue", label: "営業外収益" },
  { value: "non_operating_expense", label: "営業外費用" },
  { value: "extraordinary_income", label: "特別利益" },
  { value: "extraordinary_loss", label: "特別損失" },
];

type Props = {
  data: Record<string, unknown>[];
};

export function AccountsTable({ data }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "code",
      header: "科目コード",
      type: "text",
      required: true,
      filterable: true,
      editableOnCreate: true,
      editableOnUpdate: true,
    },
    {
      key: "name",
      header: "科目名",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "category",
      header: "区分",
      type: "select",
      options: CATEGORY_OPTIONS,
      required: true,
      filterable: true,
    },
    {
      key: "subcategory",
      header: "サブカテゴリ",
      type: "text",
      filterable: true,
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

  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: `${item.code} - ${item.name}`,
    subLabel: CATEGORY_OPTIONS.find((o) => o.value === item.category)?.label,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="勘定科目"
      onAdd={createAccount}
      onUpdate={updateAccount}
      emptyMessage="勘定科目が登録されていません"
      sortableItems={sortableItems}
      onReorder={async (ids) => {
        const result = await reorderAccounts(ids);
        if (!result.ok) throw new Error(result.error);
      }}
    />
  );
}
