"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addCompany, updateCompany, deleteCompany } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false },
  { key: "companyCode", header: "企業コード", editable: false },
  { key: "name", header: "企業名", type: "text", required: true },
  { key: "contactPerson", header: "担当者名", type: "text" },
  { key: "email", header: "メールアドレス", type: "text" },
  { key: "phone", header: "電話番号", type: "text" },
  { key: "note", header: "メモ", type: "textarea" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false },
  { key: "updatedAt", header: "更新日", type: "datetime", editable: false },
];

export function CompaniesTable({ data }: Props) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="顧客"
      onAdd={addCompany}
      onUpdate={updateCompany}
      onDelete={deleteCompany}
      emptyMessage="顧客が登録されていません"
    />
  );
}
