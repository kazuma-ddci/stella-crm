"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addPreApplication, updatePreApplication, deletePreApplication } from "./actions";
import { Eye } from "lucide-react";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  vendorOptions: { value: string; label: string }[];
  onAddOverride?: (data: Record<string, unknown>) => Promise<void>;
  onUpdateOverride?: (id: number, data: Record<string, unknown>) => Promise<void>;
  onDeleteOverride?: (id: number) => Promise<void>;
};

export function PreApplicationTable({ data, canEdit, vendorOptions, onAddOverride, onUpdateOverride, onDeleteOverride }: Props) {
  const router = useRouter();

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorId", header: "ベンダー", type: "select", options: vendorOptions, required: true, searchable: true, filterable: true },
    { key: "vendorName", header: "ベンダー名", editable: false, filterable: true },
    { key: "applicantName", header: "申請者名", type: "text", required: true, filterable: true },
    { key: "status", header: "ステータス", type: "text", filterable: true },
    { key: "category", header: "カテゴリ", type: "text" },
    { key: "prospectLevel", header: "見込度", type: "text" },
    { key: "nextContactDate", header: "次回連絡日", type: "date" },
    { key: "businessName", header: "事業名", type: "text" },
    { key: "salesStaff", header: "営業担当", type: "text" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="概要案内"
      onAdd={canEdit ? (onAddOverride ?? addPreApplication) : undefined}
      onUpdate={canEdit ? (onUpdateOverride ?? updatePreApplication) : undefined}
      onDelete={canEdit ? (onDeleteOverride ?? deletePreApplication) : undefined}
      emptyMessage="概要案内データが登録されていません"
      customActions={[
        {
          icon: <Eye className="h-4 w-4" />,
          label: "詳細",
          onClick: (item) => {
            router.push(`/hojo/grant-customers/pre-application/${item.id}`);
          },
        },
      ]}
    />
  );
}
