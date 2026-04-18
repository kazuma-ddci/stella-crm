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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  setSessionNotifyOverrides,
  clearSessionNotifyOverrides,
} from "../session-actions";
import type { CompanyContactForNotify } from "./meeting-sessions-section";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  sessionLabel: string; // 例: "1回目 概要案内"
  contacts: CompanyContactForNotify[];
  bookerContactId: number | null;
  /** 個別設定が既にあるか（UI初期値判定用） */
  hasOverride: boolean;
  /** 既存の個別設定コンタクトID群（UI初期値） */
  overrideContactIds: number[];
  onDone?: () => void;
}

/**
 * 商談カードの「通知対象を個別設定」モーダル。
 *
 * 初期チェック状態:
 *  - 個別設定済み: DBに保存されているコンタクトID
 *  - 未設定（デフォルトモード）: 予約者 + receivesSessionNotifications=true の担当者
 */
export function SessionNotifyOverrideModal({
  open,
  onOpenChange,
  sessionId,
  sessionLabel,
  contacts,
  bookerContactId,
  hasOverride,
  overrideContactIds,
  onDone,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // 送信可能な（LINE紐付けあり）コンタクトIDの集合
    const hasLineContactIds = new Set(
      contacts.filter((c) => c.lineFriendLabel !== null).map((c) => c.id)
    );
    if (hasOverride) {
      // 既存の override でも、LINE紐付けが外れた担当者はチェック外して表示
      // （送信できない担当者がチェック状態で残るのは誤解の元）
      setSelected(
        new Set(overrideContactIds.filter((id) => hasLineContactIds.has(id)))
      );
    } else {
      // デフォルト計算: 予約者 + フラグONの担当者（LINE紐付けありのみ）
      const defaults = new Set<number>();
      if (bookerContactId !== null && hasLineContactIds.has(bookerContactId)) {
        defaults.add(bookerContactId);
      }
      for (const c of contacts) {
        if (c.receivesSessionNotifications && c.lineFriendLabel !== null) {
          defaults.add(c.id);
        }
      }
      setSelected(defaults);
    }
  }, [open, hasOverride, overrideContactIds, bookerContactId, contacts]);

  const toggle = (id: number, hasLine: boolean) => {
    if (!hasLine) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const r = await setSessionNotifyOverrides({
        sessionId,
        contactIds: Array.from(selected),
      });
      if (r.ok) {
        toast.success(
          `この商談の通知対象を個別設定しました（${r.data.count}名）`
        );
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    setSubmitting(true);
    try {
      const r = await clearSessionNotifyOverrides(sessionId);
      if (r.ok) {
        toast.success("個別設定を解除し、デフォルトに戻しました");
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "リセットに失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sessionLabel} の通知対象を個別設定</DialogTitle>
          <DialogDescription>
            この商談だけの通知対象を選びます。担当者タブの設定よりこちらが優先されます。
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-50/50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-900">
            保存すると、この商談の「確定・変更・キャンセル・前日リマインド・1時間前リマインド」
            通知はチェックを入れた担当者にのみ送信されます。
            キャンセル時は自動で個別設定が削除され、デフォルトに戻ります。
          </AlertDescription>
        </Alert>

        {selected.size === 0 && (
          <Alert className="bg-amber-50 border-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-900">
              誰も選択されていません。このまま保存すると、個別設定は解除されて
              デフォルトの通知対象（予約者 + 担当者タブでONの担当者）に通知が送信されます。
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label className="text-sm mb-2 block">通知対象の担当者</Label>
          <div className="space-y-1.5 border rounded-lg p-3 max-h-[320px] overflow-auto">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                担当者が登録されていません
              </p>
            ) : (
              contacts.map((c) => {
                const hasLine = c.lineFriendLabel !== null;
                const isBooker = c.id === bookerContactId;
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
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggle(c.id, hasLine)}
                      disabled={!hasLine}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {c.name ?? "(名前なし)"}
                        {isBooker && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            予約者
                          </span>
                        )}
                        {c.isPrimary && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            メイン担当
                          </span>
                        )}
                      </div>
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

        <DialogFooter className="gap-2 sm:justify-between">
          {hasOverride ? (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={submitting}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              デフォルトに戻す
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
