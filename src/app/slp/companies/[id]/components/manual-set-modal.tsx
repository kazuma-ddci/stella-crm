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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StaffOption } from "./meeting-sessions-section";
import type { SessionCategory } from "@/lib/slp/session-helper";
import { createManualSession, previewNextRoundNumber } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface ManualSetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyRecordId: number;
  category: SessionCategory;
  staffOptions: StaffOption[];
  onCreated?: (newSessionId?: number) => void;
}

export function ManualSetModal({
  open,
  onOpenChange,
  companyRecordId,
  category,
  staffOptions,
  onCreated,
}: ManualSetModalProps) {
  const categoryLabel = category === "briefing" ? "概要案内" : "導入希望商談";

  const [scheduledAt, setScheduledAt] = useState("");
  const [staffId, setStaffId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [notifyReferrer, setNotifyReferrer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [nextRoundPreview, setNextRoundPreview] = useState<{
    roundNumber: number;
    canAdd: boolean;
    reason?: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    // モーダルが開かれたタイミングで状態リセット + 次の打ち合わせ番号取得
    setScheduledAt("");
    setStaffId("");
    setNotes("");
    setNotifyReferrer(false);
    setNextRoundPreview(null);
    setLoadingPreview(true);
    previewNextRoundNumber({ companyRecordId, category })
      .then((r) => {
        if (r.ok) setNextRoundPreview(r.data);
        else toast.error(r.error);
      })
      .finally(() => setLoadingPreview(false));
  }, [open, companyRecordId, category]);

  // 紹介者通知チェックボックス表示条件:
  // 概要案内 × 初回のみ（ユーザー指定: 「1回目の概要案内」のみ）
  const showReferrerCheckbox =
    category === "briefing" && nextRoundPreview?.roundNumber === 1;

  const canSubmit =
    !submitting &&
    nextRoundPreview?.canAdd === true &&
    scheduledAt !== "" &&
    staffId !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        toast.error("日時が不正です");
        return;
      }
      const r = await createManualSession({
        companyRecordId,
        category,
        scheduledAt: scheduledDate,
        assignedStaffId: parseInt(staffId, 10),
        notes: notes.trim() || undefined,
        notifyReferrer: showReferrerCheckbox ? notifyReferrer : false,
      });
      if (r.ok) {
        toast.success(`${formatRoundNumber(r.data.roundNumber)} ${categoryLabel} を予約中としてセットしました`);
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
            {categoryLabel} を手動でセット
            {nextRoundPreview && ` (${formatRoundNumber(nextRoundPreview.roundNumber)})`}
          </DialogTitle>
          <DialogDescription>
            口頭で合意した予約など、プロラインを通さずにスタッフが直接予約を登録します。
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
              <Label htmlFor="scheduledAt">商談日時（必須）</Label>
              <DateTimePicker
                id="scheduledAt"
                value={scheduledAt}
                onChange={setScheduledAt}
                placeholder="日時を選択"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffId">担当者（必須）</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger id="staffId">
                  <SelectValue placeholder="担当者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">メモ（任意）</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="口頭で合意した背景など"
                rows={3}
              />
            </div>

            {showReferrerCheckbox && (
              <div className="flex items-start gap-2 rounded border p-3 bg-muted/30">
                <Checkbox
                  id="notifyReferrer"
                  checked={notifyReferrer}
                  onCheckedChange={(v) => setNotifyReferrer(v === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="notifyReferrer" className="text-sm font-normal">
                    紹介者にも予約通知を送信する
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    初回概要案内のみ、紹介者への通知を送信できます
                  </p>
                </div>
              </div>
            )}

            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800">
                ※この予約はお客様側のLINE変更ページには表示されません。変更・キャンセルが必要な場合は、お客様に直接公式LINEでご連絡いただくよう案内されます。
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
            セットする
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
