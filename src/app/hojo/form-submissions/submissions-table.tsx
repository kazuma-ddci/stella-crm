"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Copy, Check } from "lucide-react";

type RowData = {
  id: number;
  companyName: string;
  businessType: string;
  industry: string;
  phone: string;
  bankType: string;
  uid: string;
  submittedAt: string;
};

type Props = {
  data: RowData[];
};

export function SubmissionsTable({ data }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const formUrl = typeof window !== "undefined"
    ? `${window.location.origin}/form/hojo-business-plan`
    : "/form/hojo-business-plan";

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${formUrl}?uid=`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="space-y-4">
      {/* フォームURL */}
      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="text-sm font-medium mb-1.5">情報回収フォーム 参考URL</p>
        <p className="text-xs text-muted-foreground mb-2">使用時はURLの末尾に uid を付与してください（例: ?uid=abc123）</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-white rounded px-3 py-2 border break-all">
            {formUrl}?uid=
          </code>
          <Button variant="outline" size="sm" onClick={handleCopyUrl} className="shrink-0">
            {copied ? (
              <><Check className="h-4 w-4 mr-1 text-green-500" />コピー済</>
            ) : (
              <><Copy className="h-4 w-4 mr-1" />コピー</>
            )}
          </Button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          フォーム回答がまだありません
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No.</TableHead>
                <TableHead>先方</TableHead>
                <TableHead>事業形態</TableHead>
                <TableHead>業種</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>振込先</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>回答日時</TableHead>
                <TableHead className="w-20 sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={row.id} className="group/row">
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{row.companyName}</TableCell>
                  <TableCell>{row.businessType || "-"}</TableCell>
                  <TableCell>{row.industry || "-"}</TableCell>
                  <TableCell>{row.phone || "-"}</TableCell>
                  <TableCell>{row.bankType || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.uid || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(row.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/hojo/form-submissions/${row.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
