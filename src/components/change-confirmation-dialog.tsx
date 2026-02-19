"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ChangeItem = {
  fieldName: string;
  oldValue: string;
  newValue: string;
  requireNote?: boolean;
};

export type ChangeItemWithNote = ChangeItem & {
  note: string;
};

type ChangeConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: ChangeItem[];
  onConfirm: (changesWithNotes: ChangeItemWithNote[]) => void;
  loading?: boolean;
  warningMessage?: string;
};

// マウスホイールスクロールを手動で処理するコンポーネント
function ScrollableBox({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // コンテンツがスクロール可能な場合のみ処理
      if (el.scrollHeight > el.clientHeight) {
        e.stopPropagation();
        el.scrollTop += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: true });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div ref={ref} className={cn("overflow-y-auto", className)}>
      {children}
    </div>
  );
}

export function ChangeConfirmationDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  loading = false,
  warningMessage,
}: ChangeConfirmationDialogProps) {
  const [notes, setNotes] = useState<Record<number, string>>({});

  // ダイアログが開くたびにメモをリセット
  useEffect(() => {
    if (open) {
      setNotes({});
    }
  }, [open]);

  const hasRequiredNotes = changes.some((c) => c.requireNote);
  const allRequiredNotesFilled = changes.every(
    (c, i) => !c.requireNote || (notes[i] ?? "").trim().length > 0,
  );

  const handleConfirm = () => {
    const changesWithNotes: ChangeItemWithNote[] = changes.map((c, i) => ({
      ...c,
      note: (notes[i] ?? "").trim(),
    }));
    onConfirm(changesWithNotes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>変更内容の確認</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            以下の内容で更新します。よろしいですか？
          </p>
          {warningMessage && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">{warningMessage}</p>
            </div>
          )}
          {hasRequiredNotes && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                変更理由の入力が必要な項目があります。
              </p>
            </div>
          )}
          <ScrollableBox className="space-y-3 max-h-[60vh]">
            {changes.map((change, index) => (
              <div key={index} className="border rounded-md p-3 space-y-2">
                <div className="font-medium text-sm">{change.fieldName}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">変更前</div>
                    <ScrollableBox className="min-h-[100px] max-h-[200px] sm:max-h-[250px] p-3 bg-red-50 rounded border border-red-200">
                      <span className="text-red-600 line-through whitespace-pre-wrap break-words text-sm">
                        {change.oldValue || "-"}
                      </span>
                    </ScrollableBox>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">変更後</div>
                    <ScrollableBox className="min-h-[100px] max-h-[200px] sm:max-h-[250px] p-3 bg-green-50 rounded border border-green-200">
                      <span className="text-green-700 font-semibold whitespace-pre-wrap break-words text-sm">
                        {change.newValue || "-"}
                      </span>
                    </ScrollableBox>
                  </div>
                </div>
                {change.requireNote && (
                  <div className="mt-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      変更理由 <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={notes[index] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [index]: e.target.value }))
                      }
                      placeholder="変更理由を入力してください"
                      rows={2}
                      className="resize-none"
                    />
                    {(notes[index] ?? "").trim().length === 0 && (
                      <p className="text-xs text-red-500 mt-1">変更理由は必須です</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </ScrollableBox>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (hasRequiredNotes && !allRequiredNotesFilled)}
          >
            {loading ? "保存中..." : "保存する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
