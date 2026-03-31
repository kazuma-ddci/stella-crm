"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addVendor, updateVendor, deleteVendor, reorderVendors } from "./actions";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  lineFriendOptions: { value: string; label: string }[];
  joseiLineFriendOptions: { value: string; label: string }[];
  referrerMap: Record<string, string>;
};

export function VendorsTable({ data, canEdit, lineFriendOptions, joseiLineFriendOptions, referrerMap }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "lineFriendId", header: "LINE情報", type: "select", options: lineFriendOptions, required: true, searchable: true, hidden: true },
    { key: "lineNo", header: "LINE番号", editable: false },
    { key: "lineName", header: "LINE名", editable: false },
    { key: "referrer", header: "紹介者", editable: false },
    { key: "name", header: "ベンダー名", type: "text", required: true },
    { key: "accessToken", header: "専用ページURL", editable: false },
    { key: "joseiLineFriendId", header: "助成金申請サポート顧客番号", type: "select", options: joseiLineFriendOptions, searchable: true },
    { key: "memo", header: "備考", type: "textarea" },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  const customRenderers: CustomRenderers = {
    lineFriendId: (value) => {
      if (!value) return "-";
      const option = lineFriendOptions.find((opt) => opt.value === String(value));
      return option?.label || "-";
    },
    lineNo: (_, row) => {
      return row.lineFriendId ? String(row.lineFriendId) : "-";
    },
    lineName: (_, row) => {
      return (row.lineName as string) || "-";
    },
    referrer: (_, row) => {
      const fid = String(row.lineFriendId);
      return referrerMap[fid] || "-";
    },
    joseiLineFriendId: (value) => {
      if (!value) return "-";
      return String(value);
    },
    accessToken: (value) => {
      if (!value) return "-";
      const path = `/hojo/vendor/${value}`;
      const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const fullUrl = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(fullUrl);
        toast.success("URLをコピーしました");
      };
      return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{path}</span>
          <button onClick={handleCopy} className="text-gray-400 hover:text-blue-600 shrink-0">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    },
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
