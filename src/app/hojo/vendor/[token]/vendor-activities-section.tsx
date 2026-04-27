"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineCell } from "@/components/inline-cell";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateActivityNotesByVendor } from "./actions";
import { ClipboardList, ExternalLink, ListChecks } from "lucide-react";
import { TaskManagementDialog, type TaskRecord } from "@/app/hojo/consulting/activities/task-management-dialog";

type ActivityRecord = {
  id: number;
  activityDate: string;
  contactMethod: string;
  vendorIssue: string;
  vendorNextAction: string;
  nextDeadline: string;
  tasks: TaskRecord[];
  attachmentUrls: string[];
  recordingUrls: string[];
  screenshotUrls: string[];
  notes: string;
};

type Props = {
  data: ActivityRecord[];
  vendorId: number;
  canEdit: boolean;
};

function UrlLinkList({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return <span className="text-gray-300">-</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {urls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#10b981] hover:text-[#059669] text-xs transition-colors"
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

export function VendorActivitiesSection({ data, vendorId, canEdit }: Props) {
  const router = useRouter();
  const [taskDialog, setTaskDialog] = useState<{ activityId: number; tasks: TaskRecord[]; label: string } | null>(null);
  const [textDialog, setTextDialog] = useState<{ title: string; content: string } | null>(null);

  const renderExpandableCell = (title: string, content: string) => {
    if (!content) return <span className="text-sm text-gray-300">-</span>;
    return (
      <button
        type="button"
        onClick={() => setTextDialog({ title, content })}
        className="text-left w-full group/cell"
        title="クリックで全文表示"
      >
        <p className="text-sm text-gray-600 whitespace-pre-wrap max-h-20 overflow-y-auto pr-1 group-hover/cell:text-[#10b981] transition-colors">
          {content}
        </p>
      </button>
    );
  };

  const handleNotesSave = async (activityId: number, value: string) => {
    const result = await updateActivityNotesByVendor(activityId, vendorId, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10b981]/10 to-[#86efac]/10 flex items-center justify-center mb-4">
          <ClipboardList className="h-8 w-8 text-[#10b981]/60" />
        </div>
        <p className="text-base font-medium mb-1">コンサル履歴がありません</p>
        <p className="text-sm">対応記録が追加されると、ここに表示されます</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-[#10b981]/5 to-[#86efac]/5">
                <TableHead className="text-xs font-semibold text-[#10b981]">対応日</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">対応手段</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">課題/ご相談内容</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">次回アクション</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">次回期限</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">ベンダー様タスク</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">添付資料</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">録画</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">スクショ</TableHead>
                <TableHead className="text-xs font-semibold text-[#10b981]">備考</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const vendorTasks = r.tasks.filter((t) => t.taskType === "vendor");
                const vendorCount = vendorTasks.length;
                const incompleteCount = vendorTasks.filter((t) => !t.completed).length;
                return (
                  <TableRow key={r.id} className="group/row hover:bg-gray-50/50">
                    <TableCell className="whitespace-nowrap text-sm font-medium text-gray-700">
                      {r.activityDate || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.contactMethod ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600">
                          {r.contactMethod}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="max-w-[220px] align-top">
                      {renderExpandableCell("課題/ご相談内容", r.vendorIssue)}
                    </TableCell>
                    <TableCell className="max-w-[220px] align-top">
                      {renderExpandableCell("次回アクション", r.vendorNextAction)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                      {r.nextDeadline || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-8 whitespace-nowrap"
                        onClick={() =>
                          setTaskDialog({
                            activityId: r.id,
                            tasks: r.tasks,
                            label: r.activityDate,
                          })
                        }
                      >
                        <ListChecks className="h-3 w-3" />
                        {vendorCount}件
                        {incompleteCount > 0 && (
                          <span className="text-[10px] text-red-500">(未完了 {incompleteCount})</span>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <UrlLinkList urls={r.attachmentUrls} />
                    </TableCell>
                    <TableCell>
                      <UrlLinkList urls={r.recordingUrls} />
                    </TableCell>
                    <TableCell>
                      <UrlLinkList urls={r.screenshotUrls} />
                    </TableCell>
                    <TableCell className="max-w-[180px] align-top">
                      {canEdit ? (
                        <InlineCell
                          value={r.notes}
                          onSave={(v) => handleNotesSave(r.id, v)}
                          type="textarea"
                        >
                          <span className="text-sm text-gray-600 whitespace-pre-wrap block max-h-20 overflow-y-auto pr-1">
                            {r.notes || <span className="text-gray-300 italic">クリックして入力</span>}
                          </span>
                        </InlineCell>
                      ) : (
                        renderExpandableCell("備考", r.notes)
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!textDialog} onOpenChange={(open) => !open && setTextDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{textDialog?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
            {textDialog?.content}
          </div>
        </DialogContent>
      </Dialog>

      {taskDialog && (
        <TaskManagementDialog
          open={!!taskDialog}
          onOpenChange={(open) => !open && setTaskDialog(null)}
          activityId={taskDialog.activityId}
          activityLabel={taskDialog.label}
          tasks={taskDialog.tasks}
          showConsultingTeam={false}
          vendorTasksEditable={canEdit}
          vendorIdForPermCheck={vendorId}
        />
      )}
    </>
  );
}
