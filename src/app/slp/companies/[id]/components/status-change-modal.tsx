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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SessionStatus } from "@/lib/slp/session-helper";
import { SessionStatusBadge } from "./session-status-badge";
import { updateSessionStatus } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface StatusChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  currentStatus: SessionStatus;
  targetStatus: SessionStatus | null;
  roundNumber: number;
  onDone?: () => void;
}

export function StatusChangeModal({
  open,
  onOpenChange,
  sessionId,
  currentStatus,
  targetStatus,
  roundNumber,
  onDone,
}: StatusChangeModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
  }, [open]);

  const canSubmit = !submitting && targetStatus !== null && reason.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit || !targetStatus) return;
    setSubmitting(true);
    try {
      const r = await updateSessionStatus({
        sessionId,
        newStatus: targetStatus,
        reason: reason.trim(),
      });
      if (r.ok) {
        toast.success(`ステータスを「${targetStatus}」に変更しました`);
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
          <DialogTitle>{formatRoundNumber(roundNumber)} のステータス変更</DialogTitle>
          <DialogDescription>
            変更理由の記載は必須です。完了状態で後続の打ち合わせが既に作成されている場合は変更できません。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">変更:</span>
            <SessionStatusBadge status={currentStatus} />
            <span className="mx-1">→</span>
            {targetStatus && <SessionStatusBadge status={targetStatus} />}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">変更理由（必須）</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: お客様から当日体調不良で実施できない旨連絡あり"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            変更する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
