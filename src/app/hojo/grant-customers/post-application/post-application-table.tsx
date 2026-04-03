"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addPostApplication, updatePostApplication, deletePostApplication } from "./actions";
import { Eye } from "lucide-react";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  vendorOptions: { value: string; label: string }[];
};

export function PostApplicationTable({ data, canEdit, vendorOptions }: Props) {
  const router = useRouter();

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorId", header: "ベンダー", type: "select", options: vendorOptions, required: true, searchable: true, filterable: true },
    { key: "vendorName", header: "ベンダー名", editable: false, filterable: true },
    { key: "applicantName", header: "申請者名", type: "text", required: true, filterable: true },
    { key: "grantApplicationNumber", header: "交付申請番号", type: "text", filterable: true },
    { key: "subsidyStatus", header: "補助金ステータス", type: "text", filterable: true },
    { key: "applicationCompletedDate", header: "申請完了日", type: "date" },
    { key: "hasLoan", header: "貸付", type: "boolean" },
    { key: "completedDate", header: "完了日", type: "date" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="交付申請"
      onAdd={canEdit ? addPostApplication : undefined}
      onUpdate={canEdit ? updatePostApplication : undefined}
      onDelete={canEdit ? deletePostApplication : undefined}
      emptyMessage="交付申請データが登録されていません"
      customActions={[
        {
          icon: <Eye className="h-4 w-4" />,
          label: "詳細",
          onClick: (item) => {
            router.push(`/hojo/grant-customers/post-application/${item.id}`);
          },
        },
      ]}
    />
  );
}
