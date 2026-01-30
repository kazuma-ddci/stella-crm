"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addStpCompany, updateStpCompany, deleteStpCompany } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  companyOptions: { value: string; label: string }[];
  stageOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
};

export function StpCompaniesTable({ data, companyOptions, stageOptions, agentOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false },
    { key: "companyId", header: "企業ID", type: "select", options: companyOptions, required: true },
    { key: "companyName", header: "企業名", editable: false },
    { key: "note", header: "企業メモ", type: "textarea" },
    { key: "leadAcquiredDate", header: "リード獲得日", type: "date" },
    { key: "meetingDate", header: "商談日", type: "date" },
    { key: "currentStageId", header: "現在ステージ", type: "select", options: stageOptions },
    { key: "currentStageName", header: "現在ステージ名", editable: false },
    { key: "nextTargetStageId", header: "ネクストステージ", type: "select", options: stageOptions },
    { key: "nextTargetStageName", header: "ネクストステージ名", editable: false },
    { key: "nextTargetDate", header: "次回商談日", type: "date" },
    { key: "agentId", header: "代理店", type: "select", options: agentOptions },
    { key: "agentName", header: "代理店名", editable: false },
    { key: "assignedTo", header: "担当者", type: "text" },
    { key: "priority", header: "優先度", type: "select", options: [
      { value: "高", label: "高" },
      { value: "中", label: "中" },
      { value: "低", label: "低" },
    ]},
    { key: "createdAt", header: "作成日", type: "datetime", editable: false },
    { key: "updatedAt", header: "更新日", type: "datetime", editable: false },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="STP企業"
      onAdd={addStpCompany}
      onUpdate={updateStpCompany}
      onDelete={deleteStpCompany}
      emptyMessage="企業が登録されていません"
    />
  );
}
