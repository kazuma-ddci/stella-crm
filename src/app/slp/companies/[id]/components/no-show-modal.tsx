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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { SessionCategory } from "@/lib/slp/session-helper";
import { changeStatusToNoShow } from "../session-actions";

interface NoShowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  category: SessionCategory;
  roundNumber: number;
  source: "proline" | "manual";
  onDone?: () => void;
}

const CATEGORY_LABEL: Record<SessionCategory, string> = {
  briefing: "概要案内",
  consultation: "導入希望商談",
};

export function NoShowModal({
  open,
  onOpenChange,
  sessionId,
  category,
  roundNumber,
  source,
  onDone,
}: NoShowModalProps) {
  const canNotifyReferrer = category === "briefing" && roundNumber === 1;

  const [notifyReferrer, setNotifyReferrer] = useState(canNotifyReferrer);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prolineCancelDialogOpen, setProlineCancelDialogOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotifyReferrer(canNotifyReferrer); // デフォルトON
    setReason("");
  }, [open, canNotifyReferrer]);

  const categoryLabel = CATEGORY_LABEL[category];
  const roundLabel = roundNumber === 1 ? "初回" : `${roundNumber}回目`;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await changeStatusToNoShow({
        sessionId,
        notifyReferrer,
        reason: reason.trim() || null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data.referrerError) {
        toast.error(`飛びに変更しましたが、紹介者通知に失敗: ${r.data.referrerError}`, {
          duration: 10000,
        });
      } else if (r.data.referrerNotified) {
        toast.success("飛びに変更し、紹介者に不参加通知を送信しました");
      } else {
        toast.success("飛びに変更しました");
      }

      // プロライン起票なら、プロライン側のキャンセル案内ダイアログを出す
      if (r.data.needsProlineCancel) {
        onOpenChange(false);
        setProlineCancelDialogOpen(true);
      } else {
        onOpenChange(false);
      }
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "飛び処理に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {roundLabel} {categoryLabel} を「飛び」にする
            </DialogTitle>
            <DialogDescription>
              Zoom会議は自動削除されます。飛んだお客様への通知は送信されません。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>理由（任意）</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="例: 当日ノーショー、連絡なし"
              />
            </div>
            {canNotifyReferrer && (
              <div className="flex items-start gap-2 rounded border p-3 bg-muted/30">
                <Checkbox
                  id="notifyReferrer"
                  checked={notifyReferrer}
                  onCheckedChange={(v) => setNotifyReferrer(v === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="notifyReferrer" className="text-sm font-normal">
                    紹介者に不参加通知を送信する
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    初回の概要案内のみ、紹介者に不参加の通知を送信できます（通知テンプレートに基づく）。
                  </p>
                </div>
              </div>
            )}
            {source === "proline" && (
              <div className="rounded bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                ⚠️ この予約はプロラインから作成されたものです。飛び処理の後、プロライン側でもキャンセル処理をしてください（ダイアログでご案内します）。
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              飛びにする
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* プロライン側でのキャンセル案内（OKを押すまで残る） */}
      <AlertDialog
        open={prolineCancelDialogOpen}
        onOpenChange={setProlineCancelDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              プロライン側でもキャンセル処理をしてください
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  この予約はプロラインから作成されたものです。
                  CRM側では「飛び」ステータスに変更し、Zoom会議も削除しました。
                </p>
                <p>
                  <strong>
                    必ずプロライン側でもこの予約をキャンセルしてください。
                  </strong>
                  そのままにすると、リマインドや他の自動配信が継続してしまう可能性があります。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>確認しました</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
