"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Copy, Check, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";
import { getHojoCustomerOrigin } from "@/lib/hojo/customer-domain";

type LinkStatus = "linked" | "multi-unlinked" | "no-candidate";

type RowData = {
  id: number;
  tradeName: string;
  fullName: string;
  phone: string;
  email: string;
  employeeCount: string;
  bankType: string;
  uid: string;
  submittedAt: string;
  confirmedAt: string | null;
  linkStatus: LinkStatus;
};

type Props = { data: RowData[] };

function LinkStatusBadge({ status, confirmed }: { status: LinkStatus; confirmed: boolean }) {
  if (confirmed) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        確定済
      </Badge>
    );
  }
  if (status === "multi-unlinked") {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3 mr-1" />
        紐付け選択必要
      </Badge>
    );
  }
  if (status === "no-candidate") {
    return (
      <Badge variant="outline" className="border-gray-300 text-gray-500 whitespace-nowrap">
        候補なし
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 whitespace-nowrap">
      <Link2 className="h-3 w-3 mr-1" />
      紐付け済
    </Badge>
  );
}

export function SubmissionsTable({ data }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [formUrl, setFormUrl] = useState("/form/hojo-business-plan");

  useEffect(() => {
    setFormUrl(`${getHojoCustomerOrigin()}/form/hojo-business-plan`);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${formUrl}?uid=`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="text-sm font-medium mb-1.5">情報回収フォーム 参考URL</p>
        <p className="text-xs text-muted-foreground mb-2">使用時はURLの末尾にuidを付与してください（例: ?uid=abc123）</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-white rounded px-3 py-2 border break-all">{formUrl}?uid=</code>
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? <><Check className="h-4 w-4 mr-1 text-green-500" />コピー済</> : <><Copy className="h-4 w-4 mr-1" />コピー</>}
          </Button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">フォーム回答がまだありません</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">No.</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>屋号</TableHead>
                <TableHead>氏名</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>従業員数</TableHead>
                <TableHead>振込先</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>回答日時</TableHead>
                <TableHead className="w-16 sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={r.id} className="group/row">
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <LinkStatusBadge status={r.linkStatus} confirmed={!!r.confirmedAt} />
                  </TableCell>
                  <TableCell className="font-medium">{r.tradeName}</TableCell>
                  <TableCell>{r.fullName || "-"}</TableCell>
                  <TableCell>{r.phone || "-"}</TableCell>
                  <TableCell>{r.email || "-"}</TableCell>
                  <TableCell>{r.employeeCount || "-"}</TableCell>
                  <TableCell>{r.bankType || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.uid || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(r.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/hojo/form-submissions/${r.id}`)}>
                      <Pencil className="h-4 w-4" />
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
