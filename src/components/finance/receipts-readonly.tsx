"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check } from "lucide-react";

type Mode = "invoice" | "payment";
type Status = "none" | "partial" | "complete" | "over";
type ManualPaymentStatus = "unpaid" | "partial" | "completed";

type RecordItem = {
  id: number;
  date: string;            // YYYY-MM-DD
  amount: number;
  comment: string | null;
  createdByName: string;
};

type Props = {
  mode: Mode;
  totalAmount: number | null;
  records: RecordItem[];
  status: Status;
  recordTotal: number;
  manualPaymentStatus: ManualPaymentStatus; // 経理判断（メイン表示）
};

export function ReceiptsReadonly({
  mode,
  totalAmount,
  records,
  status,
  recordTotal,
  manualPaymentStatus,
}: Props) {
  const dateLabel = mode === "invoice" ? "入金日" : "支払日";
  const amountLabel = mode === "invoice" ? "入金額" : "支払額";
  const recordLabel = mode === "invoice" ? "入金記録" : "支払記録";
  const actionLabel = mode === "invoice" ? "入金" : "支払";

  const target = totalAmount ?? 0;
  const remaining = target - recordTotal;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">{recordLabel}（経理側で管理）</h3>
        <div className="flex items-center gap-2">
          {/* メインバッジ: 経理判断 (manualPaymentStatus) */}
          <ManualStatusBadge status={manualPaymentStatus} actionLabel={actionLabel} />
          {/* 参考: 自動集計 (記録合計と請求金額の比較) */}
          <StatusBadge status={status} count={records.length} />
        </div>
      </div>

      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">合計金額</div>
            <div className="font-medium text-sm">¥{target.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{actionLabel}済合計</div>
            <div className="font-medium text-sm">¥{recordTotal.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">残額</div>
            <div
              className={
                "font-medium text-sm " +
                (remaining > 0
                  ? "text-red-600"
                  : remaining < 0
                    ? "text-yellow-700"
                    : "text-green-700")
              }
            >
              ¥{remaining.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">
          まだ{recordLabel}はありません
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32 text-xs">{dateLabel}</TableHead>
              <TableHead className="w-32 text-right text-xs">{amountLabel}</TableHead>
              <TableHead className="text-xs">コメント</TableHead>
              <TableHead className="w-32 text-xs">記録者</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  {new Date(r.date).toLocaleDateString("ja-JP")}
                </TableCell>
                <TableCell className="text-right text-xs font-medium">
                  ¥{r.amount.toLocaleString()}
                </TableCell>
                <TableCell className="text-xs whitespace-pre-wrap">
                  {r.comment ?? <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.createdByName}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// 経理判断バッジ（メイン表示）
function ManualStatusBadge({
  status,
  actionLabel,
}: {
  status: ManualPaymentStatus;
  actionLabel: string;
}) {
  if (status === "completed") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
        <Check className="h-3 w-3 mr-0.5" />
        {actionLabel}完了
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs">
        一部{actionLabel}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
      未{actionLabel}
    </Badge>
  );
}

// 自動集計バッジ（参考情報）— 経理判断バッジ (ManualStatusBadge) と区別するため
// 「集計:」プレフィックスをつけて、記録合計と請求金額の自動比較結果であることを明示
function StatusBadge({
  status,
  count,
}: {
  status: Status;
  count: number;
}) {
  if (status === "none") {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
        集計: 記録なし
      </Badge>
    );
  }
  if (status === "complete") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        集計: 一致 ({count}件)
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        集計: 不足 ({count}件)
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 text-xs">
      集計: 超過 ({count}件)
    </Badge>
  );
}
