"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrudTable, type ColumnDef, type CustomAction, type CustomRenderers } from "@/components/crud-table";
import { InlineCell } from "@/components/inline-cell";
import { Eye } from "lucide-react";
import { updateLoanStaffMemo } from "./actions";

type RowData = {
  id: number;
  formType: string;
  companyName: string;
  representName: string;
  email: string;
  phone: string;
  vendorName: string;
  submittedAt: string;
  vendorMemo: string;
  lenderMemo: string;
  staffMemo: string;
};

function SubmissionTable({
  data,
  vendorOptions,
  canEdit,
  tableId,
}: {
  data: RowData[];
  vendorOptions: { value: string; label: string }[];
  canEdit: boolean;
  tableId: string;
}) {
  const router = useRouter();

  const handleStaffMemoSave = async (id: number, value: string) => {
    const result = await updateLoanStaffMemo(id, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorName", header: "ベンダー", type: "select", options: vendorOptions, editable: false, filterable: true },
    { key: "companyName", header: "会社名/屋号", type: "text", editable: false, filterable: true },
    { key: "representName", header: "代表者/氏名", type: "text", editable: false, filterable: true },
    { key: "email", header: "メール", type: "text", editable: false, filterable: true },
    { key: "phone", header: "電話番号", type: "text", editable: false, filterable: true },
    { key: "submittedAt", header: "回答日時", type: "datetime", editable: false, filterable: true },
    { key: "vendorMemo", header: "ベンダー備考", type: "textarea", editable: false, filterable: true },
    { key: "lenderMemo", header: "貸金業社備考", type: "textarea", editable: false, filterable: true },
    { key: "staffMemo", header: "弊社備考", type: "textarea", editable: false, filterable: true },
  ];

  const customRenderers: CustomRenderers = {
    submittedAt: (value) => {
      if (!value) return "-";
      return new Date(String(value)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    },
    vendorMemo: (value) => (
      <span className="truncate block max-w-[180px]">{value ? String(value) : "-"}</span>
    ),
    lenderMemo: (value) => (
      <span className="truncate block max-w-[180px]">{value ? String(value) : "-"}</span>
    ),
    staffMemo: (value, row) => {
      const id = row.id as number;
      const staffMemo = (row.staffMemo as string) ?? "";
      if (!canEdit) {
        return <span className="truncate block max-w-[200px]">{staffMemo || "-"}</span>;
      }
      return (
        <InlineCell
          value={staffMemo}
          onSave={(v) => handleStaffMemoSave(id, v)}
          type="textarea"
        >
          <span className="truncate block max-w-[200px]">{staffMemo || "-"}</span>
        </InlineCell>
      );
    },
    vendorName: (value) => {
      const s = value ? String(value) : "";
      return <span className="whitespace-nowrap text-sm">{s || "（不明）"}</span>;
    },
  };

  const customActions: CustomAction[] = [
    {
      icon: <Eye className="h-4 w-4" />,
      label: "詳細",
      onClick: (item) => router.push(`/hojo/loan-submissions/${item.id}`),
    },
  ];

  return (
    <CrudTable
      tableId={tableId}
      data={data as unknown as Record<string, unknown>[]}
      columns={columns}
      emptyMessage="フォーム回答がまだありません"
      customRenderers={customRenderers}
      customActions={customActions}
    />
  );
}

export function LoanSubmissionsClient({
  corporateData,
  individualData,
  vendors,
  canEdit,
}: {
  corporateData: RowData[];
  individualData: RowData[];
  vendors: { id: number; name: string }[];
  canEdit: boolean;
}) {
  const vendorOptions = vendors.map((v) => ({ value: v.name, label: v.name }));

  return (
    <div className="space-y-4">
      <Tabs defaultValue="corporate">
        <TabsList>
          <TabsTrigger value="corporate">
            法人 ({corporateData.length})
          </TabsTrigger>
          <TabsTrigger value="individual">
            個人事業主 ({individualData.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="corporate" className="mt-4">
          <SubmissionTable data={corporateData} vendorOptions={vendorOptions} canEdit={canEdit} tableId="hojo.loan-submissions.corporate" />
        </TabsContent>
        <TabsContent value="individual" className="mt-4">
          <SubmissionTable data={individualData} vendorOptions={vendorOptions} canEdit={canEdit} tableId="hojo.loan-submissions.individual" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
