"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addStageHistory, updateStageHistory, deleteStageHistory } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  stpCompanyOptions: { value: string; label: string }[];
  stageOptions: { value: string; label: string }[];
};

const eventTypeOptions = [
  { value: "stage_change", label: "ステージ変更" },
  { value: "target_set", label: "目標設定" },
  { value: "target_achieved", label: "目標達成" },
  { value: "manual", label: "手動登録" },
];

export function StageHistoriesTable({ data, stpCompanyOptions, stageOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false },
    { key: "stpCompanyId", header: "企業", type: "select", options: stpCompanyOptions, required: true },
    { key: "companyName", header: "企業名", editable: false },
    { key: "eventType", header: "イベント種別", type: "select", options: eventTypeOptions, required: true },
    { key: "fromStageId", header: "変更前ステージ", type: "select", options: stageOptions },
    { key: "fromStageName", header: "変更前ステージ名", editable: false },
    { key: "toStageId", header: "変更後ステージ", type: "select", options: stageOptions },
    { key: "toStageName", header: "変更後ステージ名", editable: false },
    { key: "targetDate", header: "目標日", type: "date" },
    { key: "recordedAt", header: "記録日時", type: "datetime" },
    { key: "changedBy", header: "変更者", type: "text" },
    { key: "note", header: "備考", type: "textarea" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="商談ステージ履歴"
      onAdd={addStageHistory}
      onUpdate={updateStageHistory}
      onDelete={deleteStageHistory}
      emptyMessage="履歴がありません"
    />
  );
}
