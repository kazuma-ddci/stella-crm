"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers, CustomAction } from "@/components/crud-table";
import { updateWholesaleAccount, deleteWholesaleAccount, restoreWholesaleAccount } from "./actions";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const USAGE_OPTIONS = [
  { value: "有", label: "有" },
  { value: "無", label: "無" },
];

const APPLICANT_TYPE_OPTIONS = [
  { value: "法人", label: "法人" },
  { value: "個人事業主", label: "個人事業主" },
];

type Props = { data: Record<string, unknown>[] };

export function AccountsTable({ data }: Props) {
  const router = useRouter();

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "rowNo", header: "No.", editable: false, width: 1, cellClassName: "text-center" },
    { key: "vendorName", header: "ベンダー", editable: false, filterable: true },
    { key: "companyName", header: "会社名(補助事業社、納品先）", editable: false, filterable: true },
    { key: "applicantType", header: "法人/個人", type: "select", options: APPLICANT_TYPE_OPTIONS, editable: false, filterable: true },
    { key: "email", header: "メールアドレス(アカウント)", editable: false, filterable: true },
    { key: "softwareSalesContractUrl", header: "ソフトウェア販売契約書", editable: false },
    { key: "loanUsage", header: "貸金利用", type: "select", options: USAGE_OPTIONS, editable: false, filterable: true },
    { key: "grantUsage", header: "助成金利用", type: "select", options: USAGE_OPTIONS, editable: false, filterable: true },
    { key: "subsidyTargetAmountTaxIncluded", header: "補助金対象額（税込）", type: "number", editable: false },
    { key: "applicationAmount", header: "申請額", type: "number", editable: false },
    { key: "recruitmentRound", header: "募集回", editable: false },
    { key: "adoptionDate", header: "採択日", editable: false },
    { key: "issueRequestDate", header: "発行依頼日", editable: false },
    { key: "accountApprovalDate", header: "アカウント承認日", type: "date", inlineEditable: true },
    { key: "grantDate", header: "交付日", editable: false },
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
    subsidyTargetAmountTaxIncluded: (value) => {
      if (value == null || value === "") return "-";
      return `${Number(value).toLocaleString("ja-JP")}円`;
    },
    applicationAmount: (value) => {
      if (value == null || value === "") return "-";
      return `${Number(value).toLocaleString("ja-JP")}円`;
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
      tableId="hojo.security-cloud.accounts"
      data={data}
      columns={columns}
      title="顧客リスト"
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      emptyMessage="顧客データが登録されていません"
      customRenderers={customRenderers}
      customActions={customActions}
      enableInlineEdit
      skipInlineConfirm
      rowClassName={(item) => item.deletedByVendor ? "!bg-red-50" : undefined}
    />
  );
}
