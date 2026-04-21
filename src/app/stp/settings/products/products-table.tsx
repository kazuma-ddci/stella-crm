"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import {
  addStpProduct,
  updateStpProduct,
  deleteStpProduct,
  reorderStpProducts,
} from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "商材名", type: "text", required: true, simpleMode: true },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function ProductsTable({ data, canEdit }: Props) {
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      tableId="stp.settings.products"
      data={data}
      columns={columns}
      title="商材"
      onAdd={canEdit ? addStpProduct : undefined}
      onUpdate={canEdit ? updateStpProduct : undefined}
      onDelete={canEdit ? deleteStpProduct : undefined}
      emptyMessage="商材が登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderStpProducts : undefined}
    />
  );
}
