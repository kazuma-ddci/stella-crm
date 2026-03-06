"use client";

import { useRef, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { FilterableTableHead } from "@/components/filterable-table-head";
import { useColumnFilters } from "@/hooks/use-column-filters";
import { CompanyCodeLabel } from "@/components/company-code-label";

type Props = {
  data: Record<string, unknown>[];
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  stage_change: "パイプライン変更",
  target_set: "目標設定",
  target_achieved: "目標達成",
  manual: "手動登録",
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const FILTER_KEYS = [
  "companyName",
  "eventTypeLabel",
  "fromStageName",
  "toStageName",
  "changedBy",
];

const VALUE_EXTRACTORS: Record<string, (item: Record<string, unknown>) => string> = {
  companyName: (item) => {
    const code = (item.companyCode as string) || "";
    const name = (item.companyName as string) || "";
    return code ? `${code} ${name}` : name;
  },
  eventTypeLabel: (item) => EVENT_TYPE_LABELS[item.eventType as string] || (item.eventType as string) || "",
  fromStageName: (item) => (item.fromStageName as string) || "",
  toStageName: (item) => (item.toStageName as string) || "",
  changedBy: (item) => (item.changedBy as string) || "",
};

const FILTER_LABELS: Record<string, string> = {
  companyName: "企業名",
  eventTypeLabel: "イベント種別",
  fromStageName: "変更前パイプライン",
  toStageName: "変更後パイプライン",
  changedBy: "変更者",
};

export function StageHistoriesTable({ data }: Props) {
  const {
    filters,
    filteredData,
    getUniqueValues,
    setFilter,
    clearAllFilters,
    activeFilterCount,
  } = useColumnFilters(data, FILTER_KEYS, VALUE_EXTRACTORS);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState<string | undefined>();

  useEffect(() => {
    const calc = () => {
      if (tableContainerRef.current) {
        const top = tableContainerRef.current.getBoundingClientRect().top;
        const bottomMargin = 24;
        setTableMaxHeight(`${window.innerHeight - top - bottomMargin}px`);
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return (
    <div className="space-y-2">
      {/* フィルタ状況サマリー */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{filteredData.length} / {data.length} 件</span>
        {activeFilterCount > 0 && (
          <>
            <span>（{activeFilterCount}列でフィルタ中）</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={clearAllFilters}>
              <X className="h-3 w-3 mr-1" />
              フィルタ解除
            </Button>
          </>
        )}
      </div>

      {/* テーブル */}
      <Table containerRef={tableContainerRef} containerClassName="overflow-auto" containerStyle={{ maxHeight: tableMaxHeight }}>
        <TableHeader>
          <TableRow>
            {FILTER_KEYS.map((key) => (
              <FilterableTableHead
                key={key}
                label={FILTER_LABELS[key]}
                filterKey={key}
                allValues={getUniqueValues(key)}
                selectedValues={filters[key]}
                onFilterChange={setFilter}
              />
            ))}
            <TableHead>目標日</TableHead>
            <TableHead>記録日時</TableHead>
            <TableHead>備考</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {data.length === 0 ? "履歴がありません" : "フィルタ条件に一致するデータがありません"}
              </TableCell>
            </TableRow>
          ) : (
            filteredData.map((item) => (
              <TableRow key={item.id as number}>
                <TableCell className="whitespace-nowrap">
                  {(item.companyCode as string)
                    ? <CompanyCodeLabel code={item.companyCode as string} name={(item.companyName as string) || "-"} />
                    : (item.companyName as string) || "-"
                  }
                </TableCell>
                <TableCell>{EVENT_TYPE_LABELS[item.eventType as string] || (item.eventType as string) || "-"}</TableCell>
                <TableCell>{(item.fromStageName as string) || "-"}</TableCell>
                <TableCell>{(item.toStageName as string) || "-"}</TableCell>
                <TableCell>{(item.changedBy as string) || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(item.targetDate as string | null)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(item.recordedAt as string)}</TableCell>
                <TableCell>{(item.note as string) || "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
