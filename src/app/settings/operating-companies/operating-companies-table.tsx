"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import {
  addOperatingCompany,
  updateOperatingCompany,
  deleteOperatingCompany,
} from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "companyName", header: "法人名", type: "text", required: true, simpleMode: true },
  { key: "registrationNumber", header: "登録番号(T+13桁)", type: "text" },
  { key: "representativeName", header: "代表者名", type: "text" },
  { key: "phone", header: "電話番号", type: "text" },
  { key: "postalCode", header: "郵便番号", type: "text" },
  { key: "address", header: "住所", type: "text" },
  { key: "bankInfo", header: "振込先情報", type: "textarea" },
];

export function OperatingCompaniesTable({ data, canEdit }: Props) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="運営法人"
      onAdd={canEdit ? addOperatingCompany : undefined}
      onUpdate={canEdit ? updateOperatingCompany : undefined}
      onDelete={canEdit ? deleteOperatingCompany : undefined}
      emptyMessage="運営法人が登録されていません"
    />
  );
}
