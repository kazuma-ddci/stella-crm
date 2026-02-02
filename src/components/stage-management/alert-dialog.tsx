"use client";

import { StageAlert } from "@/lib/stage-transition/types";
import { ALERT_COLORS } from "@/lib/stage-transition/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface StageAlertDialogProps {
  alerts: StageAlert[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function StageAlertDialog({
  alerts,
  open,
  onOpenChange,
  note,
  onNoteChange,
  onConfirm,
  loading,
}: StageAlertDialogProps) {
  if (alerts.length === 0) return null;

  // 最も深刻なアラートを取得
  const primaryAlert = alerts[0]; // アラートは深刻度順にソートされている前提
  const colors = ALERT_COLORS[primaryAlert.severity];

  // 理由入力が必要なアラートがあるか
  const requiresNote = alerts.some((a) => a.requiresNote);

  // ERRORの場合は保存不可
  const hasError = alerts.some((a) => a.severity === "ERROR");

  const getTitle = () => {
    switch (primaryAlert.severity) {
      case "ERROR":
        return "エラー";
      case "WARNING":
        return "確認が必要です";
      case "INFO":
        return "お知らせ";
    }
  };

  const getConfirmText = () => {
    if (hasError) return "閉じる";
    if (requiresNote) return "理由を入力して保存";
    return "確認して保存";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{colors.icon}</span>
            <span>{getTitle()}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={cn(
                "p-3 rounded-md border",
                ALERT_COLORS[alert.severity].bg,
                ALERT_COLORS[alert.severity].border,
                ALERT_COLORS[alert.severity].text
              )}
            >
              <p className="text-sm">{alert.message}</p>
            </div>
          ))}

          {requiresNote && !hasError && (
            <div className="space-y-2">
              <Label htmlFor="alert-note">
                変更理由
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                id="alert-note"
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="変更理由を入力してください..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          {!hasError && (
            <Button
              onClick={onConfirm}
              disabled={loading || (requiresNote && !note.trim())}
            >
              {loading ? "保存中..." : getConfirmText()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * インラインでアラートを表示するコンポーネント
 */
interface InlineAlertProps {
  alerts: StageAlert[];
}

export function InlineAlert({ alerts }: InlineAlertProps) {
  if (alerts.length === 0) return null;

  // ERRORのみ表示
  const errorAlerts = alerts.filter((a) => a.severity === "ERROR");
  if (errorAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {errorAlerts.map((alert, index) => {
        const colors = ALERT_COLORS[alert.severity];
        return (
          <div
            key={index}
            className={cn(
              "p-3 rounded-md border text-sm",
              colors.bg,
              colors.border,
              colors.text
            )}
          >
            <span className="mr-2">{colors.icon}</span>
            {alert.message}
          </div>
        );
      })}
    </div>
  );
}
