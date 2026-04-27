"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addVendor, updateVendor, deleteVendor, reorderVendors } from "./actions";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  getBadgeClasses,
  COMPLETED_BADGE_CLASSES,
  INCOMPLETE_BADGE_CLASSES,
  type BadgeColor,
} from "@/lib/badge-color";

type ToolColumnSpec = {
  id: number;
  name: string;
  statusOptions: { value: string; label: string }[];
  statusMeta: Record<string, { isCompleted: boolean }>;
};

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  staffOptions: { value: string; label: string }[];
  scLineFriendOptions: { value: string; label: string }[];
  scWholesaleStatusOptions: { value: string; label: string }[];
  consultingPlanStatusOptions: { value: string; label: string }[];
  contractStatusOptions: { value: string; label: string }[];
  vendorRegistrationStatusOptions: { value: string; label: string }[];
  scWholesaleStatusMeta: Record<string, { color: string }>;
  consultingPlanStatusMeta: Record<string, { color: string }>;
  contractStatusMeta: Record<string, { isCompleted: boolean }>;
  vendorRegistrationStatusMeta: Record<string, { isCompleted: boolean }>;
  toolColumns: ToolColumnSpec[];
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
  scWholesaleStatusMeta,
  consultingPlanStatusMeta,
  contractStatusMeta,
  vendorRegistrationStatusMeta,
  toolColumns,
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
    { key: "nextContactDateWholesale", header: "卸 次の連絡日", type: "date", editable: false, filterable: true },
    { key: "consultingPlanStatusName", header: "コンサルプラン", type: "select", options: consultingPlanStatusOptions, editable: false, filterable: true },
    { key: "consultingPlanContractStatusName", header: "コンサル契約状況", type: "select", options: contractStatusOptions, editable: false, filterable: true },
    { key: "nextContactDateConsulting", header: "コンサル 次の連絡日", type: "date", editable: false, filterable: true },
    { key: "grantApplicationBpo", header: "BPO利用", type: "boolean", editable: false, filterable: true },
    { key: "grantApplicationBpoContractStatusName", header: "BPO契約状況", type: "select", options: contractStatusOptions, editable: false, filterable: true },
    { key: "loanUsage", header: "貸金利用", type: "boolean", editable: false, filterable: true },
    { key: "subsidyConsulting", header: "助成金利用", type: "boolean", editable: false, filterable: true },
    { key: "vendorRegistrationStatusName", header: "ベンダー登録状況", type: "select", options: vendorRegistrationStatusOptions, editable: false, filterable: true },
    // ツール毎の動的列（ステータス選択肢・完了バッジはツール毎に異なる）
    ...toolColumns.map((t): ColumnDef => ({
      key: `toolStatus_${t.id}`,
      header: `ツール:${t.name}`,
      type: "select",
      options: t.statusOptions,
      editable: false,
      filterable: true,
    })),
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

  // プラン色バッジ（マスタで設定された色で表示）
  const renderPlanBadge = (meta: Record<string, { color: string }>) => (value: unknown) => {
    const name = value ? String(value) : "";
    if (!name) return <span className="text-gray-300">—</span>;
    const color = (meta[name]?.color ?? "gray") as BadgeColor;
    return (
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getBadgeClasses(color)}`}>
        {name}
      </span>
    );
  };

  // 完了/未完了バッジ（緑=完了 / 赤=未完了）
  const renderCompletionBadge = (meta: Record<string, { isCompleted: boolean }>) => (value: unknown) => {
    const name = value ? String(value) : "";
    if (!name) return <span className="text-gray-300">—</span>;
    const completed = meta[name]?.isCompleted ?? false;
    return (
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${completed ? COMPLETED_BADGE_CLASSES : INCOMPLETE_BADGE_CLASSES}`}>
        {name}
      </span>
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
    scWholesaleStatusName: renderPlanBadge(scWholesaleStatusMeta),
    consultingPlanStatusName: renderPlanBadge(consultingPlanStatusMeta),
    scWholesaleContractStatusName: renderCompletionBadge(contractStatusMeta),
    consultingPlanContractStatusName: renderCompletionBadge(contractStatusMeta),
    grantApplicationBpoContractStatusName: renderCompletionBadge(contractStatusMeta),
    vendorRegistrationStatusName: renderCompletionBadge(vendorRegistrationStatusMeta),
    // ツール毎の完了バッジ
    ...Object.fromEntries(
      toolColumns.map((t) => [
        `toolStatus_${t.id}`,
        renderCompletionBadge(t.statusMeta),
      ])
    ),
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
      tableId="hojo.vendors"
      data={data}
      columns={columns}
      title="ベンダー"
      stickyLeftCount={1}
      onAdd={canEdit ? addVendor : undefined}
      onUpdate={canEdit ? updateVendor : undefined}
      onDelete={canEdit ? deleteVendor : undefined}
      emptyMessage="ベンダーが登録されていません"
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={
        canEdit
          ? async (orderedIds) => {
              const result = await reorderVendors(orderedIds);
              if (!result.ok) {
                const { toast } = await import("sonner");
                toast.error(result.error);
              }
            }
          : undefined
      }
      customRenderers={customRenderers}
    />
  );
}
