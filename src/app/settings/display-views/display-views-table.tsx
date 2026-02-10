"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addDisplayView, updateDisplayView, deleteDisplayView } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  projectOptions: { value: string; label: string }[];
};

export function DisplayViewsTable({ data, canEdit, projectOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "viewKey", header: "ビューキー", type: "text", editable: false, hidden: true },
    { key: "viewName", header: "表示名", type: "text", required: true, simpleMode: true },
    { key: "projectId", header: "プロジェクト", type: "select", options: projectOptions, required: true },
    { key: "description", header: "説明", type: "text" },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="表示区分"
      onAdd={canEdit ? addDisplayView : undefined}
      onUpdate={canEdit ? updateDisplayView : undefined}
      onDelete={canEdit ? deleteDisplayView : undefined}
      emptyMessage="表示区分が登録されていません"
    />
  );
}
