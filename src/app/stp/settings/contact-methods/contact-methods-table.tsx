"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addContactMethod, updateContactMethod, deleteContactMethod } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false },
  { key: "name", header: "接触方法名", type: "text", required: true },
  { key: "displayOrder", header: "表示順", type: "number", required: true },
  { key: "isActive", header: "有効", type: "boolean" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false },
];

export function ContactMethodsTable({ data }: Props) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="接触方法"
      onAdd={addContactMethod}
      onUpdate={updateContactMethod}
      onDelete={deleteContactMethod}
      emptyMessage="接触方法が登録されていません"
    />
  );
}
