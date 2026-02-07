"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addLeadSource, updateLeadSource, deleteLeadSource, reorderLeadSources } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "流入経路名", type: "text", required: true, simpleMode: true },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function LeadSourcesTable({ data, canEdit }: Props) {
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="流入経路"
      onAdd={canEdit ? addLeadSource : undefined}
      onUpdate={canEdit ? updateLeadSource : undefined}
      onDelete={canEdit ? deleteLeadSource : undefined}
      emptyMessage="流入経路が登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderLeadSources : undefined}
    />
  );
}
