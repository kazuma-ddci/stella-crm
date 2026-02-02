"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addContactMethod, updateContactMethod, deleteContactMethod, reorderContactMethods } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "連絡手段名", type: "text", required: true, simpleMode: true },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function ContactMethodsTable({ data }: Props) {
  // 並び替え用のアイテムリスト
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="連絡手段"
      onAdd={addContactMethod}
      onUpdate={updateContactMethod}
      onDelete={deleteContactMethod}
      emptyMessage="連絡手段が登録されていません"
      sortableItems={sortableItems}
      onReorder={reorderContactMethods}
    />
  );
}
