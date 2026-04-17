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
import { deleteSession } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  roundNumber: number;
  onDone?: () => void;
}

export function DeleteConfirmModal({
  open,
  onOpenChange,
  sessionId,
  roundNumber,
  onDone,
}: DeleteConfirmModalProps) {
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
      const r = await deleteSession({
        sessionId,
        reason: reason.trim(),
      });
      if (r.ok) {
        toast.success(`${formatRoundNumber(roundNumber)} を削除しました`);
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
            {formatRoundNumber(roundNumber)} を削除しますか？
          </DialogTitle>
          <DialogDescription>
            論理削除されます。履歴には削除操作が記録され、画面には表示されなくなります。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-xs text-red-800">
              削除された打ち合わせは番号を消費しません。次に作成される打ち合わせが同じ番号で始まる可能性があります。
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="reason">削除理由（必須）</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: 重複予約だったため整理"
              rows={3}
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
