"use client";

import { useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChangeItem = {
  fieldName: string;
  oldValue: string;
  newValue: string;
};

type ChangeConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: ChangeItem[];
  onConfirm: () => void;
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "保存中..." : "保存する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
