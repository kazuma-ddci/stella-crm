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
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSessionZoom } from "../session-actions";

interface DeleteZoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoomId: number;
  zoomLabel: string | null;
  hasRecording: boolean;
  onDone?: () => void;
}

export function DeleteZoomModal({
  open,
  onOpenChange,
  zoomId,
  zoomLabel,
  hasRecording,
  onDone,
}: DeleteZoomModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
  }, [open]);

  const canSubmit = !submitting && reason.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await deleteSessionZoom({
        zoomId,
        reason: reason.trim(),
      });
      if (r.ok) {
        toast.success("Zoom記録を削除しました");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">
            Zoom記録を削除しますか？
            {zoomLabel && ` (${zoomLabel})`}
          </DialogTitle>
          <DialogDescription>
            論理削除されます。議事録は残りますが、このZoom記録との紐付けは失われます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasRecording && (
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs text-red-800">
                このZoomには議事録が紐付いています。削除すると議事録の紐付けが外れます。
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">削除理由（必須）</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: 誤って登録したため"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
