"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { createCostCenter, updateCostCenter } from "./actions";

type ProjectOption = {
  value: string;
  label: string;
};

type Props = {
  data: Record<string, unknown>[];
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
      key: "projectId",
      header: "CRMプロジェクト",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...projectOptions],
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
  ];

  const customRenderers: CustomRenderers = {
    projectId: (value, item) => {
      if (!value) return "（なし）";
      const option = projectOptions.find((o) => o.value === String(value));
      if (option) return option.label;
      const label = item?.projectLabel as string | undefined;
      return label ? `${label}（無効）` : "（なし）";
    },
  };

  return (
    <CrudTable
      tableId="accounting.cost-centers"
      data={data}
      columns={columns}
      title="按分先"
      onAdd={createCostCenter}
      onUpdate={updateCostCenter}
      emptyMessage="按分先が登録されていません"
      customRenderers={customRenderers}
    />
  );
}
