"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFieldChangeLogs } from "@/lib/field-change-log.actions";

type FieldChangeLogEntry = {
  id: number;
  fieldName: string;
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
  note: string;
  createdAt: Date;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: number;
  title: string;
};

export function FieldChangeLogModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  title,
}: Props) {
  const [logs, setLogs] = useState<FieldChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entityId) return;
    setLoading(true);
    getFieldChangeLogs(entityType, entityId)
      .then((data) => setLogs(data))
      .finally(() => setLoading(false));
  }, [open, entityType, entityId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>{title} - 変更履歴</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              読み込み中...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              変更履歴はありません
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{log.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">変更前</span>
                      <div className="text-red-600 line-through">
                        {log.oldValue || "-"}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">変更後</span>
                      <div className="text-green-700 font-medium">
                        {log.newValue || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs bg-muted/50 rounded p-2">
                    <span className="text-muted-foreground">理由: </span>
                    {log.note}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
