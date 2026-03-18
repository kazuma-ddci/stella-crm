"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addSlpStage, updateSlpStage, deleteSlpStage } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "name", header: "ステージ名", type: "text", required: true },
  { key: "stageNumber", header: "ステージ番号", type: "number", required: true },
  { key: "phase", header: "フェーズ", type: "text" },
  { key: "winRate", header: "受注確度（%）", type: "number" },
  { key: "autoAction", header: "自動アクション", type: "text" },
  { key: "isActive", header: "有効", type: "boolean" },
  { key: "createdAt", header: "作成日", type: "datetime", editable: false, hidden: true },
  { key: "updatedAt", header: "更新日", type: "datetime", editable: false, hidden: true },
];

export function SlpStagesTable({ data, canEdit }: Props) {
  return (
    <CrudTable
      data={data}
      columns={columns}
      title="パイプライン"
      onAdd={canEdit ? addSlpStage : undefined}
      onUpdate={canEdit ? updateSlpStage : undefined}
      onDelete={canEdit ? deleteSlpStage : undefined}
      emptyMessage="パイプラインが登録されていません"
    />
  );
}
