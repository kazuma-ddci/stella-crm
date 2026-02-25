"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Wallet,
  SplitSquareVertical,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AwaitingGroupItem } from "./actions";
import { batchUpdateGroupStatus } from "@/app/accounting/transactions/allocation-group-item-actions";

const STATUS_LABELS: Record<string, string> = {
  awaiting_accounting: "経理処理待ち",
  partially_paid: "一部入金",
  confirmed: "確認済み",
};

type Props = {
  data: AwaitingGroupItem[];
};

export function BatchCompleteClient({ data }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    skipped: { label: string; reason: string }[];
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "invoice" | "payment">("all");

  const filteredData = useMemo(() => {
    if (filter === "all") return data;
    return data.filter((d) => d.groupType === filter);
  }, [data, filter]);

  // サマリー
  const invoiceCount = data.filter((d) => d.groupType === "invoice").length;
  const paymentCount = data.filter((d) => d.groupType === "payment").length;
  const totalAmount = data.reduce((sum, d) => sum + (d.totalAmount ?? 0), 0);
  const warningCount = data.filter((d) => d.hasUnprocessedAllocations).length;

  const toggleSelect = (groupType: string, id: number) => {
    const key = `${groupType}:${id}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allKeys = filteredData.map((d) => `${d.groupType}:${d.id}`);
    setSelectedIds(new Set(allKeys));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchComplete = async () => {
    setLoading(true);
    setResult(null);
    try {
      const items = Array.from(selectedIds).map((key) => {
        const [groupType, idStr] = key.split(":");
        return {
          groupId: Number(idStr),
          groupType: groupType as "invoice" | "payment",
        };
      });

      const res = await batchUpdateGroupStatus(items, "paid");

      const skippedWithLabels = res.skipped.map((s) => {
        const item = data.find(
          (d) => d.id === s.groupId && d.groupType === s.groupType
        );
        return {
          label: item?.label ?? `${s.groupType}#${s.groupId}`,
          reason: s.reason,
        };
      });

      setResult({
        success: res.success.length,
        skipped: skippedWithLabels,
      });

      if (res.success.length > 0) {
        // 成功分の選択を解除
        const successKeys = new Set(
          res.success.map((s) => `${s.groupType}:${s.groupId}`)
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const key of successKeys) {
            next.delete(key);
          }
          return next;
        });
        router.refresh();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">一括完了</h1>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div className="text-sm text-muted-foreground">請求</div>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {invoiceCount}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <div className="text-sm text-muted-foreground">支払</div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {paymentCount}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">合計金額</div>
            <div className="text-2xl font-bold">
              ¥{totalAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <SplitSquareVertical className="h-4 w-4 text-amber-600" />
              <div className="text-sm text-muted-foreground">按分未処理</div>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {warningCount}件
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 結果表示 */}
      {result && (
        <Card>
          <CardContent className="pt-6">
            {result.success > 0 && (
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  {result.success}件を完了にしました
                </span>
              </div>
            )}
            {result.skipped.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">
                    {result.skipped.length}件はスキップされました
                  </span>
                </div>
                <div className="ml-7 space-y-0.5">
                  {result.skipped.map((s, i) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      {s.label}: {s.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* フィルタとアクション */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            すべて ({data.length})
          </Button>
          <Button
            variant={filter === "invoice" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("invoice")}
          >
            請求 ({invoiceCount})
          </Button>
          <Button
            variant={filter === "payment" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("payment")}
          >
            支払 ({paymentCount})
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            全選択
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            選択解除
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.size === 0 || loading}
            onClick={() => setShowConfirmDialog(true)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {selectedIds.size}件を完了にする
          </Button>
        </div>
      </div>

      {/* グループ一覧 */}
      {filteredData.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">
            経理処理待ちの請求・支払はありません
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            すべて処理されています。
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {filteredData.map((item) => {
            const key = `${item.groupType}:${item.id}`;
            const isSelected = selectedIds.has(key);

            return (
              <label
                key={key}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  isSelected ? "bg-blue-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(item.groupType, item.id)}
                  className="rounded"
                />

                {/* グループ種別バッジ */}
                <Badge
                  variant={
                    item.groupType === "invoice" ? "default" : "secondary"
                  }
                  className="w-12 justify-center"
                >
                  {item.groupType === "invoice" ? "請求" : "支払"}
                </Badge>

                {/* メイン情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {item.counterpartyName}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {item.label}
                    </span>
                    {item.projectName && (
                      <span className="text-xs text-muted-foreground">
                        [{item.projectName}]
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.operatingCompanyName}</span>
                    <span>
                      取引{item.transactionCount}件
                      {item.allocationItemCount > 0 &&
                        ` + 按分${item.allocationItemCount}件`}
                    </span>
                    <span>{item.createdAt}</span>
                  </div>
                </div>

                {/* 警告 */}
                {item.hasUnprocessedAllocations && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs">按分未完了</span>
                  </div>
                )}

                {/* ステータス */}
                <Badge
                  variant="outline"
                  className="text-xs"
                >
                  {STATUS_LABELS[item.status] ?? item.status}
                </Badge>

                {/* 金額 */}
                <div className="text-right text-sm min-w-[100px]">
                  <div className="font-medium">
                    ¥{(item.totalAmount ?? 0).toLocaleString()}
                  </div>
                  {item.taxAmount != null && (
                    <div className="text-xs text-muted-foreground">
                      税¥{item.taxAmount.toLocaleString()}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* 確認ダイアログ */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedIds.size}件を完了にしますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              選択された請求・支払のステータスを「入金完了」/「支払済み」に変更します。
              ステータス遷移が不可能なものはスキップされます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchComplete} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              完了にする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
