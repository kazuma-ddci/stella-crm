"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RateRow = {
  id: number;
  date: string;
  rate: number;
  source: string;
  createdAt: string;
};

type Props = {
  data: RateRow[];
};

const SOURCE_LABELS: Record<string, string> = {
  coingecko: "CoinGecko",
  manual: "手動入力",
};

export function UsdtRatesTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        レートデータがありません
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日付</TableHead>
            <TableHead className="text-right">レート (JPY)</TableHead>
            <TableHead>取得元</TableHead>
            <TableHead>登録日時</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.date}</TableCell>
              <TableCell className="text-right font-mono">
                {row.rate.toLocaleString("ja-JP", {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}
              </TableCell>
              <TableCell>{SOURCE_LABELS[row.source] ?? row.source}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {row.createdAt}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
