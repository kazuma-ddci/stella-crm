"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addContactMethod, updateContactMethod, deleteContactMethod, reorderContactMethods } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "接触方法名", type: "text", required: true, simpleMode: true },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function ContactMethodsTable({ data, canEdit }: Props) {
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="接触方法"
      onAdd={canEdit ? addContactMethod : undefined}
      onUpdate={canEdit ? updateContactMethod : undefined}
      onDelete={canEdit ? deleteContactMethod : undefined}
      emptyMessage="接触方法が登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderContactMethods : undefined}
    />
  );
}
