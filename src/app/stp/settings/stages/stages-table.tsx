"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import type { SortableItem } from "@/components/sortable-list-modal";
import {
  addLostReasonOption,
  addStage,
  deleteLostReasonOption,
  deleteStage,
  reorderLostReasonOptions,
  updateLostReasonOption,
  updateStage,
} from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "パイプライン名", type: "text", required: true },
  { key: "stageType", header: "タイプ", type: "select", required: true, options: [
    { value: "progress", label: "進行" },
    { value: "closed_won", label: "ゴール" },
    { value: "closed_lost", label: "脱落" },
    { value: "pending", label: "一時停止" },
    { value: "completed", label: "完了" },
  ]},
  { key: "displayOrder", header: "表示順", type: "number" },
  { key: "isActive", header: "有効", type: "boolean" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false, hidden: true },
  { key: "updatedAt", header: "更新日", type: "datetime", editable: false, hidden: true },
];

const lostReasonColumns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "失注理由", type: "text", required: true, simpleMode: true },
  { key: "displayOrder", header: "表示順", type: "number", editable: false },
  { key: "isActive", header: "有効", type: "boolean" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false, hidden: true },
  { key: "updatedAt", header: "更新日", type: "datetime", editable: false, hidden: true },
];

export function StagesTable({ data, canEdit }: Props) {
  return (
    <CrudTable
      tableId="stp.settings.stages"
      data={data}
      columns={columns}
      title="パイプライン"
      onAdd={canEdit ? addStage : undefined}
      onUpdate={canEdit ? updateStage : undefined}
      onDelete={canEdit ? deleteStage : undefined}
      emptyMessage="パイプラインが登録されていません"
    />
  );
}

export function LostReasonOptionsTable({ data, canEdit }: Props) {
  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: String(item.name ?? ""),
    subLabel: item.isActive === false ? "無効" : undefined,
  }));

  return (
    <CrudTable
      tableId="stp.settings.lost-reason-options"
      data={data}
      columns={lostReasonColumns}
      title="失注理由"
      onAdd={canEdit ? addLostReasonOption : undefined}
      onUpdate={canEdit ? updateLostReasonOption : undefined}
      onDelete={canEdit ? deleteLostReasonOption : undefined}
      sortableItems={canEdit ? sortableItems : undefined}
      onReorder={canEdit ? reorderLostReasonOptions : undefined}
      emptyMessage="失注理由が登録されていません"
    />
  );
}
