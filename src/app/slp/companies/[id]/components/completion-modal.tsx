"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SessionCategory } from "@/lib/slp/session-helper";
import { completeSessionAndNotify } from "../session-actions";

export type CompletionTargetContact = {
  id: number;
  name: string | null;
  lineFriendLabel: string | null;
};

interface CompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  category: SessionCategory;
  roundNumber: number;
  fromStatus: "予約中" | "キャンセル" | "完了" | "飛び" | "未予約";
  contacts: CompletionTargetContact[];
  onDone?: () => void;
}

const CATEGORY_LABEL: Record<SessionCategory, string> = {
  briefing: "概要案内",
  consultation: "導入希望商談",
};

export function CompletionModal({
  open,
  onOpenChange,
  sessionId,
  category,
  roundNumber,
  fromStatus,
  contacts,
  onDone,
}: CompletionModalProps) {
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categoryLabel = CATEGORY_LABEL[category];
  const needsReason = fromStatus === "キャンセル"; // キャンセルからの完了戻しのみ理由必須

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setSelectedIds(new Set());
    setReason("");
  }, [open]);

  const toggleContact = (contactId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const hasSelected = selectedIds.size > 0;
  const messageMissing = hasSelected && message.trim() === "";
  const canSubmit =
    !submitting && (!needsReason || reason.trim() !== "") && !messageMissing;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await completeSessionAndNotify({
        sessionId,
        selectedContactIds: Array.from(selectedIds),
        thankYouMessage: message,
        reason: needsReason ? reason.trim() : null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const attendeeFails = r.data.attendeeResults.filter((x) => !x.success);
      const attendeeSuccess = r.data.attendeeResults.filter((x) => x.success);
      const referrerFails = r.data.referrerResults.filter((x) => !x.success);
      const referrerSuccess = r.data.referrerResults.filter((x) => x.success);
      const totalFails = attendeeFails.length + referrerFails.length;
      if (totalFails === 0) {
        toast.success(
          `${categoryLabel} を完了しました（お礼: ${attendeeSuccess.length}件、紹介者通知: ${referrerSuccess.length}件）`
        );
      } else {
        toast.error(
          `完了処理は成功しましたが、通知に一部失敗しました（成功: お礼${attendeeSuccess.length}/紹介者${referrerSuccess.length}）`,
          {
            description: [
              ...attendeeFails.map((f) => `お礼[${f.name}]: ${f.error ?? "失敗"}`),
              ...referrerFails.map((f) => `紹介者[${f.snsname}]: ${f.error ?? "失敗"}`),
            ].join(" / "),
            duration: 15000,
          }
        );
      }
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "完了処理に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const roundLabel = roundNumber === 1 ? "初回" : `${roundNumber}回目`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{categoryLabel}完了お礼メッセージを送信（{roundLabel}）</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {needsReason && (
            <div>
              <Label>キャンセルから完了へ戻す理由（必須）</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="例: お客様から再実施の申し出があり実施済み"
              />
            </div>
          )}
          <div>
            <Label>お礼メッセージ</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={`${categoryLabel}後に送信するお礼メッセージを入力してください`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              チェックを入れた担当者にこのメッセージが送信されます。チェックなしで保存するとステータス変更のみ実行されます。
            </p>
            {messageMissing && (
              <p className="text-xs text-red-600 mt-1">
                担当者を選択している場合はメッセージの入力が必須です。
              </p>
            )}
          </div>
          <div>
            <Label>送信先担当者</Label>
            <div className="space-y-2 mt-2 border rounded-lg p-3 max-h-[300px] overflow-auto">
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  担当者が登録されていません
                </p>
              ) : (
                contacts.map((c) => {
                  const hasLine = c.lineFriendLabel !== null;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 p-2 rounded ${
                        hasLine
                          ? "hover:bg-muted cursor-pointer"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => hasLine && toggleContact(c.id)}
                        disabled={!hasLine}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{c.name ?? "(名前なし)"}</div>
                        <div className="text-xs text-muted-foreground">
                          {hasLine ? c.lineFriendLabel : "公式LINE未紐付け（送信不可）"}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          {category === "briefing" && roundNumber === 1 && (
            <div className="rounded bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              ℹ️ 紹介者への完了通知（form18）は、初回の概要案内のみ自動で送信されます（通知テンプレート設定の内容）。
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
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存して送信
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
