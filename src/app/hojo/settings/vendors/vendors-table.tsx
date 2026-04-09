"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addVendor, updateVendor, deleteVendor, reorderVendors } from "./actions";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  staffOptions: { value: string; label: string }[];
  scLineFriendOptions: { value: string; label: string }[];
  scWholesaleStatusOptions: { value: string; label: string }[];
  consultingPlanStatusOptions: { value: string; label: string }[];
  contractStatusOptions: { value: string; label: string }[];
  vendorRegistrationStatusOptions: { value: string; label: string }[];
  toolRegistrationStatusOptions: { value: string; label: string }[];
};

export function VendorsTable({
  data,
  canEdit,
  staffOptions,
  scLineFriendOptions,
  scWholesaleStatusOptions,
  consultingPlanStatusOptions,
  contractStatusOptions,
  vendorRegistrationStatusOptions,
  toolRegistrationStatusOptions,
}: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "name", header: "ベンダー名", type: "text", required: true, filterable: true },
    { key: "accessToken", header: "専用ページ", editable: false },
    { key: "consultingStaffIds", header: "コンサル担当者", type: "multiselect", options: staffOptions, hidden: true },
    { key: "consultingStaffDisplay", header: "コンサル担当者", editable: false },
    { key: "assignedAsLineFriendId", header: "担当AS", type: "select", options: scLineFriendOptions, searchable: true, hidden: true },
    { key: "assignedAsDisplay", header: "担当AS", editable: false },
    // 絞り込み用カラム（テーブル表示・絞り込み可能）
    { key: "scWholesaleStatusName", header: "卸プラン", type: "select", options: scWholesaleStatusOptions, editable: false, filterable: true },
    { key: "scWholesaleContractStatusName", header: "卸契約状況", type: "select", options: contractStatusOptions, editable: false, filterable: true },
    { key: "consultingPlanStatusName", header: "コンサルプラン", type: "select", options: consultingPlanStatusOptions, editable: false, filterable: true },
    { key: "consultingPlanContractStatusName", header: "コンサル契約状況", type: "select", options: contractStatusOptions, editable: false, filterable: true },
    { key: "grantApplicationBpo", header: "BPO利用", type: "boolean", editable: false, filterable: true },
    { key: "grantApplicationBpoContractStatusName", header: "BPO契約状況", type: "select", options: contractStatusOptions, editable: false, filterable: true },
    { key: "loanUsage", header: "貸金利用", type: "boolean", editable: false, filterable: true },
    { key: "subsidyConsulting", header: "助成金利用", type: "boolean", editable: false, filterable: true },
    { key: "vendorRegistrationStatusName", header: "ベンダー登録状況", type: "select", options: vendorRegistrationStatusOptions, editable: false, filterable: true },
    { key: "toolRegistrationStatusName", header: "ツール登録状況", type: "select", options: toolRegistrationStatusOptions, editable: false, filterable: true },
    { key: "memo", header: "弊社備考", type: "textarea" },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  // boolean を「✓ or 何もなし」で表示
  const boolCheck = (value: unknown) => {
    return value === true ? (
      <Check className="h-4 w-4 text-green-600" />
    ) : (
      <span className="text-gray-300">—</span>
    );
  };

  const customRenderers: CustomRenderers = {
    name: (value, row) => {
      const id = row.id as number;
      return (
        <a
          href={`/hojo/settings/vendors/${id}`}
          className="text-blue-600 hover:underline font-medium"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {String(value)}
        </a>
      );
    },
    accessToken: (value) => {
      if (!value) return "-";
      const path = `/hojo/vendor/${value}`;
      const vendorDomain = process.env.NEXT_PUBLIC_VENDOR_DOMAIN || "https://vendor.alkes.jp";
      const fullUrl = `${vendorDomain}${path}`;
      const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(fullUrl);
        toast.success("共有用URLをコピーしました");
      };
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            title="取引先共有用URLをコピー"
          >
            <Copy className="h-3 w-3" />
            共有用
          </button>
          <a
            href={path}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
            title="社内スタッフ用ページを開く"
          >
            <ExternalLink className="h-3 w-3" />
            社内用
          </a>
        </div>
      );
    },
    consultingStaffDisplay: (value) => {
      if (!value || value === "-") return <span className="text-gray-400">-</span>;
      return <span className="text-sm">{String(value)}</span>;
    },
    assignedAsDisplay: (value) => {
      if (!value || value === "-") return <span className="text-gray-400">-</span>;
      return <span className="text-sm">{String(value)}</span>;
    },
    grantApplicationBpo: boolCheck,
    loanUsage: boolCheck,
    subsidyConsulting: boolCheck,
    isActive: boolCheck,
  };

  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="ベンダー"
      onAdd={canEdit ? addVendor : undefined}
      onUpdate={canEdit ? updateVendor : undefined}
      onDelete={canEdit ? deleteVendor : undefined}
      emptyMessage="ベンダーが登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderVendors : undefined}
      customRenderers={customRenderers}
    />
  );
}
