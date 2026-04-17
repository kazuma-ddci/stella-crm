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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StaffOption } from "./meeting-sessions-section";
import { updateSessionDetail } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface SessionEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  roundNumber: number;
  currentScheduledAt: string | null;
  currentBookedAt: string | null;
  currentAssignedStaffId: number | null;
  currentNotes: string | null;
  hasRecording: boolean;
  staffOptions: StaffOption[];
  /** インラインフォームでスタッフが入力した値（まだ保存されていない） */
  pendingFields: {
    bookedDate: string;
    bookedTime: string;
    scheduledDate: string;
    scheduledTime: string;
    staffId: string;
    notes: string;
  };
  onDone?: () => void;
}

function combineDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  const t = time || "00:00";
  const iso = `${date}T${t}:00+09:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: `${h}:${min}` };
}

export function SessionEditModal({
  open,
  onOpenChange,
  sessionId,
  roundNumber,
  currentScheduledAt,
  currentBookedAt,
  currentAssignedStaffId,
  currentNotes,
  hasRecording,
  staffOptions,
  pendingFields,
  onDone,
}: SessionEditModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
  }, [open]);

  const canSubmit = !submitting && reason.trim() !== "";

  const origBooked = splitIso(currentBookedAt);
  const origScheduled = splitIso(currentScheduledAt);

  const changes: { field: string; before: string; after: string }[] = [];
  if (
    pendingFields.bookedDate !== origBooked.date ||
    pendingFields.bookedTime !== origBooked.time
  ) {
    changes.push({
      field: "予約日",
      before: `${origBooked.date} ${origBooked.time}`.trim() || "(未設定)",
      after: `${pendingFields.bookedDate} ${pendingFields.bookedTime}`.trim() || "(未設定)",
    });
  }
  if (
    pendingFields.scheduledDate !== origScheduled.date ||
    pendingFields.scheduledTime !== origScheduled.time
  ) {
    changes.push({
      field: "案内日/商談日",
      before: `${origScheduled.date} ${origScheduled.time}`.trim() || "(未設定)",
      after:
        `${pendingFields.scheduledDate} ${pendingFields.scheduledTime}`.trim() || "(未設定)",
    });
  }
  const origStaffId = currentAssignedStaffId?.toString() ?? "__unset__";
  if (pendingFields.staffId !== origStaffId) {
    const beforeName =
      staffOptions.find((o) => o.id === currentAssignedStaffId)?.name ?? "未選択";
    const afterId = pendingFields.staffId === "__unset__" ? null : parseInt(pendingFields.staffId, 10);
    const afterName = afterId ? (staffOptions.find((o) => o.id === afterId)?.name ?? "—") : "未選択";
    changes.push({ field: "担当者", before: beforeName, after: afterName });
  }
  if (pendingFields.notes !== (currentNotes ?? "")) {
    changes.push({
      field: "メモ",
      before: currentNotes ?? "(空)",
      after: pendingFields.notes || "(空)",
    });
  }

  const scheduledChanged =
    pendingFields.scheduledDate !== origScheduled.date ||
    pendingFields.scheduledTime !== origScheduled.time;
  const showRecordingWarning = hasRecording && scheduledChanged;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await updateSessionDetail({
        sessionId,
        fields: {
          bookedAt: combineDateTime(pendingFields.bookedDate, pendingFields.bookedTime),
          scheduledAt: combineDateTime(pendingFields.scheduledDate, pendingFields.scheduledTime),
          assignedStaffId:
            pendingFields.staffId === "__unset__" ? null : parseInt(pendingFields.staffId, 10),
          notes: pendingFields.notes.trim() || null,
        },
        reason: reason.trim(),
      });
      if (r.ok) {
        toast.success(`${formatRoundNumber(roundNumber)} の内容を更新しました`);
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatRoundNumber(roundNumber)} の内容を編集（プロライン起票）</DialogTitle>
          <DialogDescription>
            プロライン起票の打ち合わせを編集するため、変更理由の記載が必須です。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {changes.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">変更はありません</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-lg border p-3 bg-muted/30 text-xs space-y-1.5">
              <div className="font-semibold">変更内容:</div>
              {changes.map((c, i) => (
                <div key={i}>
                  <span className="text-muted-foreground">{c.field}: </span>
                  <span className="text-muted-foreground">{c.before}</span>
                  <span className="mx-1">→</span>
                  <span>{c.after}</span>
                </div>
              ))}
            </div>
          )}

          {showRecordingWarning && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-xs text-amber-800">
                この打ち合わせには議事録が紐付いています。日時を変更すると、議事録との整合性が崩れる可能性があるためご注意ください。
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">変更理由（必須）</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: お客様から変更の連絡があり反映"
              rows={3}
            />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              変更内容は履歴として全て記録されます（誰がいつ何を変更したか）。
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || changes.length === 0}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
