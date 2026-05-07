"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Upload, Link2, Ban, Download, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import type {
  StatementCompanyOption,
  StatementEntryRow,
  LinkStatusCounts,
} from "./actions";
import {
  updateStaffMemo,
  markEntryExcluded,
  unmarkEntryExcluded,
} from "./actions";
import {
  EXCLUDED_REASONS,
  EXCLUDED_REASON_LABELS,
  type ExcludedReason,
} from "./constants";
import { exportStatementsCsv } from "./export-actions";
import { LinkEntryModal } from "./link-modal";
import { ImportModal } from "./import-modal";
import { ManualEntryModal } from "./manual-entry-modal";

type FilterValue = "all" | "unlinked" | "partial" | "complete" | "excluded";

type Props = {
  companies: StatementCompanyOption[];
  selectedCompanyId: number | null;
  selectedBankAccountId: number | null;
  page: number;
  pageSize: number;
  counts: LinkStatusCounts;
  filter: FilterValue;
  total: number;
  rows: StatementEntryRow[];
  from: string | null;
  to: string | null;
  q: string | null;
};

export function StatementsTable({
  companies,
  selectedCompanyId,
  selectedBankAccountId,
  page,
  pageSize,
  total,
  rows,
  counts,
  filter,
  from,
  to,
  q,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(q ?? "");
  const [exporting, setExporting] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );
  const bankAccounts = selectedCompany?.bankAccounts ?? [];

  const updateUrl = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === "") {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    startTransition(() => {
      router.push(`/accounting/statements?${next.toString()}`);
    });
  };

  const handleCompanyChange = (v: string) => {
    updateUrl({ company: v, account: null, page: null });
  };

  const handleAccountChange = (v: string) => {
    updateUrl({ account: v, page: null });
  };

  const handleFilterChange = (v: FilterValue) => {
    updateUrl({ filter: v === "all" ? null : v, page: null });
  };

  const handleFromChange = (v: string) => {
    updateUrl({ from: v || null, page: null });
  };
  const handleToChange = (v: string) => {
    updateUrl({ to: v || null, page: null });
  };
  const handleSearchSubmit = () => {
    updateUrl({ q: searchInput.trim() || null, page: null });
  };
  const clearAllFilters = () => {
    setSearchInput("");
    updateUrl({ q: null, from: null, to: null, page: null });
  };

  const handleExportCsv = async () => {
    if (!selectedBankAccountId) return;
    setExporting(true);
    try {
      const res = await exportStatementsCsv({
        operatingCompanyBankAccountId: selectedBankAccountId,
        linkStatus: filter,
        from,
        to,
        q,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // BOM 付き UTF-8
      const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), res.data.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>表示する法人と銀行口座</CardTitle>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => setManualOpen(true)}
              size="sm"
              variant="outline"
              disabled={!selectedCompanyId || !selectedBankAccountId}
            >
              <Plus className="h-4 w-4 mr-1" />
              手動追加
            </Button>
            <Button onClick={() => setImportOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-1" />
              CSV取込
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>法人</Label>
              <Select
                value={
                  selectedCompanyId ? String(selectedCompanyId) : ""
                }
                onValueChange={handleCompanyChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="法人を選択" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCompany && bankAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              この法人に銀行口座が登録されていません
            </p>
          )}

          {selectedCompany && bankAccounts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">銀行口座</Label>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {bankAccounts.map((b) => {
                  const active = selectedBankAccountId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleAccountChange(String(b.id))}
                      className={[
                        "rounded-xl border px-4 py-3 text-left transition shadow-xs",
                        "hover:border-slate-400 hover:bg-slate-50",
                        active
                          ? "border-slate-900 bg-white ring-2 ring-slate-900/10"
                          : "border-slate-200 bg-slate-50/70",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">
                            {b.bankName}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {b.branchName} / {b.accountType}
                          </div>
                        </div>
                        {active && (
                          <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-medium text-white">
                            選択中
                          </span>
                        )}
                      </div>
                      <div className="mt-2 font-mono text-xs tracking-wide text-slate-600">
                        {b.accountNumber}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>取引明細</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>表示中 {total} 件</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedBankAccountId || exporting}
              onClick={handleExportCsv}
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              CSV出力
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 期間絞込・摘要検索 */}
          {selectedCompanyId && selectedBankAccountId && (
            <div className="flex flex-wrap items-end gap-2 mb-4">
              <div className="space-y-1">
                <Label className="text-xs">開始日</Label>
                <Input
                  type="date"
                  value={from ?? ""}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">終了日</Label>
                <Input
                  type="date"
                  value={to ?? ""}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label className="text-xs">摘要・メモで検索</Label>
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSearchSubmit();
                      }}
                      placeholder="キーワード"
                      className="h-8 text-xs pl-7"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={handleSearchSubmit}
                  >
                    検索
                  </Button>
                </div>
              </div>
              {(from || to || q) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={clearAllFilters}
                >
                  条件クリア
                </Button>
              )}
            </div>
          )}

          {/* 紐付け状態フィルタ */}
          {selectedCompanyId && selectedBankAccountId && (
            <div className="flex flex-wrap gap-2 mb-4">
              <FilterChip
                active={filter === "all"}
                count={counts.all}
                onClick={() => handleFilterChange("all")}
                label="すべて"
                color="default"
              />
              <FilterChip
                active={filter === "unlinked"}
                count={counts.unlinked}
                onClick={() => handleFilterChange("unlinked")}
                label="未紐付け"
                color="red"
              />
              <FilterChip
                active={filter === "partial"}
                count={counts.partial}
                onClick={() => handleFilterChange("partial")}
                label="一部紐付け"
                color="amber"
              />
              <FilterChip
                active={filter === "complete"}
                count={counts.complete}
                onClick={() => handleFilterChange("complete")}
                label="紐付け完了"
                color="green"
              />
              <FilterChip
                active={filter === "excluded"}
                count={counts.excluded}
                onClick={() => handleFilterChange("excluded")}
                label="除外"
                color="gray"
              />
            </div>
          )}

          {!selectedCompanyId || !selectedBankAccountId ? (
            <p className="text-sm text-muted-foreground">
              法人と銀行口座を選択してください
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              この銀行口座にはまだ取引が取り込まれていません
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-1 w-1"></th>
                      <th className="py-2 px-2 whitespace-nowrap">日付</th>
                      <th className="py-2 px-2">内容</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">
                        入金
                      </th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">
                        出金
                      </th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">
                        残高
                      </th>
                      <th className="py-2 px-2">CSVメモ</th>
                      <th className="py-2 px-2 min-w-[180px]">スタッフメモ</th>
                      <th className="py-2 px-2 whitespace-nowrap">紐付け / 除外</th>
                      <th className="py-2 px-2 whitespace-nowrap">取込元</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <EntryRow key={r.id} row={r} />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isPending}
                    onClick={() =>
                      updateUrl({ page: String(Math.max(1, page - 1)) })
                    }
                  >
                    前へ
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isPending}
                    onClick={() => updateUrl({ page: String(page + 1) })}
                  >
                    次へ
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        companies={companies}
        defaultCompanyId={selectedCompanyId}
        defaultBankAccountId={selectedBankAccountId}
      />
      <ManualEntryModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        operatingCompanyId={selectedCompanyId}
        operatingCompanyBankAccountId={selectedBankAccountId}
      />
    </div>
  );
}

function formatYen(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("ja-JP");
}

function getImportSourceLabel(row: StatementEntryRow): string {
  if (row.importFormatId === "manual_standard") {
    return row.importFileName.startsWith("手動追加_") ? "手動追加" : "標準CSV";
  }
  return "銀行CSV";
}

function EntryRow({ row }: { row: StatementEntryRow }) {
  const router = useRouter();
  const [memo, setMemo] = useState(row.staffMemo ?? "");
  const [savedMemo, setSavedMemo] = useState(row.staffMemo ?? "");
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);

  const onBlur = async () => {
    if (memo === savedMemo) return;
    setSaving(true);
    try {
      const res = await updateStaffMemo(row.id, memo === "" ? null : memo);
      if (!res.ok) {
        toast.error(res.error);
        setMemo(savedMemo);
        return;
      }
      setSavedMemo(memo);
    } finally {
      setSaving(false);
    }
  };

  const handleUnmark = async () => {
    const res = await unmarkEntryExcluded(row.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("除外を解除しました");
    router.refresh();
  };

  const statusBarColor = row.excluded
    ? "bg-gray-300"
    : row.linkStatus === "complete"
      ? "bg-green-500"
      : row.linkStatus === "partial"
        ? "bg-amber-400"
        : row.linkStatus === "unlinked"
          ? "bg-red-400"
          : "bg-gray-200";

  return (
    <tr className="border-b hover:bg-muted/30 align-top">
      <td className="py-0 px-0 w-1">
        <div className={`w-1 h-full min-h-[2.5rem] ${statusBarColor}`} />
      </td>
      <td className="py-2 px-2 whitespace-nowrap">{row.transactionDate}</td>
      <td className="py-2 px-2">
        {row.description}
        {row.excluded && (
          <Badge
            variant="outline"
            className="ml-2 text-[10px] border-gray-300 text-gray-600"
          >
            除外{row.excludedReason ? `: ${EXCLUDED_REASON_LABELS[row.excludedReason]}` : ""}
          </Badge>
        )}
      </td>
      <td className="py-2 px-2 text-right whitespace-nowrap text-green-700">
        {formatYen(row.incomingAmount)}
      </td>
      <td className="py-2 px-2 text-right whitespace-nowrap text-red-700">
        {formatYen(row.outgoingAmount)}
      </td>
      <td className="py-2 px-2 text-right whitespace-nowrap">
        {formatYen(row.balance)}
      </td>
      <td className="py-2 px-2 text-muted-foreground">
        {row.csvMemo ?? ""}
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={onBlur}
            placeholder="メモを入力"
            className="h-8 text-xs"
            disabled={saving}
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </td>
      <td className="py-2 px-2 whitespace-nowrap">
        {row.excluded ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleUnmark}
          >
            除外解除
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={row.linkCount > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-7 text-xs"
              >
                <Link2 className="h-3 w-3 mr-1" />
                {row.linkCount > 0
                  ? `${row.linkCount}件 / ${row.linkedAmount.toLocaleString("ja-JP")}円`
                  : "紐付け"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLinkOpen(true)}>
                <Link2 className="h-3 w-3 mr-2" />
                紐付けを編集
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setExcludeOpen(true)}
                disabled={row.linkCount > 0}
              >
                <Ban className="h-3 w-3 mr-2" />
                除外（紐付け不要）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
      <td className="py-2 px-2 whitespace-nowrap">
        <Badge variant="outline" className="mb-1 text-[10px] font-medium">
          {getImportSourceLabel(row)}
        </Badge>
        <div className="max-w-[180px] truncate text-[11px] text-muted-foreground" title={row.importFileName}>
          {row.importFileName}
        </div>
      </td>
      <td className="hidden" aria-hidden>
        <LinkEntryModal
          open={linkOpen}
          onOpenChange={setLinkOpen}
          entry={{
            id: row.id,
            transactionDate: row.transactionDate,
            description: row.description,
            incomingAmount: row.incomingAmount,
            outgoingAmount: row.outgoingAmount,
          }}
          onSaved={() => router.refresh()}
        />
        <ExcludeEntryDialog
          open={excludeOpen}
          onOpenChange={setExcludeOpen}
          entryId={row.id}
          onSuccess={() => router.refresh()}
        />
      </td>
    </tr>
  );
}

function ExcludeEntryDialog({
  open,
  onOpenChange,
  entryId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: number;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState<ExcludedReason>("fee");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await markEntryExcluded(entryId, reason, note || null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("取引を除外しました");
      onOpenChange(false);
      setNote("");
      setReason("fee");
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>取引を除外（紐付け不要）</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">除外理由</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as ExcludedReason)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCLUDED_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {EXCLUDED_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">メモ（任意）</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="補足があれば入力"
              className="text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            除外する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({
  active,
  count,
  onClick,
  label,
  color,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  label: string;
  color: "default" | "red" | "amber" | "green" | "gray";
}) {
  const colorClasses = {
    default: active
      ? "bg-gray-900 text-white"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
    red: active
      ? "bg-red-600 text-white"
      : "bg-red-50 text-red-700 hover:bg-red-100",
    amber: active
      ? "bg-amber-600 text-white"
      : "bg-amber-50 text-amber-800 hover:bg-amber-100",
    green: active
      ? "bg-green-600 text-white"
      : "bg-green-50 text-green-700 hover:bg-green-100",
    gray: active
      ? "bg-gray-500 text-white"
      : "bg-gray-50 text-gray-600 hover:bg-gray-100",
  }[color];

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${colorClasses}`}
    >
      {label} <span className="ml-1 font-semibold">{count}</span>
    </button>
  );
}
