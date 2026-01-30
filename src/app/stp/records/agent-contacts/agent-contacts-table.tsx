"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addAgentContact, updateAgentContact, deleteAgentContact } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  agentOptions: { value: string; label: string }[];
  contactMethodOptions: { value: string; label: string }[];
};

export function AgentContactsTable({ data, agentOptions, contactMethodOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false },
    { key: "agentId", header: "代理店", type: "select", options: agentOptions, required: true },
    { key: "agentName", header: "代理店名", editable: false },
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
      title="代理店接触履歴"
      onAdd={addAgentContact}
      onUpdate={updateAgentContact}
      onDelete={deleteAgentContact}
      emptyMessage="接触履歴がありません"
    />
  );
}
