"use client";

import { CrudTable, ColumnDef, CustomRenderers, CustomFormFields } from "@/components/crud-table";
import { createCostCenter, updateCostCenter, deleteCostCenter } from "./actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type ProjectOption = {
  value: string;
  label: string;
};

type ProjectLabel = {
  id: number;
  label: string;
  isActive: boolean;
};

type Props = {
  data: (Record<string, unknown> & {
    projectLabels?: ProjectLabel[];
  })[];
  projectOptions: ProjectOption[];
};

export function CostCentersTable({ data, projectOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "name",
      header: "名称",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "projectIds",
      header: "CRMプロジェクト",
      type: "text", // customFormFields でオーバーライド
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
  ];

  const customRenderers: CustomRenderers = {
    projectIds: (_value, item) => {
      const labels = item?.projectLabels as ProjectLabel[] | undefined;
      if (!labels || labels.length === 0) return "（なし）";
      return labels
        .map((pl) => (pl.isActive ? pl.label : `${pl.label}（無効）`))
        .join(", ");
    },
  };

  const customFormFields: CustomFormFields = {
    projectIds: {
      render: (value, onChange) => {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        const handleToggle = (optionValue: string) => {
          if (selected.includes(optionValue)) {
            onChange(selected.filter((v) => v !== optionValue));
          } else {
            onChange([...selected, optionValue]);
          }
        };
        return (
          <div className="space-y-1">
            <Label className="text-sm font-medium">CRMプロジェクト</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
              {projectOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  有効なプロジェクトがありません
                </p>
              ) : (
                projectOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`project-${opt.value}`}
                      checked={selected.includes(opt.value)}
                      onCheckedChange={() => handleToggle(opt.value)}
                    />
                    <Label
                      htmlFor={`project-${opt.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      },
    },
  };

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="経理プロジェクト"
      onAdd={createCostCenter}
      onUpdate={updateCostCenter}
      onDelete={deleteCostCenter}
      emptyMessage="経理プロジェクトが登録されていません"
      customRenderers={customRenderers}
      customFormFields={customFormFields}
    />
  );
}
