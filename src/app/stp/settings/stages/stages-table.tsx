"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addStage, updateStage, deleteStage } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false },
  { key: "name", header: "ステージ名", type: "text", required: true },
  { key: "displayOrder", header: "表示順", type: "number", required: true },
  { key: "isActive", header: "有効", type: "boolean" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false },
  { key: "updatedAt", header: "更新日", type: "datetime", editable: false },
];

export function StagesTable({ data }: Props) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="ステージ"
      onAdd={addStage}
      onUpdate={updateStage}
      onDelete={deleteStage}
      emptyMessage="ステージが登録されていません"
    />
  );
}
