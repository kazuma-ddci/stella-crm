"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { Mail, Landmark } from "lucide-react";
import { updateProject, reorderProjects } from "./actions";
import { ProjectEmailsModal } from "./project-emails-modal";
import { ProjectBankAccountsModal } from "./project-bank-accounts-modal";

type Props = {
  data: Record<string, unknown>[];
  operatingCompanyOptions: { value: string; label: string }[];
  canEdit: boolean;
  isSystemAdmin: boolean;
};

export function ProjectsTable({
  data,
  operatingCompanyOptions,
  canEdit,
  isSystemAdmin,
}: Props) {
  const [emailsModal, setEmailsModal] = useState<{
    open: boolean;
    projectId: number;
    projectName: string;
  }>({ open: false, projectId: 0, projectName: "" });
  const [bankAccountsModal, setBankAccountsModal] = useState<{
    open: boolean;
    projectId: number;
    projectName: string;
  }>({ open: false, projectId: 0, projectName: "" });

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "code", header: "コード", type: "text", editable: false },
    { key: "name", header: "プロジェクト名", type: "text", required: true, simpleMode: true },
    { key: "description", header: "説明", type: "textarea" },
    {
      key: "operatingCompanyId",
      header: "運営法人",
      type: "select",
      options: operatingCompanyOptions,
      searchable: true,
    },
    { key: "emails", header: "メール", editable: false, filterable: false },
    { key: "bankAccounts", header: "銀行口座", editable: false, filterable: false },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  type DisplayItem = { isDefault: boolean; email?: string; label?: string };

  const customRenderers: CustomRenderers = {
    emails: (_value: unknown, row: Record<string, unknown>) => {
      const items = (row.emails as DisplayItem[]) || [];
      if (items.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="space-y-1 py-1">
          {items.map((item, i) => (
            <div key={i} className={`text-sm ${item.isDefault ? "font-bold" : ""}`}>
              {item.email}
            </div>
          ))}
        </div>
      );
    },
    bankAccounts: (_value: unknown, row: Record<string, unknown>) => {
      const items = (row.bankAccounts as DisplayItem[]) || [];
      if (items.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="space-y-1 py-1">
          {items.map((item, i) => (
            <div key={i} className={`text-sm ${item.isDefault ? "font-bold" : ""}`}>
              {item.label}
            </div>
          ))}
        </div>
      );
    },
  };

  // 並び替え用のアイテムリスト
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
    subLabel: item.description as string | undefined,
  }));

  const customActions = [
    {
      label: "メール管理",
      icon: <Mail className="h-4 w-4" />,
      onClick: (row: Record<string, unknown>) => {
        setEmailsModal({
          open: true,
          projectId: row.id as number,
          projectName: row.name as string,
        });
      },
    },
    {
      label: "口座管理",
      icon: <Landmark className="h-4 w-4" />,
      onClick: (row: Record<string, unknown>) => {
        setBankAccountsModal({
          open: true,
          projectId: row.id as number,
          projectName: row.name as string,
        });
      },
    },
  ];

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="プロジェクト"
        onUpdate={canEdit ? updateProject : undefined}
        emptyMessage="プロジェクトが登録されていません"
        sortableItems={canEdit ? sortableItems : undefined}
        onReorder={canEdit ? reorderProjects : undefined}
        customActions={customActions}
        customRenderers={customRenderers}
      />
      <ProjectEmailsModal
        open={emailsModal.open}
        onOpenChange={(open) => setEmailsModal((prev) => ({ ...prev, open }))}
        projectId={emailsModal.projectId}
        projectName={emailsModal.projectName}
        isSystemAdmin={isSystemAdmin}
      />
      <ProjectBankAccountsModal
        open={bankAccountsModal.open}
        onOpenChange={(open) => setBankAccountsModal((prev) => ({ ...prev, open }))}
        projectId={bankAccountsModal.projectId}
        projectName={bankAccountsModal.projectName}
      />
    </>
  );
}
