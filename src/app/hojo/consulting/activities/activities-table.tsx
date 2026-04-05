"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ListChecks } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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

export function ActivityListTable({ data }: Props) {
  const [taskDialog, setTaskDialog] = useState<{ activityId: number; tasks: TaskRecord[]; label: string } | null>(null);

  return (
    <>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ベンダー名</TableHead>
              <TableHead>対応日</TableHead>
              <TableHead>対応手段</TableHead>
              <TableHead>課題/ご相談内容</TableHead>
              <TableHead>ヒアリング内容</TableHead>
              <TableHead>回答内容</TableHead>
              <TableHead>提案内容</TableHead>
              <TableHead>次回アクション</TableHead>
              <TableHead>次回期限</TableHead>
              <TableHead>タスク</TableHead>
              <TableHead>添付資料</TableHead>
              <TableHead>録画</TableHead>
              <TableHead>スクショ</TableHead>
              <TableHead>備考</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-gray-500 py-8">
                  コンサル履歴がありません
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => {
                const vendorCount = r.tasks.filter((t) => t.taskType === "vendor").length;
                const teamCount = r.tasks.filter((t) => t.taskType === "consulting_team").length;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/hojo/settings/vendors/${r.vendorId}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {r.vendorName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{r.activityDate}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.contactMethod ? <span className="px-1.5 py-0.5 rounded bg-gray-100 text-xs">{r.contactMethod}</span> : "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px]"><p className="text-sm whitespace-pre-wrap line-clamp-2">{r.vendorIssue || "-"}</p></TableCell>
                    <TableCell className="max-w-[200px]"><p className="text-sm whitespace-pre-wrap line-clamp-2">{r.hearingContent || "-"}</p></TableCell>
                    <TableCell className="max-w-[200px]"><p className="text-sm whitespace-pre-wrap line-clamp-2">{r.responseContent || "-"}</p></TableCell>
                    <TableCell className="max-w-[200px]"><p className="text-sm whitespace-pre-wrap line-clamp-2">{r.proposalContent || "-"}</p></TableCell>
                    <TableCell className="max-w-[180px]"><p className="text-sm whitespace-pre-wrap line-clamp-2">{r.vendorNextAction || "-"}</p></TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{r.nextDeadline || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-8 whitespace-nowrap"
                        onClick={() => setTaskDialog({ activityId: r.id, tasks: r.tasks, label: `${r.activityDate} - ${r.vendorName}` })}
                      >
                        <ListChecks className="h-3 w-3" />
                        ベ:{vendorCount}/チ:{teamCount}
                      </Button>
                    </TableCell>
                    <TableCell><UrlListCell urls={r.attachmentUrls} /></TableCell>
                    <TableCell><UrlListCell urls={r.recordingUrls} /></TableCell>
                    <TableCell><UrlListCell urls={r.screenshotUrls} /></TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm">{r.notes || "-"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
