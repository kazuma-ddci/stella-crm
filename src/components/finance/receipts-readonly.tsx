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
};

export function ReceiptsReadonly({ mode, totalAmount, records, status, recordTotal }: Props) {
  const dateLabel = mode === "invoice" ? "入金日" : "支払日";
  const amountLabel = mode === "invoice" ? "入金額" : "支払額";
  const recordLabel = mode === "invoice" ? "入金記録" : "支払記録";
  const actionLabel = mode === "invoice" ? "入金" : "支払";

  const target = totalAmount ?? 0;
  const remaining = target - recordTotal;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{recordLabel}（経理側で管理）</h3>
        <StatusBadge status={status} count={records.length} actionLabel={actionLabel} />
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

function StatusBadge({
  status,
  count,
  actionLabel,
}: {
  status: Status;
  count: number;
  actionLabel: string;
}) {
  if (status === "none") {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
        未{actionLabel}
      </Badge>
    );
  }
  if (status === "complete") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        <Check className="h-3 w-3 mr-0.5" />
        {actionLabel}完了 ({count}件)
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs">
        {actionLabel}一部のみ ({count}件)
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 text-xs">
      {actionLabel}過剰 ({count}件)
    </Badge>
  );
}
