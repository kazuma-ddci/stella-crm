"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomAction, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addContractType, updateContractType, deleteContractType, reorderContractTypes } from "./actions";
import { TemplateLinkModal } from "./template-link-modal";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  data: Record<string, unknown>[];
  projectOptions: { value: string; label: string }[];
  canEdit: boolean;
  filterProjectId?: number;
};

export function ContractTypesTable({ data, projectOptions, canEdit, filterProjectId }: Props) {
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedContractType, setSelectedContractType] = useState<{
    id: number;
    name: string;
  } | null>(null);

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
    { key: "templateCount", header: "テンプレート", editable: false },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  // プロジェクト名の表示用レンダラー
  const customRenderers: CustomRenderers = {
    projectId: (value, row) => {
      const option = projectOptions.find((opt) => opt.value === String(value));
      return option?.label || (row.projectName as string) || "-";
    },
    templateCount: (_value, row) => {
      const count = row.templateCount as number;
      const names = row.templateNames as string;
      if (count === 0) {
        return <span className="text-gray-400 text-xs">未設定</span>;
      }
      return (
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs">
            {count}件
          </Badge>
          {names && (
            <span className="text-xs text-gray-500 truncate max-w-[150px]" title={names}>
              {names}
            </span>
          )}
        </div>
      );
    },
  };

  const customActions: CustomAction[] = [
    {
      icon: <FileText className="h-4 w-4" />,
      label: "テンプレート管理",
      onClick: (item) => {
        setSelectedContractType({
          id: item.id as number,
          name: item.name as string,
        });
        setTemplateModalOpen(true);
      },
    },
  ];

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
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="契約種別"
        onAdd={canEdit ? addContractType : undefined}
        onUpdate={canEdit ? updateContractType : undefined}
        onDelete={canEdit ? deleteContractType : undefined}
        emptyMessage="契約種別が登録されていません"
        customRenderers={customRenderers}
        customActions={customActions}
        sortableItems={canEdit ? sortableItems : undefined}
        onReorder={
          canEdit
            ? async (ids) => {
                const result = await reorderContractTypes(ids);
                if (!result.ok) throw new Error(result.error);
              }
            : undefined
        }
        sortableGrouped={true}
      />

      {selectedContractType && (
        <TemplateLinkModal
          open={templateModalOpen}
          onOpenChange={setTemplateModalOpen}
          contractTypeId={selectedContractType.id}
          contractTypeName={selectedContractType.name}
          canEdit={canEdit}
        />
      )}
    </>
  );
}
