"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { Download, Upload, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type {
  TransactionHistoryRow,
  HistoryFilterOptions,
  HistoryFilters,
} from "./actions";
import {
  getTransactionHistory,
  deleteTransaction,
  exportTransactionsCsv,
} from "./actions";

type Props = {
  initialTransactions: TransactionHistoryRow[];
  filterOptions: HistoryFilterOptions;
};

// ソースのBadge表示
function SourceBadge({ source }: { source: string }) {
  switch (source) {
    case "bank_csv":
      return <Badge variant="secondary">CSV</Badge>;
    case "moneyforward":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">MF</Badge>;
    case "manual":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">手動</Badge>;
    case "freee":
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">freee</Badge>;
    default:
      return <Badge variant="outline">{source}</Badge>;
  }
}

// 消込ステータスBadge
function ReconciliationBadge({ status }: { status: string }) {
  switch (status) {
    case "matched":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">消込済</Badge>;
    case "partial":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">一部消込</Badge>;
    case "excluded":
      return <Badge variant="secondary">対象外</Badge>;
    case "unmatched":
    default:
      return <Badge variant="outline">未消込</Badge>;
  }
}

// 年月選択肢を生成（直近24ヶ月）
function generateYearMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options;
}

export function HistoryTable({ initialTransactions, filterOptions }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isPending, startTransition] = useTransition();

  // フィルタ state
  const [yearMonth, setYearMonth] = useState<string>("");
  const [operatingCompanyId, setOperatingCompanyId] = useState<string>("all");
  const [bankAccountName, setBankAccountName] = useState<string>("all");
  const [direction, setDirection] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  const yearMonthOptions = generateYearMonthOptions();

  const buildFilters = useCallback(
    (overrides?: Partial<Record<string, string>>): HistoryFilters => {
      const ym = overrides?.yearMonth ?? yearMonth;
      const oc = overrides?.operatingCompanyId ?? operatingCompanyId;
      const ba = overrides?.bankAccountName ?? bankAccountName;
      const dir = overrides?.direction ?? direction;
      const src = overrides?.source ?? source;
      const search = overrides?.search ?? searchText;

      return {
        yearMonth: ym || undefined,
        operatingCompanyId: oc !== "all" ? Number(oc) : undefined,
        bankAccountName: ba !== "all" ? ba : undefined,
        direction: dir !== "all" ? dir : undefined,
        source: src !== "all" ? src : undefined,
        search: search || undefined,
      };
    },
    [yearMonth, operatingCompanyId, bankAccountName, direction, source, searchText]
  );

  const refetch = useCallback(
    (overrides?: Partial<Record<string, string>>) => {
      startTransition(async () => {
        try {
          const filters = buildFilters(overrides);
          const data = await getTransactionHistory(filters);
          setTransactions(data);
        } catch {
          toast.error("データの取得に失敗しました");
        }
      });
    },
    [buildFilters]
  );

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      switch (key) {
        case "yearMonth":
          setYearMonth(value);
          break;
        case "operatingCompanyId":
          setOperatingCompanyId(value);
          break;
        case "bankAccountName":
          setBankAccountName(value);
          break;
        case "direction":
          setDirection(value);
          break;
        case "source":
          setSource(value);
          break;
      }
      refetch({ [key]: value });
    },
    [refetch]
  );

  const handleSearch = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        refetch();
      }
    },
    [refetch]
  );

  const handleDelete = useCallback(
    (id: number) => {
      startTransition(async () => {
        const result = await deleteTransaction(id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("取引を削除しました");
        refetch();
      });
    },
    [refetch]
  );

  const handleExportCsv = useCallback(() => {
    startTransition(async () => {
      try {
        const filters = buildFilters();
        const csv = await exportTransactionsCsv(filters);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `入出金履歴_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSVをダウンロードしました");
      } catch {
        toast.error("CSVエクスポートに失敗しました");
      }
    });
  }, [buildFilters]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString();
  };

  // 集計
  const totalIncoming = transactions
    .filter((tx) => tx.direction === "incoming")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalOutgoing = transactions
    .filter((tx) => tx.direction === "outgoing")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-4">
      {/* フィルタバー */}
      <div className="flex flex-wrap items-end gap-3">
        {/* 年月 */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">年月</label>
          <Select
            value={yearMonth || "all"}
            onValueChange={(v) =>
              handleFilterChange("yearMonth", v === "all" ? "" : v)
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {yearMonthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 法人 */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">法人</label>
          <Select
            value={operatingCompanyId}
            onValueChange={(v) => handleFilterChange("operatingCompanyId", v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {filterOptions.operatingCompanies.map((oc) => (
                <SelectItem key={oc.id} value={String(oc.id)}>
                  {oc.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 銀行名 */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">銀行名</label>
          <Select
            value={bankAccountName}
            onValueChange={(v) => handleFilterChange("bankAccountName", v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {filterOptions.bankAccountNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 入金/出金 */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">区分</label>
          <Select
            value={direction}
            onValueChange={(v) => handleFilterChange("direction", v)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="incoming">入金</SelectItem>
              <SelectItem value="outgoing">出金</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ソース */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ソース</label>
          <Select
            value={source}
            onValueChange={(v) => handleFilterChange("source", v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="bank_csv">CSV</SelectItem>
              <SelectItem value="moneyforward">MoneyForward</SelectItem>
              <SelectItem value="manual">手動</SelectItem>
              <SelectItem value="freee">freee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* テキスト検索 */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">検索</label>
          <div className="flex items-center gap-1">
            <Input
              placeholder="取引先名・摘要で検索"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-[200px]"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleSearch}
              disabled={isPending}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/accounting/bank-transactions/import">
              <Upload className="h-4 w-4 mr-1" />
              CSVインポート
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isPending}
          >
            <Download className="h-4 w-4 mr-1" />
            CSVエクスポート
          </Button>
        </div>
      </div>

      {/* 集計サマリー */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">
          {transactions.length.toLocaleString()} 件
        </span>
        <span className="text-blue-600">
          入金合計: {formatAmount(totalIncoming)} 円
        </span>
        <span className="text-red-600">
          出金合計: {formatAmount(totalOutgoing)} 円
        </span>
      </div>

      {/* テーブル */}
      <div className="border rounded-lg overflow-auto max-h-[calc(100vh-320px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">日付</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">取引先</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">摘要</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap text-right">入金金額</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap text-right">出金金額</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap text-right">残高</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">メモ</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">法人名</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">銀行名</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">ソース</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap">消込</TableHead>
              <TableHead className="sticky top-0 bg-white z-20 whitespace-nowrap sticky right-0 z-30 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                  取引データがありません
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id} className="group/row">
                  <TableCell className="whitespace-nowrap">
                    {formatDate(tx.transactionDate)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {tx.counterpartyName}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {tx.description ?? "-"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {tx.direction === "incoming" ? (
                      <span className="text-blue-600 font-medium">
                        {formatAmount(tx.amount)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {tx.direction === "outgoing" ? (
                      <span className="text-red-600 font-medium">
                        {formatAmount(tx.amount)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {tx.balance !== null ? formatAmount(tx.balance) : "-"}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {tx.memo ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {tx.operatingCompany?.companyName ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {tx.bankAccountName ?? "-"}
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={tx.source} />
                  </TableCell>
                  <TableCell>
                    <ReconciliationBadge status={tx.reconciliationStatus} />
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>取引を削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>
                            {formatDate(tx.transactionDate)} / {tx.counterpartyName} / {formatAmount(tx.amount)}円
                            <br />
                            この操作は取り消せません。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(tx.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            削除する
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
