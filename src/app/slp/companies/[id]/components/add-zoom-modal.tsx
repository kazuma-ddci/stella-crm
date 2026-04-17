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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addSessionZoom } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface AddZoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  roundNumber: number;
  onDone?: () => void;
}

export function AddZoomModal({
  open,
  onOpenChange,
  sessionId,
  roundNumber,
  onDone,
}: AddZoomModalProps) {
  const [zoomMeetingId, setZoomMeetingId] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [label, setLabel] = useState("追加Zoom");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setZoomMeetingId("");
    setJoinUrl("");
    setStartUrl("");
    setScheduledAt("");
    setLabel("追加Zoom");
  }, [open]);

  const canSubmit =
    !submitting &&
    zoomMeetingId.trim() !== "" &&
    joinUrl.trim() !== "" &&
    /^\d+$/.test(zoomMeetingId.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
      if (scheduledAt && scheduledDate && isNaN(scheduledDate.getTime())) {
        toast.error("日時の形式が不正です");
        return;
      }
      const r = await addSessionZoom({
        sessionId,
        zoomMeetingId: zoomMeetingId.trim(),
        joinUrl: joinUrl.trim(),
        startUrl: startUrl.trim() || null,
        scheduledAt: scheduledDate,
        label: label.trim() || undefined,
      });
      if (r.ok) {
        toast.success(`${formatRoundNumber(roundNumber)} に追加Zoomを登録しました`);
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
          <DialogTitle>{formatRoundNumber(roundNumber)} に追加Zoomを登録</DialogTitle>
          <DialogDescription>
            Zoom途中切れで分割実施した場合など、同じ打ち合わせに2つ目以降のZoom会議を紐付けます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Zoom公式の発行は別途行い、このフォームではMeeting IDとJoin URLを手入力して記録します。自動発行は Phase 3 で連携予定です。
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="zoomMeetingId">Meeting ID（必須・数字のみ）</Label>
            <Input
              id="zoomMeetingId"
              type="text"
              value={zoomMeetingId}
              onChange={(e) => setZoomMeetingId(e.target.value)}
              placeholder="例: 82311234567"
              inputMode="numeric"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="joinUrl">Join URL（必須）</Label>
            <Input
              id="joinUrl"
              type="url"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startUrl">Start URL（任意、主催者用）</Label>
            <Input
              id="startUrl"
              type="url"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://zoom.us/s/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledAt">予定日時（任意）</Label>
            <DateTimePicker
              id="scheduledAt"
              value={scheduledAt}
              onChange={setScheduledAt}
              placeholder="日時を選択"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">ラベル（任意）</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: 延長分, 再実施"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            追加する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
