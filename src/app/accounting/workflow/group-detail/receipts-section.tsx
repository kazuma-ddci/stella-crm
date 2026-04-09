"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import {
  listInvoiceGroupReceipts,
  addInvoiceGroupReceipt,
  updateInvoiceGroupReceipt,
  deleteInvoiceGroupReceipt,
  listPaymentGroupPayments,
  addPaymentGroupPayment,
  updatePaymentGroupPayment,
  deletePaymentGroupPayment,
  type ReceiptRecordView,
  type ReceiptRecordsResult,
} from "../actions";

type Props = {
  groupType: "invoice" | "payment";
  groupId: number;
  totalAmount: number | null;
  readOnly?: boolean; // 編集不可（差し戻し中など）
};

function toDateString(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function StatusBadge({
  status,
  recordCount,
}: {
  status: "none" | "partial" | "complete" | "over";
  recordCount: number;
}) {
  if (status === "none") {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
        記録なし
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
        一部のみ ({recordCount}件)
      </Badge>
    );
  }
  if (status === "over") {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
        過剰 ({recordCount}件)
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
      <Check className="h-3 w-3 mr-1" />
      完了 ({recordCount}件)
    </Badge>
  );
}

export function ReceiptsSection({ groupType, groupId, totalAmount, readOnly = false }: Props) {
  const [data, setData] = useState<ReceiptRecordsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 追加フォーム
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState<string>(toDateString(new Date()));
  const [newAmount, setNewAmount] = useState<string>("");
  const [newComment, setNewComment] = useState<string>("");

  // 編集
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editComment, setEditComment] = useState<string>("");

  // 削除確認
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const dateLabel = groupType === "invoice" ? "入金日" : "支払日";
  const amountLabel = groupType === "invoice" ? "入金額" : "支払額";
  const recordLabel = groupType === "invoice" ? "入金記録" : "支払記録";
  const actionLabel = groupType === "invoice" ? "入金" : "支払";

  const fetchData = async () => {
    try {
      setLoading(true);
      const result =
        groupType === "invoice"
          ? await listInvoiceGroupReceipts(groupId)
          : await listPaymentGroupPayments(groupId);
      setData(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupType, groupId]);

  const remaining = data?.summary.remaining ?? 0;

  const handleAdd = () => {
    if (!newDate) {
      toast.error(`${dateLabel}を入力してください`);
      return;
    }
    const amount = Number(newAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(`${amountLabel}は1以上の数値を入力してください`);
      return;
    }
    startTransition(async () => {
      try {
        if (groupType === "invoice") {
          await addInvoiceGroupReceipt(groupId, {
            receivedDate: newDate,
            amount,
            comment: newComment || null,
          });
        } else {
          await addPaymentGroupPayment(groupId, {
            paidDate: newDate,
            amount,
            comment: newComment || null,
          });
        }
        toast.success(`${recordLabel}を追加しました`);
        setAddOpen(false);
        setNewDate(toDateString(new Date()));
        setNewAmount("");
        setNewComment("");
        await fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "追加に失敗しました");
      }
    });
  };

  const startEdit = (r: ReceiptRecordView) => {
    setEditingId(r.id);
    setEditDate(toDateString(r.date));
    setEditAmount(String(r.amount));
    setEditComment(r.comment ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDate("");
    setEditAmount("");
    setEditComment("");
  };

  const handleUpdate = () => {
    if (editingId === null) return;
    if (!editDate) {
      toast.error(`${dateLabel}を入力してください`);
      return;
    }
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(`${amountLabel}は1以上の数値を入力してください`);
      return;
    }
    startTransition(async () => {
      try {
        if (groupType === "invoice") {
          await updateInvoiceGroupReceipt(editingId, {
            receivedDate: editDate,
            amount,
            comment: editComment || null,
          });
        } else {
          await updatePaymentGroupPayment(editingId, {
            paidDate: editDate,
            amount,
            comment: editComment || null,
          });
        }
        toast.success(`${recordLabel}を更新しました`);
        cancelEdit();
        await fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "更新に失敗しました");
      }
    });
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const id = deleteId;
    startTransition(async () => {
      try {
        if (groupType === "invoice") {
          await deleteInvoiceGroupReceipt(id);
        } else {
          await deletePaymentGroupPayment(id);
        }
        toast.success(`${recordLabel}を削除しました`);
        setDeleteId(null);
        await fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "削除に失敗しました");
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {recordLabel}
              {data && (
                <span className="ml-3">
                  <StatusBadge
                    status={data.summary.status}
                    recordCount={data.summary.recordCount}
                  />
                </span>
              )}
            </CardTitle>
            {!readOnly && !addOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddOpen(true)}
                disabled={isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                {actionLabel}を記録
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* サマリ表示 */}
          {data && (
            <div className="grid grid-cols-3 gap-4 text-sm pb-3 border-b">
              <div>
                <span className="text-muted-foreground">合計金額</span>
                <p className="font-medium">
                  {totalAmount != null ? `¥${totalAmount.toLocaleString()}` : "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{actionLabel}済合計</span>
                <p className="font-medium">¥{data.summary.totalReceived.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">残額</span>
                <p
                  className={
                    "font-medium " +
                    (remaining > 0
                      ? "text-red-600"
                      : remaining < 0
                        ? "text-yellow-700"
                        : "text-green-700")
                  }
                >
                  ¥{remaining.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* 追加フォーム */}
          {addOpen && (
            <div className="border rounded-md p-3 bg-blue-50/30 space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">{dateLabel}</Label>
                  <DatePicker value={newDate} onChange={setNewDate} />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">{amountLabel}（税込）</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="例: 100000"
                  />
                </div>
                <div className="col-span-6">
                  <Label className="text-xs text-muted-foreground">コメント（任意）</Label>
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="例: 振込手数料あり、前金分など"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddOpen(false);
                    setNewAmount("");
                    setNewComment("");
                  }}
                  disabled={isPending}
                >
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={isPending}>
                  追加
                </Button>
              </div>
            </div>
          )}

          {/* 一覧 */}
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">読み込み中...</p>
          ) : data && data.records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {recordLabel}はまだありません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">{dateLabel}</TableHead>
                  <TableHead className="w-32 text-right">{amountLabel}</TableHead>
                  <TableHead>コメント</TableHead>
                  <TableHead className="w-32">記録者</TableHead>
                  {!readOnly && <TableHead className="w-24 text-right">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.records.map((r) => {
                  const isEditing = editingId === r.id;
                  if (isEditing) {
                    return (
                      <TableRow key={r.id} className="bg-blue-50/30">
                        <TableCell>
                          <DatePicker value={editDate} onChange={setEditDate} />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            rows={1}
                            maxLength={500}
                            className="resize-none"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.createdByName}
                        </TableCell>
                        {!readOnly && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleUpdate}
                                disabled={isPending}
                                title="保存"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={isPending}
                                title="キャンセル"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  }
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">
                        {new Date(r.date).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ¥{r.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm">
                        {r.comment ?? <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.createdByName}
                      </TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(r)}
                              disabled={isPending}
                              title="編集"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteId(r.id)}
                              disabled={isPending}
                              title="削除"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 削除確認 */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{recordLabel}を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。記録を削除すると、合計金額・状態が再計算されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
