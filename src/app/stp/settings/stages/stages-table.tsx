"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addStage, updateStage, deleteStage } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "ステージ名", type: "text", required: true },
  { key: "displayOrder", header: "表示順", type: "number" },
  { key: "isActive", header: "有効", type: "boolean" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false, hidden: true },
  { key: "updatedAt", header: "更新日", type: "datetime", editable: false, hidden: true },
];

export function StagesTable({ data, canEdit }: Props) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="ステージ"
      onAdd={canEdit ? addStage : undefined}
      onUpdate={canEdit ? updateStage : undefined}
      onDelete={canEdit ? deleteStage : undefined}
      emptyMessage="ステージが登録されていません"
    />
  );
}
