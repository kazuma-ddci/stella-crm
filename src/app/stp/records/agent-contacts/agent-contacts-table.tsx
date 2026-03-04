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
import { AlertTriangle, X } from "lucide-react";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { FileDisplay, type FileInfo } from "@/components/multi-file-upload";
import { CompanyCodeLabel } from "@/components/company-code-label";
import { FilterableTableHead } from "@/components/filterable-table-head";
import { useColumnFilters } from "@/hooks/use-column-filters";

type Props = {
  data: Record<string, unknown>[];
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

function formatDateOnly(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const FILTER_KEYS = [
  "agentLabel",
  "contactDateLabel",
  "contactMethodName",
  "contactCategoryName",
  "customerTypeLabels",
  "staffName",
  "customerParticipants",
];

const VALUE_EXTRACTORS: Record<string, (item: Record<string, unknown>) => string> = {
  agentLabel: (item) => {
    const code = item.agentCompanyCode as string | undefined;
    const name = item.agentName as string | undefined;
    return code && name ? `${code} ${name}` : name || code || "";
  },
  contactDateLabel: (item) => {
    const d = item.contactDate as string | undefined;
    return d ? formatDateOnly(d) : "";
  },
  contactMethodName: (item) => (item.contactMethodName as string) || "",
  contactCategoryName: (item) => (item.contactCategoryName as string) || "",
  customerTypeLabels: (item) => (item.customerTypeLabels as string) || "",
  staffName: (item) => (item.staffName as string) || "",
  customerParticipants: (item) => (item.customerParticipants as string) || "",
};

const FILTER_LABELS: Record<string, string> = {
  agentLabel: "代理店名",
  contactDateLabel: "接触日時",
  contactMethodName: "接触方法",
  contactCategoryName: "接触種別",
  customerTypeLabels: "プロジェクト",
  staffName: "担当者",
  customerParticipants: "先方参加者",
};

export function AgentContactsTable({ data }: Props) {
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
            <TableHead>議事録</TableHead>
            <TableHead>備考</TableHead>
            <TableHead>添付</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                {data.length === 0 ? "接触履歴がありません" : "フィルタ条件に一致するデータがありません"}
              </TableCell>
            </TableRow>
          ) : (
            filteredData.map((item) => (
              <TableRow key={item.id as number}>
                <TableCell className="whitespace-nowrap">
                  <CompanyCodeLabel code={item.agentCompanyCode as string} name={item.agentName as string} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(item.contactDate as string)}
                </TableCell>
                <TableCell>{(item.contactMethodName as string) || "-"}</TableCell>
                <TableCell>{(item.contactCategoryName as string) || "-"}</TableCell>
                <TableCell>{(item.customerTypeLabels as string) || "-"}</TableCell>
                <TableCell>
                  {item.hasMismatch ? (
                    <span className="text-amber-600">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />
                      {item.staffName as string}
                    </span>
                  ) : (
                    (item.staffName as string) || "-"
                  )}
                </TableCell>
                <TableCell>{(item.customerParticipants as string) || "-"}</TableCell>
                <TableCell>
                  <TextPreviewCell text={item.meetingMinutes as string | null} title="議事録" />
                </TableCell>
                <TableCell>
                  <TextPreviewCell text={item.note as string | null} title="備考" />
                </TableCell>
                <TableCell>
                  <FileDisplay files={(item.files as FileInfo[]) || []} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
