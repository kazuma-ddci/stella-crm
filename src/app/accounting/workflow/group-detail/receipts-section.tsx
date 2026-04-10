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
import { Plus, Pencil, Trash2, Check, X, Link2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listInvoiceGroupReceipts,
  addInvoiceGroupReceipt,
  updateInvoiceGroupReceipt,
  deleteInvoiceGroupReceipt,
  listPaymentGroupPayments,
  addPaymentGroupPayment,
  updatePaymentGroupPayment,
  deletePaymentGroupPayment,
  setInvoiceGroupManualPaymentStatus,
  setPaymentGroupManualPaymentStatus,
  type ReceiptRecordView,
  type ReceiptRecordsResult,
  type ManualPaymentStatus,
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

  // 手動入金/支払フラグの切替
  const handleManualStatusChange = (newStatus: ManualPaymentStatus) => {
    startTransition(async () => {
      try {
        if (groupType === "invoice") {
          await setInvoiceGroupManualPaymentStatus(groupId, newStatus);
        } else {
          await setPaymentGroupManualPaymentStatus(groupId, newStatus);
        }
        toast.success(`ステータスを更新しました`);
        await fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "更新に失敗しました");
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-3">
              {recordLabel}
              {data && (
                <StatusBadge
                  status={data.summary.status}
                  recordCount={data.summary.recordCount}
                />
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* 手動入金/支払フラグ */}
              {data && !readOnly && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {actionLabel}ステータス:
                  </span>
                  <Select
                    value={data.manualPaymentStatus}
                    onValueChange={(v) => handleManualStatusChange(v as ManualPaymentStatus)}
                    disabled={isPending}
                  >
                    <SelectTrigger
                      className={
                        "h-8 w-32 text-xs " +
                        (data.manualPaymentStatus === "completed"
                          ? "bg-green-50 border-green-300 text-green-800"
                          : data.manualPaymentStatus === "partial"
                            ? "bg-orange-50 border-orange-300 text-orange-800"
                            : "bg-gray-50 border-gray-300 text-gray-700")
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">未{actionLabel}</SelectItem>
                      <SelectItem value="partial">一部{actionLabel}</SelectItem>
                      <SelectItem value="completed">{actionLabel}完了</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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

          {/* 完了フラグと記録合計の不一致アラート */}
          {data && data.manualPaymentStatus === "completed" && data.summary.status !== "complete" && (
            <div
              className={
                "flex items-start gap-2 rounded-md border p-3 text-sm " +
                (data.summary.status === "over"
                  ? "border-yellow-300 bg-yellow-50 text-yellow-900"
                  : "border-red-300 bg-red-50 text-red-900")
              }
            >
              <AlertTriangle
                className={
                  "h-4 w-4 mt-0.5 shrink-0 " +
                  (data.summary.status === "over" ? "text-yellow-700" : "text-red-700")
                }
              />
              <div className="flex-1">
                <p className="font-medium">
                  {actionLabel}完了フラグが立っていますが、{actionLabel}記録の合計が
                  {actionLabel === "入金" ? "請求金額" : "支払金額"}と一致していません
                </p>
                <p className="text-xs mt-0.5">
                  {data.summary.status === "none" && (
                    <>記録が0件です。</>
                  )}
                  {data.summary.status === "partial" && (
                    <>
                      記録合計 ¥{data.summary.totalReceived.toLocaleString()} /
                      {actionLabel === "入金" ? "請求" : "支払"}金額 ¥{(totalAmount ?? 0).toLocaleString()}
                      （あと ¥{remaining.toLocaleString()} 不足）
                    </>
                  )}
                  {data.summary.status === "over" && (
                    <>
                      記録合計 ¥{data.summary.totalReceived.toLocaleString()} /
                      {actionLabel === "入金" ? "請求" : "支払"}金額 ¥{(totalAmount ?? 0).toLocaleString()}
                      （¥{Math.abs(remaining).toLocaleString()} 超過）
                    </>
                  )}
                  {" "}振込手数料等の意図的な差額であれば問題ありません。
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
                    <TableRow key={r.id} className={r.isBankLinked ? "bg-blue-50/20" : ""}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-1.5">
                          {r.isBankLinked && (
                            <span
                              title="銀行入出金履歴から自動生成された記録"
                              className="inline-flex items-center"
                            >
                              <Link2 className="h-3.5 w-3.5 text-blue-600" />
                            </span>
                          )}
                          {new Date(r.date).toLocaleDateString("ja-JP")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ¥{r.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm">
                        {r.comment ?? <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.isBankLinked ? (
                          <span className="text-blue-700">銀行履歴由来</span>
                        ) : (
                          r.createdByName
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          {r.isBankLinked ? (
                            <span
                              className="text-xs text-muted-foreground"
                              title="銀行取引側で編集してください"
                            >
                              編集不可
                            </span>
                          ) : (
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
                          )}
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
