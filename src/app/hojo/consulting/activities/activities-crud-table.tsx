"use client";

import { useState } from "react";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import { Button } from "@/components/ui/button";
import { ListChecks, ExternalLink } from "lucide-react";
import { addActivity, updateActivity, deleteActivity } from "./actions";
import { TaskManagementDialog, type TaskRecord } from "./task-management-dialog";
import { TaskFormField, type TaskFormValue } from "./task-form-field";
import { MultiUrlField } from "./multi-url-field";

const contactMethodOptions = [
  { value: "LINE", label: "LINE" },
  { value: "電話", label: "電話" },
  { value: "メール", label: "メール" },
  { value: "zoom", label: "zoom" },
];

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  vendorOptions: { value: string; label: string }[];
  contractOptions: { value: string; label: string }[];
  onAddOverride?: (data: Record<string, unknown>) => Promise<void | import("@/lib/action-result").ActionResult>;
  onUpdateOverride?: (id: number, data: Record<string, unknown>) => Promise<void | import("@/lib/action-result").ActionResult>;
  onDeleteOverride?: (id: number) => Promise<void | import("@/lib/action-result").ActionResult>;
  hideVendorColumn?: boolean;
  notesReadOnly?: boolean;
  defaultVendorId?: string;
  tableId?: string;
};

export function ActivitiesCrudTable({ data, canEdit, vendorOptions, contractOptions, onAddOverride, onUpdateOverride, onDeleteOverride, hideVendorColumn, notesReadOnly, defaultVendorId, tableId = "hojo.consulting.activities-crud" }: Props) {
  const [taskDialogState, setTaskDialogState] = useState<{ activityId: number; tasks: TaskRecord[]; label: string } | null>(null);

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorId", header: "ベンダー", type: "select", options: vendorOptions, required: !hideVendorColumn, searchable: true, filterable: true, hidden: hideVendorColumn, editable: !hideVendorColumn, defaultValue: defaultVendorId },
    { key: "vendorName", header: "ベンダー名", editable: false, filterable: true, hidden: hideVendorColumn },
    { key: "activityDate", header: "対応日", type: "date", required: true },
    { key: "contactMethod", header: "対応手段", type: "select", options: contactMethodOptions },
    { key: "vendorIssue", header: "ベンダー様\n課題/ご相談内容", type: "textarea" },
    { key: "hearingContent", header: "ヒアリング内容", type: "textarea" },
    { key: "responseContent", header: "回答内容", type: "textarea" },
    { key: "proposalContent", header: "提案内容", type: "textarea" },
    { key: "vendorNextAction", header: "ベンダー様\n次回アクション", type: "textarea" },
    { key: "nextDeadline", header: "次回期限", type: "date" },
    { key: "tasks", header: "タスク", editable: true },
    { key: "attachmentUrls", header: "添付資料", editable: true },
    { key: "recordingUrls", header: "録画", editable: true },
    { key: "screenshotUrls", header: "スクショ", editable: true },
    { key: "notes", header: "備考", type: "textarea", editable: notesReadOnly ? false : undefined },
  ];

  const renderUrlListCell = (value: unknown) => {
    const urls = Array.isArray(value) ? (value as string[]) : [];
    if (urls.length === 0) return <span className="text-gray-300">-</span>;
    return (
      <div className="flex flex-col gap-1">
        {urls.slice(0, 3).map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[120px]">
              {url.startsWith("/uploads/") ? url.split("/").pop()?.replace(/^\d+_[a-z0-9]+_/, "") : url}
            </span>
          </a>
        ))}
        {urls.length > 3 && (
          <span className="text-xs text-muted-foreground">他 {urls.length - 3}件</span>
        )}
      </div>
    );
  };

  const customRenderers = {
    tasks: (_value: unknown, row: Record<string, unknown>) => {
      const tasks = (row.tasks as TaskRecord[] | undefined) || [];
      const vendorCount = tasks.filter((t) => t.taskType === "vendor").length;
      const teamCount = tasks.filter((t) => t.taskType === "consulting_team").length;
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 h-8 whitespace-nowrap"
          onClick={(e) => {
            e.stopPropagation();
            setTaskDialogState({
              activityId: row.id as number,
              tasks,
              label: `${row.activityDate || ""}${row.vendorName ? ` - ${row.vendorName}` : ""}`,
            });
          }}
        >
          <ListChecks className="h-3 w-3" />
          ベ:{vendorCount} / チ:{teamCount}
        </Button>
      );
    },
    attachmentUrls: renderUrlListCell,
    recordingUrls: renderUrlListCell,
    screenshotUrls: renderUrlListCell,
  };

  const customFormFields = {
    tasks: {
      render: (value: unknown, onChange: (value: unknown) => void) => (
        <TaskFormField
          value={(value as TaskFormValue[]) || []}
          onChange={(v) => onChange(v)}
        />
      ),
    },
    attachmentUrls: {
      render: (value: unknown, onChange: (value: unknown) => void) => (
        <MultiUrlField
          value={(value as string[]) || []}
          onChange={(v) => onChange(v)}
        />
      ),
    },
    recordingUrls: {
      render: (value: unknown, onChange: (value: unknown) => void) => (
        <MultiUrlField
          value={(value as string[]) || []}
          onChange={(v) => onChange(v)}
        />
      ),
    },
    screenshotUrls: {
      render: (value: unknown, onChange: (value: unknown) => void) => (
        <MultiUrlField
          value={(value as string[]) || []}
          onChange={(v) => onChange(v)}
        />
      ),
    },
  };

  return (
    <>
      <CrudTable
        tableId={tableId}
        data={data}
        columns={columns}
        title="コンサル履歴"
        onAdd={canEdit ? (onAddOverride ?? addActivity) : undefined}
        onUpdate={canEdit ? (onUpdateOverride ?? updateActivity) : undefined}
        onDelete={canEdit ? (onDeleteOverride ?? deleteActivity) : undefined}
        customRenderers={customRenderers}
        customFormFields={customFormFields}
        emptyMessage="コンサル履歴がありません"
      />

      {taskDialogState && (
        <TaskManagementDialog
          open={!!taskDialogState}
          onOpenChange={(open) => !open && setTaskDialogState(null)}
          activityId={taskDialogState.activityId}
          activityLabel={taskDialogState.label}
          tasks={taskDialogState.tasks}
          showConsultingTeam={true}
          vendorTasksEditable={canEdit}
          consultingTeamTasksEditable={canEdit}
        />
      )}
    </>
  );
}
