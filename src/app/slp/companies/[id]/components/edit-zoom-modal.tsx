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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateSessionZoom } from "../session-actions";

interface EditZoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoomId: number;
  currentJoinUrl: string;
  currentScheduledAt: string | null;
  currentLabel: string | null;
  hasRecording: boolean;
  onDone?: () => void;
}

function isoToDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function dateTimeLocalToDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}:00+09:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

export function EditZoomModal({
  open,
  onOpenChange,
  zoomId,
  currentJoinUrl,
  currentScheduledAt,
  currentLabel,
  hasRecording,
  onDone,
}: EditZoomModalProps) {
  const [joinUrl, setJoinUrl] = useState(currentJoinUrl);
  const [scheduledAt, setScheduledAt] = useState("");
  const [label, setLabel] = useState(currentLabel ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setJoinUrl(currentJoinUrl);
    setScheduledAt(isoToDateTimeLocal(currentScheduledAt));
    setLabel(currentLabel ?? "");
    setReason("");
  }, [open, currentJoinUrl, currentScheduledAt, currentLabel]);

  const scheduledChanged = isoToDateTimeLocal(currentScheduledAt) !== scheduledAt;
  const showRecordingWarning = hasRecording && scheduledChanged;

  const canSubmit = !submitting && reason.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const newScheduledDate = scheduledAt ? dateTimeLocalToDate(scheduledAt) : null;
      if (scheduledAt && !newScheduledDate) {
        toast.error("日時の形式が不正です");
        return;
      }

      const r = await updateSessionZoom({
        zoomId,
        joinUrl: joinUrl.trim() !== currentJoinUrl ? joinUrl.trim() : undefined,
        scheduledAt: scheduledChanged ? newScheduledDate : undefined,
        label: (label.trim() || null) !== currentLabel ? (label.trim() || null) : undefined,
        reason: reason.trim(),
      });
      if (r.ok) {
        toast.success("Zoom情報を更新しました");
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
          <DialogTitle>Zoom記録を編集</DialogTitle>
          <DialogDescription>
            Meeting ID は変更できません。変更理由の記載は必須です。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="joinUrl">Join URL</Label>
            <Input
              id="joinUrl"
              type="url"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledAt">予定日時</Label>
            <DateTimePicker
              id="scheduledAt"
              value={scheduledAt}
              onChange={setScheduledAt}
              placeholder="日時を選択"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">ラベル</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: 延長分"
            />
          </div>

          {showRecordingWarning && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-xs text-amber-800">
                このZoomには議事録が紐付いています。日時を変更すると、議事録との整合性が崩れる可能性があるためご注意ください。
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">変更理由（必須）</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
