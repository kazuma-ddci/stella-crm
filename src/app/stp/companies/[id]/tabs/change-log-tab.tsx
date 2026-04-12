"use client";

import { useState, useEffect } from "react";
import { getFieldChangeLogs } from "@/lib/field-change-log.actions";
import { Loader2 } from "lucide-react";

type FieldChangeLogEntry = {
  id: number;
  fieldName: string;
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
  note: string;
  createdAt: Date;
};

export function ChangeLogTab({ stpCompanyId }: { stpCompanyId: number }) {
  const [logs, setLogs] = useState<FieldChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFieldChangeLogs("stp_company", stpCompanyId)
      .then((data) => setLogs(data))
      .finally(() => setLoading(false));
  }, [stpCompanyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        変更履歴はありません
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto">
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
          {log.note && (
            <div className="text-xs bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">理由: </span>
              {log.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
