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
import type {
  StaffOption,
  ReferrerOptionForUI,
} from "./meeting-sessions-section";
import type { SessionCategory } from "@/lib/slp/session-helper";
import { createManualSession, previewNextRoundNumber } from "../session-actions";
import { formatRoundNumber } from "./round-label";

interface ManualSetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyRecordId: number;
  category: SessionCategory;
  staffOptions: StaffOption[];
  referrerOptions: ReferrerOptionForUI[];
  onCreated?: (newSessionId?: number) => void;
}

export function ManualSetModal({
  open,
  onOpenChange,
  companyRecordId,
  category,
  staffOptions,
  referrerOptions,
  onCreated,
}: ManualSetModalProps) {
  const categoryLabel = category === "briefing" ? "概要案内" : "導入希望商談";

  const [scheduledAt, setScheduledAt] = useState("");
  const [staffId, setStaffId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedReferrerIds, setSelectedReferrerIds] = useState<Set<number>>(
    new Set()
  );
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
    // 紹介者は全員チェック済みでスタート（外したい人だけ外す運用）
    setSelectedReferrerIds(new Set(referrerOptions.map((r) => r.lineFriendId)));
    setNextRoundPreview(null);
    setLoadingPreview(true);
    previewNextRoundNumber({ companyRecordId, category })
      .then((r) => {
        if (r.ok) setNextRoundPreview(r.data);
        else toast.error(r.error);
      })
      .finally(() => setLoadingPreview(false));
  }, [open, companyRecordId, category, referrerOptions]);

  const toggleReferrer = (lineFriendId: number) => {
    setSelectedReferrerIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineFriendId)) next.delete(lineFriendId);
      else next.add(lineFriendId);
      return next;
    });
  };

  // 紹介者チェックリスト表示条件:
  // 概要案内 × 初回 × 紹介者が1人以上いる
  const showReferrerSection =
    category === "briefing" &&
    nextRoundPreview?.roundNumber === 1 &&
    referrerOptions.length > 0;

  const canSubmit =
    !submitting &&
    nextRoundPreview?.canAdd === true &&
    scheduledAt !== "" &&
    staffId !== "";

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
      const r = await createManualSession({
        companyRecordId,
        category,
        scheduledAt: scheduledDate,
        assignedStaffId: parseInt(staffId, 10),
        notes: notes.trim() || undefined,
        selectedReferrerLineFriendIds: showReferrerSection
          ? Array.from(selectedReferrerIds)
          : undefined,
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

            {showReferrerSection && (
              <div className="space-y-2 rounded border p-3 bg-muted/30">
                <Label className="text-sm font-normal">
                  紹介者への予約通知（送信したい紹介者にチェック）
                </Label>
                <p className="text-xs text-muted-foreground">
                  初回概要案内のみ、紹介者への通知を送信できます。
                  チェックを外した紹介者には送信されません。
                </p>
                <div className="space-y-1.5 mt-1">
                  {referrerOptions.map((r) => (
                    <label
                      key={r.lineFriendId}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedReferrerIds.has(r.lineFriendId)}
                        onCheckedChange={() => toggleReferrer(r.lineFriendId)}
                      />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
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
