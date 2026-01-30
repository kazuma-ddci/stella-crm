"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addAgent, updateAgent, deleteAgent } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false },
  { key: "agentCode", header: "代理店コード", editable: false },
  { key: "name", header: "代理店名", type: "text", required: true },
  { key: "contactPerson", header: "担当者名", type: "text" },
  { key: "email", header: "メールアドレス", type: "text" },
  { key: "phone", header: "電話番号", type: "text" },
  { key: "note", header: "メモ", type: "textarea" },
  { key: "isActive", header: "有効", type: "boolean" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false },
  { key: "updatedAt", header: "更新日", type: "datetime", editable: false },
];

export function AgentsTable({ data }: Props) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="代理店"
      onAdd={addAgent}
      onUpdate={updateAgent}
      onDelete={deleteAgent}
      emptyMessage="代理店が登録されていません"
    />
  );
}
