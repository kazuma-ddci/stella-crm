"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomFormFields, CustomRenderers } from "@/components/crud-table";
import { createCostCenter, updateCostCenter } from "./actions";
import { ProjectBankAccountsModal } from "@/app/settings/projects/project-bank-accounts-modal";
import { CostCenterBankAccountsModal } from "./cost-center-bank-accounts-modal";
import { Landmark } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectOption = {
  value: string;
  label: string;
};

type Props = {
  data: Record<string, unknown>[];
  projectOptions: ProjectOption[];
  operatingCompanyOptions: ProjectOption[];
  canEdit: boolean;
};

type DisplayItem = { isDefault: boolean; label?: string };

export function CostCentersTable({
  data,
  projectOptions,
  operatingCompanyOptions,
  canEdit,
}: Props) {
  const [projectBankAccountsModal, setProjectBankAccountsModal] = useState<{
    open: boolean;
    projectId: number;
    projectName: string;
  }>({ open: false, projectId: 0, projectName: "" });
  const [costCenterBankAccountsModal, setCostCenterBankAccountsModal] = useState<{
    open: boolean;
    costCenterId: number;
    costCenterName: string;
  }>({ open: false, costCenterId: 0, costCenterName: "" });

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
      key: "operatingCompanyId",
      header: "運営法人",
      type: "select",
      options: [{ value: "", label: "（未設定）" }, ...operatingCompanyOptions],
      searchable: true,
    },
    { key: "bankAccounts", header: "銀行口座", editable: false, filterable: false },
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
    operatingCompanyId: (_value, item) => {
      const label = item?.effectiveOperatingCompanyLabel as string | undefined;
      return label || "（未設定）";
    },
    bankAccounts: (_value, item) => {
      const accounts = (item?.bankAccounts as DisplayItem[]) || [];
      if (accounts.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="space-y-1 py-1">
          {accounts.map((account, index) => (
            <div key={index} className={`text-sm ${account.isDefault ? "font-bold" : ""}`}>
              {account.label}
            </div>
          ))}
        </div>
      );
    },
  };

  const customFormFields: CustomFormFields = {
    operatingCompanyId: {
      render: (value, onChange, formData) => {
        const projectId = formData.projectId ? String(formData.projectId) : "";
        if (projectId) {
          const project = data.find((row) => String(row.projectId) === projectId);
          return (
            <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {project?.effectiveOperatingCompanyLabel as string | undefined || "CRMプロジェクト側の運営法人を使用します"}
            </div>
          );
        }

        return (
          <Select
            value={value ? String(value) : "__none__"}
            onValueChange={(nextValue) => onChange(nextValue === "__none__" ? "" : nextValue)}
          >
            <SelectTrigger>
              <SelectValue placeholder="運営法人を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">（未設定）</SelectItem>
              {operatingCompanyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
  };

  const customActions = canEdit
    ? [
        {
          label: "口座管理",
          icon: <Landmark className="h-4 w-4" />,
          onClick: (row: Record<string, unknown>) => {
            if (row.hasCrmProject) {
              setProjectBankAccountsModal({
                open: true,
                projectId: Number(row.projectId),
                projectName: row.projectLabel as string,
              });
            } else {
              setCostCenterBankAccountsModal({
                open: true,
                costCenterId: row.id as number,
                costCenterName: row.name as string,
              });
            }
          },
        },
      ]
    : [];

  return (
    <>
      <CrudTable
        tableId="accounting.cost-centers"
        data={data}
        columns={columns}
        title="按分先"
        onAdd={canEdit ? createCostCenter : undefined}
        onUpdate={canEdit ? updateCostCenter : undefined}
        emptyMessage="按分先が登録されていません"
        customActions={customActions}
        customRenderers={customRenderers}
        customFormFields={customFormFields}
      />
      <ProjectBankAccountsModal
        open={projectBankAccountsModal.open}
        onOpenChange={(open) => setProjectBankAccountsModal((prev) => ({ ...prev, open }))}
        projectId={projectBankAccountsModal.projectId}
        projectName={projectBankAccountsModal.projectName}
      />
      <CostCenterBankAccountsModal
        open={costCenterBankAccountsModal.open}
        onOpenChange={(open) => setCostCenterBankAccountsModal((prev) => ({ ...prev, open }))}
        costCenterId={costCenterBankAccountsModal.costCenterId}
        costCenterName={costCenterBankAccountsModal.costCenterName}
      />
    </>
  );
}
