"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { addVendor, updateVendor, deleteVendor, reorderVendors } from "./actions";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

export function VendorsTable({ data, canEdit }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "name", header: "ベンダー名", type: "text", required: true, simpleMode: true },
    { key: "accessToken", header: "専用ページURL", editable: false },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  const customRenderers: CustomRenderers = {
    accessToken: (value) => {
      if (!value) return "-";
      const url = `${window.location.origin}/form/hojo-vendor/${value}`;
      const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(url);
        toast.success("URLをコピーしました");
      };
      return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{url}</span>
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
