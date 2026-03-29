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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type RecordData = {
  id: number;
  lineFriendId: number;
  lineName: string;
  referrer: string;
  vendorName: string;
  applicantName: string;
  statusName: string;
  detailMemo: string;
  formAnswerDate: string | null;
  paymentReceivedDate: string | null;
  paymentReceivedAmount: number | null;
  subsidyReceivedDate: string | null;
  vendorMemo: string;
};

type Props = {
  data: RecordData[];
  vendorToken: string;
};

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return `¥${amount.toLocaleString()}`;
}

export function VendorPageClient({ data, vendorToken }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (record: RecordData) => {
    setEditingId(record.id);
    setEditMemo(record.vendorMemo);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMemo("");
  };

  const saveMemo = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/public/hojo/vendor-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, vendorMemo: editMemo, token: vendorToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }

      toast.success("メモを保存しました");
      setEditingId(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          該当するデータがありません
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">LINE番号</TableHead>
            <TableHead className="whitespace-nowrap">LINE名</TableHead>
            <TableHead className="whitespace-nowrap">紹介者</TableHead>
            <TableHead className="whitespace-nowrap">ベンダー名</TableHead>
            <TableHead className="whitespace-nowrap">申請者名</TableHead>
            <TableHead className="whitespace-nowrap">ステータス</TableHead>
            <TableHead className="whitespace-nowrap">詳細メモ</TableHead>
            <TableHead className="whitespace-nowrap">フォーム回答日</TableHead>
            <TableHead className="whitespace-nowrap">着金日</TableHead>
            <TableHead className="whitespace-nowrap">着金額</TableHead>
            <TableHead className="whitespace-nowrap">助成金着金日</TableHead>
            <TableHead className="whitespace-nowrap min-w-[250px]">ベンダー側メモ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.lineFriendId}</TableCell>
              <TableCell>{row.lineName}</TableCell>
              <TableCell>{row.referrer}</TableCell>
              <TableCell>{row.vendorName}</TableCell>
              <TableCell>{row.applicantName}</TableCell>
              <TableCell>{row.statusName}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={row.detailMemo}>
                {row.detailMemo || "-"}
              </TableCell>
              <TableCell>{row.formAnswerDate || "-"}</TableCell>
              <TableCell>{row.paymentReceivedDate || "-"}</TableCell>
              <TableCell>{formatCurrency(row.paymentReceivedAmount)}</TableCell>
              <TableCell>{row.subsidyReceivedDate || "-"}</TableCell>
              <TableCell>
                {editingId === row.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      rows={3}
                      className="min-w-[200px]"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => saveMemo(row.id)}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <span className="whitespace-pre-wrap text-sm">
                      {row.vendorMemo || "-"}
                    </span>
                    <button
                      onClick={() => startEdit(row)}
                      className="text-gray-400 hover:text-blue-600 shrink-0 mt-0.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
