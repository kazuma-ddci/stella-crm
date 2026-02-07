"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addContractStatus, updateContractStatus, deleteContractStatus, reorderContractStatuses } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "ステータス名", type: "text", required: true, simpleMode: true },
  { key: "isTerminal", header: "終了フラグ", type: "boolean" },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function ContractStatusesTable({ data, canEdit }: Props) {
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="契約ステータス"
      onAdd={canEdit ? addContractStatus : undefined}
      onUpdate={canEdit ? updateContractStatus : undefined}
      onDelete={canEdit ? deleteContractStatus : undefined}
      emptyMessage="契約ステータスが登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderContractStatuses : undefined}
    />
  );
}
