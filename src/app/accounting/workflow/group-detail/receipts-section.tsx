"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Check, X, Link2, AlertTriangle, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { GroupStatementLinkPanel } from "@/components/accounting/group-statement-link-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  attachExistingRecordToStatementEntry,
  deleteLink,
  listEntryCandidatesForGroup,
  getGroupStatementLinkCompleted,
  getGroupStatementLinkCompletionCheck,
  toggleGroupStatementLinkCompleted,
  type EntryCandidate,
} from "@/app/accounting/statements/link-actions";
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
  const [statementLinkCompleted, setStatementLinkCompleted] = useState(false);
  const [statementCheck, setStatementCheck] = useState<{
    linkCount: number;
    linkedAmount: number;
    recordAmount: number;
    canComplete: boolean;
    warnings: string[];
  } | null>(null);
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
  const [linkTarget, setLinkTarget] = useState<ReceiptRecordView | null>(null);
  const [linkCandidates, setLinkCandidates] = useState<EntryCandidate[]>([]);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkingEntryId, setLinkingEntryId] = useState<number | null>(null);

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
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setData(result.data);
      setStatementLinkCompleted(
        await getGroupStatementLinkCompleted(groupType, groupId)
      );
      const check = await getGroupStatementLinkCompletionCheck(groupType, groupId);
      if (check.ok) setStatementCheck(check.data);
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
      const result =
        groupType === "invoice"
          ? await addInvoiceGroupReceipt(groupId, {
              receivedDate: newDate,
              amount,
              comment: newComment || null,
            })
          : await addPaymentGroupPayment(groupId, {
              paidDate: newDate,
              amount,
              comment: newComment || null,
            });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${recordLabel}を追加しました`);
      setAddOpen(false);
      setNewDate(toDateString(new Date()));
      setNewAmount("");
      setNewComment("");
      await fetchData();
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
      const result =
        groupType === "invoice"
          ? await updateInvoiceGroupReceipt(editingId, {
              receivedDate: editDate,
              amount,
              comment: editComment || null,
            })
          : await updatePaymentGroupPayment(editingId, {
              paidDate: editDate,
              amount,
              comment: editComment || null,
            });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${recordLabel}を更新しました`);
      cancelEdit();
      await fetchData();
    });
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const id = deleteId;
    startTransition(async () => {
      const result =
        groupType === "invoice"
          ? await deleteInvoiceGroupReceipt(id)
          : await deletePaymentGroupPayment(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${recordLabel}を削除しました`);
      setDeleteId(null);
      await fetchData();
    });
  };

  const handleDeleteStatementLink = (linkId: number) => {
    startTransition(async () => {
      const result = await deleteLink(linkId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("入出金履歴の紐付けを解除しました");
      await fetchData();
    });
  };

  const loadLinkCandidates = async (search: string) => {
    setLinkLoading(true);
    try {
      const result = await listEntryCandidatesForGroup({
        groupKind: groupType,
        groupId,
        search,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLinkCandidates(result.data);
    } finally {
      setLinkLoading(false);
    }
  };

  const openRecordLinkDialog = async (record: ReceiptRecordView) => {
    setLinkTarget(record);
    setLinkSearch("");
    await loadLinkCandidates("");
  };

  const handleAttachRecord = (entryId: number) => {
    if (!linkTarget) return;
    setLinkingEntryId(entryId);
    startTransition(async () => {
      const result = await attachExistingRecordToStatementEntry({
        groupKind: groupType,
        groupId,
        recordId: linkTarget.id,
        entryId,
      });
      setLinkingEntryId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${recordLabel}に入出金履歴を紐付けました`);
      setLinkTarget(null);
      setLinkCandidates([]);
      await fetchData();
    });
  };

  // 手動入金/支払フラグの切替
  const handleManualStatusChange = (newStatus: ManualPaymentStatus) => {
    startTransition(async () => {
      const result =
        groupType === "invoice"
          ? await setInvoiceGroupManualPaymentStatus(groupId, newStatus)
          : await setPaymentGroupManualPaymentStatus(groupId, newStatus);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`ステータスを更新しました`);
      await fetchData();
    });
  };

  const handleStatementLinkCompletedChange = (completed: boolean) => {
    const prev = statementLinkCompleted;
    setStatementLinkCompleted(completed);
    startTransition(async () => {
      const result = await toggleGroupStatementLinkCompleted({
        groupKind: groupType,
        groupId,
        completed,
      });
      if (!result.ok) {
        toast.error(result.error);
        setStatementLinkCompleted(prev);
        return;
      }
      toast.success(
        completed ? "入出金履歴の確認を完了にしました" : "入出金履歴の確認完了を解除しました"
      );
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
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5">
                <span className="text-xs text-muted-foreground">
                  入出金履歴チェック:
                </span>
                <Label
                  htmlFor={`statement-link-completed-${groupType}-${groupId}`}
                  className="text-xs font-medium"
                >
                  完了
                </Label>
                <Switch
                  id={`statement-link-completed-${groupType}-${groupId}`}
                  checked={statementLinkCompleted}
                  onCheckedChange={handleStatementLinkCompletedChange}
                  disabled={readOnly || isPending || loading || (!statementLinkCompleted && statementCheck?.linkCount === 0)}
                />
              </div>
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
            <div className="grid grid-cols-2 gap-4 text-sm border-b pb-3 lg:grid-cols-4">
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
                <span className="text-muted-foreground">入出金履歴合計</span>
                <p className="font-medium">
                  ¥{(statementCheck?.linkedAmount ?? 0).toLocaleString()}
                </p>
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

          {statementCheck && !statementCheck.canComplete && (
            <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-700" />
              <div className="flex-1">
                <p className="font-medium">入出金履歴チェックを完了にできない条件があります</p>
                <div className="mt-1 space-y-0.5 text-xs">
                  {statementCheck.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
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
                              title="入出金履歴から作成された記録"
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
                        <div className="space-y-1">
                          <div>
                            {r.comment ?? <span className="text-muted-foreground">-</span>}
                          </div>
                          {r.statementLink && (
                            <div className="rounded-md border border-blue-100 bg-blue-50/70 px-2 py-1.5 text-xs text-blue-900">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Badge variant="outline" className="border-blue-200 bg-white text-[10px] text-blue-700">
                                  入出金履歴
                                </Badge>
                                <span className="font-medium">
                                  {new Date(r.statementLink.transactionDate).toLocaleDateString("ja-JP")}
                                </span>
                                <span className="truncate">
                                  {r.statementLink.description}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-blue-700">
                                {r.statementLink.bankAccountLabel}
                                {" / 取引額 ¥"}
                                {(r.statementLink.incomingAmount ?? r.statementLink.outgoingAmount ?? 0).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.isBankLinked ? (
                          <span className="text-blue-700">入出金履歴から作成</span>
                        ) : (
                          r.createdByName
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          {r.isBankLinked ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => r.statementLink && handleDeleteStatementLink(r.statementLink.id)}
                              disabled={isPending || !r.statementLink}
                              title="紐付けを解除"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openRecordLinkDialog(r)}
                                disabled={isPending}
                                title="この記録に入出金履歴を紐付け"
                              >
                                <Link2 className="h-4 w-4 text-blue-600" />
                              </Button>
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

          <GroupStatementLinkPanel
            groupKind={groupType}
            groupId={groupId}
            onChanged={fetchData}
            readOnly={readOnly}
            statementLinkCompleted={statementLinkCompleted}
            showLinkedList={false}
          />
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

      <Dialog open={linkTarget !== null} onOpenChange={(open) => !open && setLinkTarget(null)}>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>{recordLabel}に入出金履歴を紐付ける</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {linkTarget && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium">
                  {new Date(linkTarget.date).toLocaleDateString("ja-JP")}
                  {" / ¥"}
                  {linkTarget.amount.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  この記録金額で入出金履歴に紐付けます。日付は選択した入出金履歴の日付に揃います。
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={linkSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setLinkSearch(value);
                  loadLinkCandidates(value);
                }}
                placeholder="摘要で検索"
                className="pl-8"
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-md border divide-y">
              {linkLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  候補を読み込み中
                </div>
              ) : linkCandidates.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">候補がありません</div>
              ) : (
                linkCandidates.map((candidate) => {
                  const availableAmount = candidate.amount - candidate.alreadyLinkedAmount;
                  const canAttach = !!linkTarget && availableAmount >= linkTarget.amount;
                  return (
                    <div key={candidate.id} className="flex items-center gap-3 p-3 text-sm">
                      <Badge variant="outline" className="text-[10px]">
                        {candidate.transactionDate}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{candidate.description}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {candidate.bankAccountLabel} / 取引額 ¥{candidate.amount.toLocaleString()}
                          {candidate.alreadyLinkedAmount > 0 &&
                            ` / 既割当 ¥${candidate.alreadyLinkedAmount.toLocaleString()}`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canAttach || linkingEntryId === candidate.id}
                        onClick={() => handleAttachRecord(candidate.id)}
                      >
                        {linkingEntryId === candidate.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : canAttach ? (
                          "紐付け"
                        ) : (
                          "金額不足"
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
