"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudTable, type ColumnDef, type CustomRenderers } from "@/components/crud-table";
import { TaskManagementDialog, type TaskRecord } from "./task-management-dialog";

type ActivityRow = {
  id: number;
  vendorId: number;
  vendorName: string;
  activityDate: string;
  contactMethod: string;
  vendorIssue: string;
  hearingContent: string;
  responseContent: string;
  proposalContent: string;
  vendorNextAction: string;
  nextDeadline: string;
  tasks: TaskRecord[];
  attachmentUrls: string[];
  recordingUrls: string[];
  screenshotUrls: string[];
  notes: string;
};

type Props = {
  data: ActivityRow[];
};

function UrlListCell({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return <span className="text-gray-300">-</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {urls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[100px]">
            {url.startsWith("/uploads/") ? url.split("/").pop()?.replace(/^\d+_[a-z0-9]+_/, "") : url}
          </span>
        </a>
      ))}
    </div>
  );
}

const contactMethodOptions = [
  { value: "LINE", label: "LINE" },
  { value: "電話", label: "電話" },
  { value: "メール", label: "メール" },
  { value: "zoom", label: "zoom" },
];

export function ActivityListTable({ data }: Props) {
  const [taskDialog, setTaskDialog] = useState<{
    activityId: number;
    tasks: TaskRecord[];
    label: string;
  } | null>(null);

  const vendorOptions = Array.from(new Set(data.map((r) => r.vendorName).filter(Boolean)))
    .map((name) => ({ value: name, label: name }));

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorId", header: "vendorId", editable: false, hidden: true },
    { key: "vendorName", header: "ベンダー名", type: "select", options: vendorOptions, editable: false, filterable: true, searchable: true },
    { key: "activityDate", header: "対応日", type: "date", editable: false, filterable: true },
    { key: "contactMethod", header: "対応手段", type: "select", options: contactMethodOptions, editable: false, filterable: true },
    { key: "vendorIssue", header: "課題/ご相談内容", type: "textarea", editable: false, filterable: true },
    { key: "hearingContent", header: "ヒアリング内容", type: "textarea", editable: false, filterable: true },
    { key: "responseContent", header: "回答内容", type: "textarea", editable: false, filterable: true },
    { key: "proposalContent", header: "提案内容", type: "textarea", editable: false, filterable: true },
    { key: "vendorNextAction", header: "次回アクション", type: "textarea", editable: false, filterable: true },
    { key: "nextDeadline", header: "次回期限", type: "date", editable: false, filterable: true },
    { key: "tasks", header: "タスク", editable: false },
    { key: "attachmentUrls", header: "添付資料", editable: false },
    { key: "recordingUrls", header: "録画", editable: false },
    { key: "screenshotUrls", header: "スクショ", editable: false },
    { key: "notes", header: "備考", type: "textarea", editable: false, filterable: true },
  ];

  const truncateCell = (value: unknown) => (
    <span className="text-sm whitespace-pre-wrap line-clamp-2 max-w-[200px] block">{value ? String(value) : "-"}</span>
  );

  const customRenderers: CustomRenderers = {
    vendorName: (value, row) => {
      const vendorId = row.vendorId as number;
      const name = value ? String(value) : "-";
      return (
        <Link
          href={`/hojo/settings/vendors/${vendorId}`}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
        >
          {name}
        </Link>
      );
    },
    contactMethod: (value) =>
      value ? (
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-xs whitespace-nowrap">{String(value)}</span>
      ) : (
        <span className="text-gray-300">-</span>
      ),
    vendorIssue: truncateCell,
    hearingContent: truncateCell,
    responseContent: truncateCell,
    proposalContent: truncateCell,
    vendorNextAction: truncateCell,
    notes: (value) => (
      <span className="text-sm truncate block max-w-[150px]">{value ? String(value) : "-"}</span>
    ),
    tasks: (_value, row) => {
      const r = row as unknown as ActivityRow;
      const vendorCount = r.tasks.filter((t) => t.taskType === "vendor").length;
      const teamCount = r.tasks.filter((t) => t.taskType === "consulting_team").length;
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-8 whitespace-nowrap"
          onClick={() =>
            setTaskDialog({
              activityId: r.id,
              tasks: r.tasks,
              label: `${r.activityDate} - ${r.vendorName}`,
            })
          }
        >
          <ListChecks className="h-3 w-3" />
          ベ:{vendorCount}/チ:{teamCount}
        </Button>
      );
    },
    attachmentUrls: (value) => <UrlListCell urls={(value as string[]) ?? []} />,
    recordingUrls: (value) => <UrlListCell urls={(value as string[]) ?? []} />,
    screenshotUrls: (value) => <UrlListCell urls={(value as string[]) ?? []} />,
  };

  return (
    <>
      <CrudTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns}
        emptyMessage="コンサル履歴がありません"
        customRenderers={customRenderers}
      />

      {taskDialog && (
        <TaskManagementDialog
          open={!!taskDialog}
          onOpenChange={(open) => !open && setTaskDialog(null)}
          activityId={taskDialog.activityId}
          activityLabel={taskDialog.label}
          tasks={taskDialog.tasks}
          showConsultingTeam={true}
          vendorTasksEditable={true}
          consultingTeamTasksEditable={true}
        />
      )}
    </>
  );
}
