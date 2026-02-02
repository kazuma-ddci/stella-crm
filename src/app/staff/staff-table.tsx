"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addStaff, updateStaff, deleteStaff } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  roleTypeOptions: { value: string; label: string }[];
  projectOptions: { value: string; label: string }[];
};

const CONTRACT_TYPES = [
  { value: "正社員", label: "正社員" },
  { value: "契約社員", label: "契約社員" },
  { value: "業務委託", label: "業務委託" },
  { value: "パート", label: "パート" },
  { value: "アルバイト", label: "アルバイト" },
];

export function StaffTable({ data, roleTypeOptions, projectOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "name", header: "名前", type: "text", required: true, simpleMode: true },
    { key: "nameKana", header: "フリガナ", type: "text" },
    { key: "email", header: "メールアドレス", type: "text", simpleMode: true },
    { key: "phone", header: "電話番号", type: "text" },
    { key: "contractType", header: "契約形態", type: "select", options: CONTRACT_TYPES },
    // プロジェクト（複数選択）
    { key: "projectIds", header: "プロジェクト（選択）", type: "multiselect", options: projectOptions, simpleMode: true, hidden: true },
    { key: "projectNames", header: "プロジェクト", editable: false, filterable: true },
    // 役割（複数選択）
    { key: "roleTypeIds", header: "役割（選択）", type: "multiselect", options: roleTypeOptions, simpleMode: true, hidden: true },
    { key: "roleTypeNames", header: "役割", editable: false, filterable: true },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="スタッフ"
      onAdd={addStaff}
      onUpdate={updateStaff}
      onDelete={deleteStaff}
      emptyMessage="スタッフが登録されていません"
    />
  );
}
