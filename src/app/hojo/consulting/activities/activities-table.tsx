"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addActivity, updateActivity, deleteActivity } from "./actions";

const priorityOptions = [
  { value: "高", label: "高" },
  { value: "中", label: "中" },
  { value: "低", label: "低" },
];

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  vendorOptions: { value: string; label: string }[];
  contractOptions: { value: string; label: string }[];
};

export function ActivitiesTable({ data, canEdit, vendorOptions, contractOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorId", header: "ベンダー", type: "select", options: vendorOptions, required: true, searchable: true, filterable: true },
    { key: "vendorName", header: "ベンダー名", editable: false, filterable: true },
    { key: "contractId", header: "契約", type: "select", options: contractOptions, searchable: true },
    { key: "contractLabel", header: "契約情報", editable: false },
    { key: "activityDate", header: "活動日", type: "date", required: true },
    { key: "contactMethod", header: "接触方法", type: "text" },
    { key: "vendorIssue", header: "ベンダー課題", type: "textarea" },
    { key: "hearingContent", header: "ヒアリング内容", type: "textarea" },
    { key: "responseContent", header: "対応内容", type: "textarea" },
    { key: "proposalContent", header: "提案内容", type: "textarea" },
    { key: "vendorNextAction", header: "ベンダー次回アクション", type: "textarea" },
    { key: "nextDeadline", header: "次回期限", type: "date" },
    { key: "vendorTask", header: "ベンダータスク", type: "text" },
    { key: "vendorTaskDeadline", header: "ベンダータスク期限", type: "date" },
    { key: "vendorTaskPriority", header: "ベンダータスク優先度", type: "select", options: priorityOptions },
    { key: "vendorTaskCompleted", header: "ベンダータスク完了", type: "boolean" },
    { key: "supportTask", header: "サポートタスク", type: "text" },
    { key: "supportTaskDeadline", header: "サポートタスク期限", type: "date" },
    { key: "supportTaskPriority", header: "サポートタスク優先度", type: "select", options: priorityOptions },
    { key: "supportTaskCompleted", header: "サポートタスク完了", type: "boolean" },
    { key: "attachmentUrl", header: "添付URL", type: "text" },
    { key: "recordingUrl", header: "録音URL", type: "text" },
    { key: "screenshotUrl", header: "スクリーンショットURL", type: "text" },
    { key: "notes", header: "備考", type: "textarea" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="活動記録"
      onAdd={canEdit ? addActivity : undefined}
      onUpdate={canEdit ? updateActivity : undefined}
      onDelete={canEdit ? deleteActivity : undefined}
      emptyMessage="活動記録がありません"
    />
  );
}
