"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers, CustomAction } from "@/components/crud-table";
import { updateWholesaleAccount, deleteWholesaleAccount, restoreWholesaleAccount } from "./actions";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const INVOICE_STATUS_OPTIONS = [
  { value: "請求書送付済み", label: "請求書送付済み" },
  { value: "着金確認中", label: "着金確認中" },
  { value: "着金確認済み", label: "着金確認済み" },
];

type Props = { data: Record<string, unknown>[] };

export function AccountsTable({ data }: Props) {
  const router = useRouter();

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "rowNo", header: "No.", editable: false, width: 1, cellClassName: "text-center" },
    { key: "vendorName", header: "紹介元ベンダー", editable: false, filterable: true },
    { key: "vendorNo", header: "ベンダーNo.", editable: false, width: 1 },
    { key: "supportProviderName", header: "支援事業者名", editable: false, filterable: true },
    { key: "companyName", header: "会社名(補助事業社、納品先）", editable: false, filterable: true },
    { key: "email", header: "メールアドレス(アカウント)", editable: false, filterable: true },
    { key: "softwareSalesContractUrl", header: "ソフトウェア販売契約書", editable: false },
    { key: "recruitmentRound", header: "募集回", editable: false },
    { key: "adoptionDate", header: "採択日", editable: false },
    { key: "issueRequestDate", header: "発行依頼日", editable: false },
    { key: "accountApprovalDate", header: "アカウント承認日", type: "date", inlineEditable: true },
    { key: "grantDate", header: "交付日", editable: false },
    { key: "toolCost", header: "ツール代(税別)万円", type: "number", inlineEditable: true },
    { key: "invoiceStatus", header: "請求入金状況", type: "select", options: INVOICE_STATUS_OPTIONS, inlineEditable: true, filterable: true },
  ];

  const customRenderers: CustomRenderers = {
    softwareSalesContractUrl: (value) => {
      if (!value) return "-";
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          リンク
        </a>
      );
    },
    toolCost: (value) => {
      if (value == null || value === "") return "-";
      return `${value}万円`;
    },
    vendorName: (value, row) => {
      const name = String(value || "-");
      if (row.deletedByVendor) {
        return (
          <div className="flex items-center gap-1">
            <span>{name}</span>
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-300 text-xs whitespace-nowrap">
              <AlertTriangle className="h-3 w-3 mr-1" />ベンダー削除
            </Badge>
          </div>
        );
      }
      return name;
    },
  };

  const customActions: CustomAction[] = [
    {
      icon: <RotateCcw className="h-4 w-4" />,
      label: "復元（ベンダー削除を取消）",
      onClick: async (item) => {
        try {
          await restoreWholesaleAccount(item.id as number);
          router.refresh();
          toast.success("復元しました");
        } catch {
          toast.error("復元に失敗しました");
        }
      },
    },
  ];

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    await updateWholesaleAccount(id, formData);
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteWholesaleAccount(id);
    router.refresh();
  };

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="アカウント管理"
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      emptyMessage="アカウントデータが登録されていません"
      customRenderers={customRenderers}
      customActions={customActions}
      enableInlineEdit
      skipInlineConfirm
      rowClassName={(item) => item.deletedByVendor ? "!bg-red-50" : undefined}
    />
  );
}
