"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addCompanyContact, updateCompanyContact, deleteCompanyContact } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  stpCompanyOptions: { value: string; label: string }[];
  contactMethodOptions: { value: string; label: string }[];
};

export function CompanyContactsTable({ data, stpCompanyOptions, contactMethodOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false },
    { key: "stpCompanyId", header: "企業", type: "select", options: stpCompanyOptions, required: true },
    { key: "companyName", header: "企業名", editable: false },
    { key: "contactDate", header: "接触日時", type: "datetime", required: true },
    { key: "contactMethodId", header: "接触方法", type: "select", options: contactMethodOptions },
    { key: "contactMethodName", header: "接触方法名", editable: false },
    { key: "assignedTo", header: "担当者", type: "text" },
    { key: "meetingMinutes", header: "議事録", type: "textarea" },
    { key: "note", header: "備考", type: "textarea" },
    { key: "createdAt", header: "作成日", type: "datetime", editable: false },
    { key: "updatedAt", header: "更新日", type: "datetime", editable: false },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="企業接触履歴"
      onAdd={addCompanyContact}
      onUpdate={updateCompanyContact}
      onDelete={deleteCompanyContact}
      emptyMessage="接触履歴がありません"
    />
  );
}
