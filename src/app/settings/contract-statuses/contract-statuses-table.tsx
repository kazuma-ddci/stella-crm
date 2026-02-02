"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addContractStatus, updateContractStatus, deleteContractStatus, reorderContractStatuses } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "displayOrder", header: "ステージ順", type: "number", editable: false },
  { key: "name", header: "ステータス名", type: "text", required: true, simpleMode: true },
  { key: "isTerminal", header: "終了フラグ", type: "boolean", hidden: true },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function ContractStatusesTable({ data }: Props) {
  // 並び替え用のアイテムリスト
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="契約書ステータス"
      onAdd={addContractStatus}
      onUpdate={updateContractStatus}
      onDelete={deleteContractStatus}
      emptyMessage="契約書ステータスが登録されていません"
      sortableItems={sortableItems}
      onReorder={reorderContractStatuses}
    />
  );
}
