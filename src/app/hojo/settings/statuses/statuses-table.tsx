"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addStatus, updateStatus, deleteStatus, reorderStatuses } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

export function StatusesTable({ data, canEdit }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "name", header: "ステータス名", type: "text", required: true, simpleMode: true },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="ステータス"
      onAdd={canEdit ? addStatus : undefined}
      onUpdate={canEdit ? updateStatus : undefined}
      onDelete={canEdit ? deleteStatus : undefined}
      emptyMessage="ステータスが登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderStatuses : undefined}
    />
  );
}
