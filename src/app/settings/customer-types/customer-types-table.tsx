"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { updateCustomerType, reorderCustomerTypes } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  projectOptions: { value: string; label: string }[];
  canEdit: boolean;
  filterProjectId?: number;
};

export function CustomerTypesTable({ data, projectOptions, canEdit, filterProjectId }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "code", header: "システムコード", editable: false },
    {
      key: "projectId",
      header: "プロジェクト",
      type: "select",
      options: projectOptions,
      editable: false,
      simpleMode: true,
      hidden: !!filterProjectId,
    },
    { key: "projectName", header: "プロジェクト", editable: false, hidden: true },
    { key: "name", header: "表示名", type: "text", required: true, simpleMode: true },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  // プロジェクト名の表示用レンダラー
  const customRenderers: CustomRenderers = {
    projectId: (value, row) => {
      const option = projectOptions.find((opt) => opt.value === String(value));
      return option?.label || (row.projectName as string) || "-";
    },
  };

  // 並び替え用のアイテムリスト（プロジェクトでグループ化）
  const sortableItems: SortableItem[] = data.map((item) => {
    const projectOption = projectOptions.find((opt) => opt.value === String(item.projectId));
    return {
      id: item.id as number,
      label: item.name as string,
      groupKey: String(item.projectId),
      groupLabel: projectOption?.label || (item.projectName as string) || "不明",
    };
  });

  return (
    <CrudTable
      tableId="settings.customer-types"
      data={data}
      columns={columns}
      title="顧客種別"
      onUpdate={canEdit ? updateCustomerType : undefined}
      emptyMessage="顧客種別が登録されていません"
      customRenderers={customRenderers}
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderCustomerTypes : undefined}
      sortableGrouped={true}
    />
  );
}
