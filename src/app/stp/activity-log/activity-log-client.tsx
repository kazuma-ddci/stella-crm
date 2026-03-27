"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ActivityLogEntry, ActivityLogResult } from "./actions";
import { getActivityLogs } from "./actions";

type Props = {
  initialData: ActivityLogResult;
  tableNames: { value: string; label: string }[];
  staffList: { id: number; name: string }[];
};

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

function timeAgo(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  return formatDate(isoStr);
}

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  create: { bg: "bg-green-50 border-green-200", text: "text-green-700", icon: "+" },
  update: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: "✎" },
  delete: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: "×" },
};

export function ActivityLogClient({ initialData, tableNames, staffList }: Props) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const pageSize = 50;
  const totalPages = Math.ceil(data.totalCount / pageSize);

  const fetchData = (
    newPage: number,
    overrides?: {
      table?: string;
      action?: string;
      staff?: string;
      start?: string;
      end?: string;
    }
  ) => {
    const t = overrides?.table ?? filterTable;
    const a = overrides?.action ?? filterAction;
    const s = overrides?.staff ?? filterStaff;
    const sd = overrides?.start ?? startDate;
    const ed = overrides?.end ?? endDate;

    startTransition(async () => {
      const result = await getActivityLogs(newPage, pageSize, {
        tableName: t !== "all" ? t : undefined,
        action: a !== "all" ? a : undefined,
        userId: s !== "all" ? parseInt(s, 10) : undefined,
        startDate: sd || undefined,
        endDate: ed || undefined,
      });
      setData(result);
      setPage(newPage);
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">アクティビティログ</h1>

      {/* フィルター */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          value={filterTable}
          onValueChange={(v) => { setFilterTable(v); fetchData(1, { table: v }); }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="種別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての種別</SelectItem>
            {tableNames.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterAction}
          onValueChange={(v) => { setFilterAction(v); fetchData(1, { action: v }); }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="操作" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての操作</SelectItem>
            <SelectItem value="create">作成</SelectItem>
            <SelectItem value="update">更新</SelectItem>
            <SelectItem value="delete">削除</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterStaff}
          onValueChange={(v) => { setFilterStaff(v); fetchData(1, { staff: v }); }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="操作者" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのスタッフ</SelectItem>
            {staffList.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); fetchData(1, { start: e.target.value }); }}
            className="w-[140px] text-xs"
          />
          <span className="text-gray-400 text-xs">〜</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); fetchData(1, { end: e.target.value }); }}
            className="w-[140px] text-xs"
          />
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {data.totalCount > 0
            ? `${data.totalCount}件中 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.totalCount)}件`
            : "0件"}
        </span>
      </div>

      {/* ログ一覧 */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isPending ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : data.entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            ログがありません
          </div>
        ) : (
          <div className="divide-y">
            {data.entries.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || isPending} onClick={() => fetchData(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || isPending} onClick={() => fetchData(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: ActivityLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;
  const style = ACTION_STYLES[entry.action] ?? ACTION_STYLES.update;
  const displayText = entry.summary ?? `${entry.tableLabel} #${entry.recordId} を${entry.actionLabel}`;

  return (
    <div
      className={cn("px-4 py-3 hover:bg-gray-50 transition-colors", hasChanges && "cursor-pointer")}
      onClick={() => hasChanges && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border shrink-0 mt-0.5", style.bg, style.text)}>
          {style.icon}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{displayText}</span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", style.bg, style.text)}>
              {entry.actionLabel}
            </span>
            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {entry.tableLabel}
            </span>
          </div>

          {expanded && hasChanges && (
            <div className="mt-2 text-xs space-y-1 bg-gray-50 rounded p-3 border">
              {Object.entries(entry.changes!).map(([key, value]) => {
                if (value && typeof value === "object" && "old" in (value as Record<string, unknown>) && "new" in (value as Record<string, unknown>)) {
                  const { old: oldVal, new: newVal } = value as { old: unknown; new: unknown };
                  return (
                    <div key={key} className="flex items-start gap-1.5">
                      <span className="text-gray-500 font-medium shrink-0 min-w-[60px]">{key}:</span>
                      {oldVal !== null && oldVal !== "" ? (
                        <>
                          <span className="text-red-500 line-through">{String(oldVal)}</span>
                          <span className="text-gray-400">→</span>
                        </>
                      ) : null}
                      <span className="text-green-600 font-medium">{String(newVal ?? "–")}</span>
                    </div>
                  );
                }
                return (
                  <div key={key} className="flex items-start gap-1.5">
                    <span className="text-gray-500 font-medium">{key}:</span>
                    <span className="text-gray-700">{String(value ?? "–")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-medium text-gray-700">{entry.staffName ?? "不明"}</div>
          <div className="text-[10px] text-gray-400">{timeAgo(entry.createdAt)}</div>
        </div>

        {hasChanges && (
          <span className={cn("text-gray-300 text-[10px] shrink-0 mt-1 transition-transform", expanded && "rotate-90")}>▶</span>
        )}
      </div>
    </div>
  );
}
