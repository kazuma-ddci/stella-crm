"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addProject, updateProject, deleteProject, reorderProjects } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  operatingCompanyOptions: { value: string; label: string }[];
  canEdit: boolean;
};

export function ProjectsTable({ data, operatingCompanyOptions, canEdit }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "code", header: "コード", type: "text", required: true, simpleMode: true },
    { key: "name", header: "プロジェクト名", type: "text", required: true, simpleMode: true },
    { key: "description", header: "説明", type: "textarea" },
    { key: "isActive", header: "有効", type: "boolean" },
    {
      key: "operatingCompanyId",
      header: "運営法人",
      type: "select",
      options: operatingCompanyOptions,
      searchable: true,
    },
  ];

  // 並び替え用のアイテムリスト
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
    subLabel: item.description as string | undefined,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="プロジェクト"
      onAdd={canEdit ? addProject : undefined}
      onUpdate={canEdit ? updateProject : undefined}
      onDelete={canEdit ? deleteProject : undefined}
      emptyMessage="プロジェクトが登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderProjects : undefined}
    />
  );
}
