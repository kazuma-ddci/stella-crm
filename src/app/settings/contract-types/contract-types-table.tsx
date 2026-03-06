"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addContractType, updateContractType, deleteContractType, reorderContractTypes } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  projectOptions: { value: string; label: string }[];
  canEdit: boolean;
  filterProjectId?: number;
};

export function ContractTypesTable({ data, projectOptions, canEdit, filterProjectId }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "projectId",
      header: "プロジェクト",
      type: "select",
      options: projectOptions,
      required: true,
      simpleMode: true,
      hidden: !!filterProjectId,
      defaultValue: filterProjectId ? String(filterProjectId) : undefined,
    },
    { key: "projectName", header: "プロジェクト", editable: false, hidden: true },
    { key: "name", header: "契約種別名", type: "text", required: true, simpleMode: true },
    { key: "description", header: "説明", type: "text" },
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
      data={data}
      columns={columns}
      title="契約種別"
      onAdd={canEdit ? addContractType : undefined}
      onUpdate={canEdit ? updateContractType : undefined}
      onDelete={canEdit ? deleteContractType : undefined}
      emptyMessage="契約種別が登録されていません"
      customRenderers={customRenderers}
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderContractTypes : undefined}
      sortableGrouped={true}
    />
  );
}
