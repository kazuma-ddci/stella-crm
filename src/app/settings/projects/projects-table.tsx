"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addProject, updateProject, deleteProject, reorderProjects } from "./actions";

type Props = {
  data: Record<string, unknown>[];
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "プロジェクト名", type: "text", required: true, simpleMode: true },
  { key: "description", header: "説明", type: "textarea" },
  { key: "isActive", header: "有効", type: "boolean" },
];

export function ProjectsTable({ data }: Props) {
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
      onAdd={addProject}
      onUpdate={updateProject}
      onDelete={deleteProject}
      emptyMessage="プロジェクトが登録されていません"
      sortableItems={sortableItems}
      onReorder={reorderProjects}
    />
  );
}
