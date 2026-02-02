"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addRoleType, updateRoleType, deleteRoleType, reorderRoleTypes } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "code", header: "コード", type: "text", required: true, simpleMode: true },
  { key: "name", header: "役割名", type: "text", required: true, simpleMode: true },
  { key: "description", header: "説明", type: "textarea" },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function RoleTypesTable({ data }: Props) {
  // 並び替え用のアイテムリスト
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: `${item.name} (${item.code})`,
    subLabel: item.description as string | undefined,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="役割種別"
      onAdd={addRoleType}
      onUpdate={updateRoleType}
      onDelete={deleteRoleType}
      emptyMessage="役割種別が登録されていません"
      sortableItems={sortableItems}
      onReorder={reorderRoleTypes}
    />
  );
}
