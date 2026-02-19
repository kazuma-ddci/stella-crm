"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addRoleType, updateRoleType, deleteRoleType, reorderRoleTypes } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  projectOptions: { value: string; label: string }[];
};

export function RoleTypesTable({ data, canEdit, projectOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "code", header: "コード", editable: false, hidden: true },
    { key: "name", header: "役割名", type: "text", required: true, simpleMode: true },
    { key: "description", header: "説明", type: "textarea" },
    { key: "projectIds", header: "プロジェクト（選択）", type: "multiselect", options: projectOptions, hidden: true },
    { key: "projectNames", header: "プロジェクト", editable: false, filterable: true },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  // 並び替え用のアイテムリスト
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: `${item.name} (${item.code})`,
    subLabel: item.description as string | undefined,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="役割種別"
      onAdd={canEdit ? addRoleType : undefined}
      onUpdate={canEdit ? updateRoleType : undefined}
      onDelete={canEdit ? deleteRoleType : undefined}
      emptyMessage="役割種別が登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderRoleTypes : undefined}
    />
  );
}
