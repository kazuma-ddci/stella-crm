"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, History } from "lucide-react";
import { toast } from "sonner";
import type { SessionHistoryEntry } from "../session-actions";
import { getSessionHistory } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface SessionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  roundNumber: number;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  created: "作成",
  field_edit: "編集",
  status_change: "ステータス変更",
  deleted: "削除",
  restored: "復元",
  proline_webhook: "プロライン連携",
};

const FIELD_LABELS: Record<string, string> = {
  status: "ステータス",
  scheduledAt: "商談日時",
  assignedStaffId: "担当者",
  notes: "メモ",
  prolineReservationId: "プロライン予約ID",
  reservation_change: "予約情報（プロライン経由）",
  zoom_added: "Zoom記録追加",
  zoom_updated: "Zoom記録編集",
  zoom_deleted: "Zoom記録削除",
};

function labelChangeType(t: string): string {
  return CHANGE_TYPE_LABELS[t] ?? t;
}

function labelFieldName(f: string | null): string {
  if (!f) return "—";
  return FIELD_LABELS[f] ?? f;
}

function formatJstDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

// 値の表示用整形: 日時っぽい値はJSTに整形、staffIdは数値として表示（名前解決は未実施）
function formatValue(v: string | null): string {
  if (v === null || v === undefined) return "—";
  // ISO日時形式の検出
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    return formatJstDateTime(v);
  }
  // 長すぎる値は省略
  if (v.length > 80) return v.slice(0, 77) + "...";
  return v;
}

export function SessionHistoryModal({
  open,
  onOpenChange,
  sessionId,
  roundNumber,
}: SessionHistoryModalProps) {
  const [histories, setHistories] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetching pattern: set loading before fetch
    setLoading(true);
    setHistories([]);
    getSessionHistory(sessionId)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setHistories(r.data);
        else toast.error(r.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {formatRoundNumber(roundNumber)} の変更履歴
          </DialogTitle>
          <DialogDescription>
            この打ち合わせに対する全ての変更操作を時系列で表示します（新しい順）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              読み込み中...
            </div>
          ) : histories.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              変更履歴はありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">日時</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                  <TableHead className="w-[120px]">項目</TableHead>
                  <TableHead>変更前 → 変更後</TableHead>
                  <TableHead className="w-[100px]">変更者</TableHead>
                  <TableHead>理由</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {histories.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatJstDateTime(h.changedAt)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {labelChangeType(h.changeType)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {labelFieldName(h.fieldName)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.changeType === "field_edit" || h.changeType === "status_change" ? (
                        <>
                          <span className="text-muted-foreground">
                            {formatValue(h.oldValue)}
                          </span>
                          <span className="mx-1">→</span>
                          <span>{formatValue(h.newValue)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {h.newValue ? formatValue(h.newValue) : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {h.changedByStaffName ?? <span className="text-muted-foreground">システム</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.reason ? (
                        <span className="whitespace-pre-wrap">{h.reason}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
