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
import { promotePendingToReserved } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface PromoteToReservedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  category: SessionCategory;
  roundNumber: number;
  staffOptions: StaffOption[];
  onDone?: () => void;
}

export function PromoteToReservedModal({
  open,
  onOpenChange,
  sessionId,
  category,
  roundNumber,
  staffOptions,
  onDone,
}: PromoteToReservedModalProps) {
  const categoryLabel = category === "briefing" ? "概要案内" : "導入希望商談";

  const [scheduledAt, setScheduledAt] = useState("");
  const [staffId, setStaffId] = useState<string>("");
  const [notifyReferrer, setNotifyReferrer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScheduledAt("");
    setStaffId("");
    setNotifyReferrer(false);
  }, [open]);

  // 紹介者通知チェックボックス: 概要案内 × 初回 のみ
  const showReferrerCheckbox = category === "briefing" && roundNumber === 1;

  const canSubmit = !submitting && scheduledAt !== "" && staffId !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // DateTimePicker の値 "YYYY-MM-DDTHH:mm" は JST として解釈（タイムゾーン明示）
      const scheduledDate = new Date(`${scheduledAt}:00+09:00`);
      if (isNaN(scheduledDate.getTime())) {
        toast.error("日時が不正です");
        return;
      }
      const r = await promotePendingToReserved({
        sessionId,
        scheduledAt: scheduledDate,
        assignedStaffId: parseInt(staffId, 10),
        notifyReferrer: showReferrerCheckbox ? notifyReferrer : false,
      });
      if (r.ok) {
        toast.success(`${formatRoundNumber(roundNumber)} ${categoryLabel} を予約中にしました`);
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
          <DialogTitle>
            {formatRoundNumber(roundNumber)} {categoryLabel} を予約中に切り替える
          </DialogTitle>
          <DialogDescription>
            日時と担当者を入力して、未予約から予約中に昇格します。
          </DialogDescription>
        </DialogHeader>

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
              ※この予約は手動扱いです。お客様側のLINE変更ページには表示されません。
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            予約中に切り替える
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
