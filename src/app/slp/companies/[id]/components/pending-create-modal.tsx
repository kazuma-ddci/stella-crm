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
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SessionCategory } from "@/lib/slp/session-helper";
import { createPendingSession, previewNextRoundNumber } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface PendingCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyRecordId: number;
  category: SessionCategory;
  onCreated?: (newSessionId?: number) => void;
}

export function PendingCreateModal({
  open,
  onOpenChange,
  companyRecordId,
  category,
  onCreated,
}: PendingCreateModalProps) {
  const categoryLabel = category === "briefing" ? "概要案内" : "導入希望商談";

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [nextRoundPreview, setNextRoundPreview] = useState<{
    roundNumber: number;
    canAdd: boolean;
    reason?: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setNextRoundPreview(null);
    setLoadingPreview(true);
    previewNextRoundNumber({ companyRecordId, category })
      .then((r) => {
        if (r.ok) setNextRoundPreview(r.data);
        else toast.error(r.error);
      })
      .finally(() => setLoadingPreview(false));
  }, [open, companyRecordId, category]);

  const canSubmit = !submitting && nextRoundPreview?.canAdd === true;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await createPendingSession({
        companyRecordId,
        category,
        notes: notes.trim() || undefined,
      });
      if (r.ok) {
        toast.success(`${formatRoundNumber(r.data.roundNumber)} ${categoryLabel} を未予約として起票しました`);
        onOpenChange(false);
        onCreated?.(r.data.sessionId);
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
          <DialogTitle>
            {categoryLabel} を未予約として起票
            {nextRoundPreview && ` (${formatRoundNumber(nextRoundPreview.roundNumber)})`}
          </DialogTitle>
          <DialogDescription>
            日時がまだ確定していない「次回商談」をスタッフ用にマーキングします。お客様への通知は送信されません。
          </DialogDescription>
        </DialogHeader>

        {loadingPreview && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            状態を確認中...
          </div>
        )}

        {nextRoundPreview && !nextRoundPreview.canAdd && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {nextRoundPreview.reason ?? "新しい打ち合わせを追加できません"}
            </AlertDescription>
          </Alert>
        )}

        {nextRoundPreview?.canAdd && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">メモ（任意）</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例: お客様から「来月あたり2回目やる」と口頭で話あり"
                rows={3}
              />
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs text-blue-800">
                日時が決まったら、この打ち合わせの「予約中へ昇格」機能で日時・担当者を入力して予約確定できます。
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            起票する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
