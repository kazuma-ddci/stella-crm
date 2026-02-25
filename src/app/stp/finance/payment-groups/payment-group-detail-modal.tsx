"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Trash2,
  Mail,
  CheckCircle2,
  XCircle,
  FileText,
  MessageSquare,
  Send,
  AlertTriangle,
  Upload,
  Paperclip,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CommentSection } from "@/app/accounting/comments/comment-section";
import { PaymentGroupMailModal } from "./payment-group-mail-modal";
import { InlineTransactionForm } from "./inline-transaction-form";
import type {
  PaymentGroupListItem,
  UngroupedExpenseTransaction,
  PaymentGroupTransaction,
} from "./actions";
import {
  updatePaymentGroup,
  deletePaymentGroup,
  confirmReceivedInvoice,
  rejectInvoice,
  updatePaymentGroupStatus,
  addTransactionToPaymentGroup,
  removeTransactionFromPaymentGroup,
  getUngroupedExpenseTransactions,
  getPaymentGroupTransactions,
  submitPaymentGroupToAccounting,
  getPaymentGroupAttachments,
  addPaymentGroupAttachments,
  deletePaymentGroupAttachment,
} from "./actions";
import {
  getGroupAllocationWarnings,
  type AllocationWarning,
} from "@/app/accounting/transactions/allocation-group-item-actions";

const STATUS_LABELS: Record<string, string> = {
  before_request: "依頼前",
  requested: "発行依頼済み",
  invoice_received: "請求書受領",
  rejected: "差し戻し",
  re_requested: "再依頼済み",
  confirmed: "確認済み",
  awaiting_accounting: "経理引渡済み",
  paid: "支払済み",
};

type Props = {
  open: boolean;
  onClose: () => void;
  group: PaymentGroupListItem;
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  expenseCategories: { id: number; name: string; type: string }[];
};

export function PaymentGroupDetailModal({
  open,
  onClose,
  group,
  counterpartyOptions,
  operatingCompanyOptions,
  expenseCategories,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "detail" | "transactions" | "add" | "attachments" | "comments"
  >("detail");

  // 編集可能な情報
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>(
    group.expectedPaymentDate ?? ""
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>(
    group.paymentDueDate ?? ""
  );
  const [actualPaymentDate, setActualPaymentDate] = useState<string>(
    group.actualPaymentDate ?? ""
  );
  const [requestedPdfName, setRequestedPdfName] = useState<string>(
    group.requestedPdfName ?? ""
  );

  // グループ内の取引
  const [transactions, setTransactions] = useState<PaymentGroupTransaction[]>(
    []
  );
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // 追加用の未グループ化取引
  const [ungroupedTransactions, setUngroupedTransactions] = useState<
    UngroupedExpenseTransaction[]
  >([]);
  const [selectedAddIds, setSelectedAddIds] = useState<Set<number>>(
    new Set()
  );
  const [loadingUngrouped, setLoadingUngrouped] = useState(false);

  // インライン取引作成
  const [showInlineForm, setShowInlineForm] = useState(false);

  // 按分警告
  const [allocationWarnings, setAllocationWarnings] = useState<AllocationWarning[]>([]);

  // 却下ダイアログ
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // メール送付モーダル
  const [showMailModal, setShowMailModal] = useState(false);

  // 証憑
  const [groupAttachments, setGroupAttachments] = useState<{
    id: number;
    fileName: string;
    filePath: string;
    fileSize: number | null;
    mimeType: string | null;
    createdAt: string;
  }[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const isEditable = ["before_request", "rejected"].includes(group.status);
  const canDelete = group.status === "before_request";

  // グループ内の取引を取得
  const loadTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      const data = await getPaymentGroupTransactions(group.id);
      setTransactions(data);
    } catch {
      // ignore
    } finally {
      setLoadingTransactions(false);
    }
  }, [group.id]);

  useEffect(() => {
    if (open && activeTab === "transactions") {
      loadTransactions();
    }
  }, [open, activeTab, loadTransactions]);

  // 追加タブ: 未グループ化取引を取得
  useEffect(() => {
    if (activeTab !== "add") return;
    let cancelled = false;
    setLoadingUngrouped(true);
    getUngroupedExpenseTransactions(group.counterpartyId)
      .then((txs) => {
        if (!cancelled) {
          setUngroupedTransactions(txs);
          setLoadingUngrouped(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingUngrouped(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, group.counterpartyId]);

  // フォーム値をgroupの変更に同期
  useEffect(() => {
    setExpectedPaymentDate(group.expectedPaymentDate ?? "");
    setPaymentDueDate(group.paymentDueDate ?? "");
    setActualPaymentDate(group.actualPaymentDate ?? "");
    setRequestedPdfName(group.requestedPdfName ?? "");
  }, [group.expectedPaymentDate, group.paymentDueDate, group.actualPaymentDate, group.requestedPdfName]);

  // 按分警告を取得
  useEffect(() => {
    if (!open) return;
    if (group.allocationItemCount === 0 && group.transactionCount === 0) return;
    let cancelled = false;
    getGroupAllocationWarnings("payment", group.id)
      .then((warnings) => {
        if (!cancelled) setAllocationWarnings(warnings);
      })
      .catch(() => {
        if (!cancelled) setAllocationWarnings([]);
      });
    return () => { cancelled = true; };
  }, [open, group.id, group.allocationItemCount, group.transactionCount]);

  // 証憑を取得
  useEffect(() => {
    if (!open || activeTab !== "attachments") return;
    let cancelled = false;
    getPaymentGroupAttachments(group.id)
      .then((atts) => {
        if (!cancelled) setGroupAttachments(atts);
      })
      .catch(() => {
        if (!cancelled) setGroupAttachments([]);
      });
    return () => { cancelled = true; };
  }, [open, activeTab, group.id]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updatePaymentGroup(group.id, {
        expectedPaymentDate: expectedPaymentDate || null,
        paymentDueDate: paymentDueDate || null,
        actualPaymentDate: actualPaymentDate || null,
        requestedPdfName: requestedPdfName || null,
      });
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "この支払を削除しますか？取引は支払から外れます。"
      )
    )
      return;
    setLoading(true);
    try {
      await deletePaymentGroup(group.id);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTransaction = async (transactionId: number) => {
    if (!confirm("この取引を支払から外しますか？")) return;
    setLoading(true);
    try {
      await removeTransactionFromPaymentGroup(group.id, transactionId);
      await loadTransactions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransactions = async () => {
    if (selectedAddIds.size === 0) return;
    setLoading(true);
    try {
      await addTransactionToPaymentGroup(
        group.id,
        Array.from(selectedAddIds)
      );
      setSelectedAddIds(new Set());
      setActiveTab("transactions");
      await loadTransactions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 請求書受領を記録
  const handleRecordReceived = async () => {
    if (!confirm("請求書の受領を記録しますか？")) return;
    setLoading(true);
    try {
      await updatePaymentGroupStatus(group.id, "invoice_received");
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 確認する
  const handleConfirm = async () => {
    if (!confirm("この支払を確認済みにしますか？")) return;
    setLoading(true);
    try {
      await confirmReceivedInvoice(group.id, {});
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 却下して再依頼
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("却下理由を入力してください");
      return;
    }
    setLoading(true);
    try {
      await rejectInvoice(group.id, rejectReason.trim());
      setShowRejectDialog(false);
      setRejectReason("");
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 支払済みにする
  const handleMarkPaid = async () => {
    if (!confirm("支払済みにしますか？")) return;
    setLoading(true);
    try {
      await updatePaymentGroupStatus(group.id, "paid");
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 経理へ引渡
  const handleSubmitToAccounting = async () => {
    setLoading(true);
    try {
      await submitPaymentGroupToAccounting(group.id);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 証憑アップロード
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      const formDataUpload = new FormData();
      for (let i = 0; i < files.length; i++) {
        formDataUpload.append("files", files[i]);
      }
      const response = await fetch("/api/finance/payment-groups/upload", {
        method: "POST",
        body: formDataUpload,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "アップロードに失敗しました");
      await addPaymentGroupAttachments(group.id, result.files);
      const atts = await getPaymentGroupAttachments(group.id);
      setGroupAttachments(atts);
    } catch (err) {
      alert(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  };

  // 証憑削除
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm("この証憑を削除しますか？")) return;
    try {
      await deletePaymentGroupAttachment(attachmentId);
      setGroupAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            支払詳細
            <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
              {STATUS_LABELS[group.status] ?? group.status}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* タブ */}
        <div className="flex gap-1 border-b">
          <button
            onClick={() => setActiveTab("detail")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "detail"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            基本情報
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "transactions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            明細 ({group.transactionCount}件)
          </button>
          {isEditable && (
            <button
              onClick={() => setActiveTab("add")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "add"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              <Plus className="inline h-3 w-3 mr-1" />
              取引を追加
            </button>
          )}
          <button
            onClick={() => setActiveTab("attachments")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "attachments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <Paperclip className="inline h-3 w-3 mr-1" />
            証憑
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "comments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <MessageSquare className="inline h-3 w-3 mr-1" />
            コメント
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* 基本情報タブ */}
          {activeTab === "detail" && (
            <div className="space-y-4 p-1">
              {/* ステータスと操作ボタン */}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div>
                  <span className="text-sm text-muted-foreground">
                    ステータス:{" "}
                  </span>
                  <span className="font-medium">
                    {STATUS_LABELS[group.status] ?? group.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {/* before_request: 発行依頼メール送信 */}
                  {group.status === "before_request" && (
                    <Button
                      size="sm"
                      onClick={() => setShowMailModal(true)}
                      disabled={loading || !group.requestedPdfName}
                    >
                      <Mail className="mr-1 h-4 w-4" />
                      発行依頼メール送信
                    </Button>
                  )}

                  {/* requested: 請求書受領を記録 */}
                  {group.status === "requested" && (
                    <Button
                      size="sm"
                      onClick={handleRecordReceived}
                      disabled={loading}
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      請求書受領を記録
                    </Button>
                  )}

                  {/* invoice_received: 確認する / 却下して再依頼 */}
                  {group.status === "invoice_received" && (
                    <>
                      <Button
                        size="sm"
                        onClick={handleConfirm}
                        disabled={loading}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        確認する
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRejectDialog(true)}
                        disabled={loading}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        却下して再依頼
                      </Button>
                    </>
                  )}

                  {/* rejected: 再依頼メール送信 */}
                  {group.status === "rejected" && (
                    <Button
                      size="sm"
                      onClick={() => setShowMailModal(true)}
                      disabled={loading}
                    >
                      <Mail className="mr-1 h-4 w-4" />
                      再依頼メール送信
                    </Button>
                  )}

                  {/* re_requested: 請求書受領を記録 */}
                  {group.status === "re_requested" && (
                    <Button
                      size="sm"
                      onClick={handleRecordReceived}
                      disabled={loading}
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      請求書受領を記録
                    </Button>
                  )}

                  {/* confirmed: 経理へ引渡 / 支払済みにする */}
                  {group.status === "confirmed" && (
                    <>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            disabled={loading}
                          >
                            <Send className="mr-1 h-4 w-4" />
                            経理へ引渡
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              経理へ引渡しますか？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              この支払を経理部門へ引渡します。按分確定が完了していない取引が含まれている場合はエラーになります。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleSubmitToAccounting}
                            >
                              引渡する
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleMarkPaid}
                        disabled={loading}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        支払済みにする
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* 按分取引の処理状況警告 */}
              {allocationWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        他プロジェクトで未処理の按分取引があります
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        経理引渡前に、全プロジェクトの按分処理を完了させてください。
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 ml-7">
                    {allocationWarnings.map((w) => (
                      <div key={w.transactionId} className="text-xs">
                        <span className="font-medium text-amber-900">
                          {w.counterpartyName} - {w.expenseCategoryName}
                        </span>
                        <span className="text-amber-700 ml-1">
                          (¥{w.amountIncludingTax.toLocaleString()})
                        </span>
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {w.unprocessedCostCenters.map((cc) => (
                            <span
                              key={cc.costCenterId}
                              className="inline-flex items-center rounded px-1.5 py-0.5 bg-amber-100 text-amber-800"
                            >
                              {cc.costCenterName} ({cc.allocationRate}%) 未処理
                            </span>
                          ))}
                          {w.processedCostCenters.map((cc) => (
                            <span
                              key={cc.costCenterId}
                              className="inline-flex items-center rounded px-1.5 py-0.5 bg-green-50 text-green-700"
                            >
                              {cc.costCenterName} ({cc.allocationRate}%)
                              {cc.groupLabel ? ` ${cc.groupLabel}` : " 処理済"}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 基本情報フォーム */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>取引先</Label>
                  <Input
                    value={group.counterpartyName}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>支払元法人</Label>
                  <Input
                    value={group.operatingCompanyName}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>対象月</Label>
                  <Input
                    value={group.targetMonth}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-expectedPaymentDate">
                    支払予定日
                  </Label>
                  <Input
                    id="detail-expectedPaymentDate"
                    type="date"
                    value={expectedPaymentDate}
                    onChange={(e) => setExpectedPaymentDate(e.target.value)}
                    disabled={!isEditable}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-paymentDueDate">
                    支払期限
                  </Label>
                  <Input
                    id="detail-paymentDueDate"
                    type="date"
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                    disabled={!isEditable}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-actualPaymentDate">
                    実際の支払日
                  </Label>
                  <Input
                    id="detail-actualPaymentDate"
                    type="date"
                    value={actualPaymentDate}
                    onChange={(e) => setActualPaymentDate(e.target.value)}
                    disabled={!["confirmed", "awaiting_accounting", "paid"].includes(group.status)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-requestedPdfName">
                    請求書PDF名
                  </Label>
                  <Input
                    id="detail-requestedPdfName"
                    value={requestedPdfName}
                    onChange={(e) => setRequestedPdfName(e.target.value)}
                    disabled={!isEditable}
                    placeholder="例: 2026年2月分請求書"
                    className="mt-1"
                  />
                </div>
                {group.receivedPdfFileName && (
                  <div>
                    <Label>受領済みPDFファイル名</Label>
                    <Input
                      value={group.receivedPdfFileName}
                      disabled
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              {/* 確認者・確認日時 */}
              {(group.confirmedByName || group.confirmedAt) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {group.confirmedByName && (
                    <div>
                      <Label>確認者</Label>
                      <Input
                        value={group.confirmedByName}
                        disabled
                        className="mt-1"
                      />
                    </div>
                  )}
                  {group.confirmedAt && (
                    <div>
                      <Label>確認日時</Label>
                      <Input
                        value={group.confirmedAt}
                        disabled
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 金額表示 */}
              <div className="rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      消費税
                    </div>
                    <div className="text-lg font-bold">
                      ¥{(group.taxAmount ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      合計（税込）
                    </div>
                    <div className="text-lg font-bold text-emerald-600">
                      ¥{(group.totalAmount ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* 操作ボタン */}
              <div className="flex justify-between">
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    削除
                  </Button>
                )}
                <div className="ml-auto">
                  {(isEditable || ["confirmed", "awaiting_accounting", "paid"].includes(group.status)) && (
                    <Button onClick={handleSave} disabled={loading}>
                      {loading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      保存
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 明細タブ */}
          {activeTab === "transactions" && (
            <div className="space-y-3 p-1">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  取引がありません
                </div>
              ) : (
                <div className="border rounded-lg divide-y">
                  {transactions.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {t.expenseCategoryName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t.periodFrom} 〜 {t.periodTo}
                          </span>
                        </div>
                        {t.note && (
                          <div className="text-xs text-muted-foreground truncate">
                            {t.note}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-medium">
                          ¥{t.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          税¥{t.taxAmount.toLocaleString()} ({t.taxRate}%)
                        </div>
                      </div>
                      {isEditable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTransaction(t.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 取引追加タブ */}
          {activeTab === "add" && (
            <div className="space-y-3 p-1">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInlineForm(true)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  取引を新規作成
                </Button>
              </div>
              {loadingUngrouped ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : ungroupedTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  追加できる取引がありません
                </div>
              ) : (
                <>
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y">
                    {ungroupedTransactions.map((t) => (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                          selectedAddIds.has(t.id) ? "bg-blue-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAddIds.has(t.id)}
                          onChange={() => {
                            setSelectedAddIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(t.id)) {
                                next.delete(t.id);
                              } else {
                                next.add(t.id);
                              }
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {t.expenseCategoryName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t.periodFrom} 〜 {t.periodTo}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm font-medium">
                          ¥{t.amount.toLocaleString()}
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedAddIds.size > 0 && (
                    <div className="flex justify-end">
                      <Button
                        onClick={handleAddTransactions}
                        disabled={loading}
                        size="sm"
                      >
                        {loading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {selectedAddIds.size}件追加
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 証憑タブ */}
          {activeTab === "attachments" && (
            <div className="space-y-3 p-1">
              <div className="flex justify-end">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                    onChange={handleAttachmentUpload}
                    disabled={uploadingAttachment}
                    className="hidden"
                  />
                  <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                    {uploadingAttachment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    アップロード
                  </span>
                </label>
              </div>
              {groupAttachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  証憑がありません
                </div>
              ) : (
                <div className="space-y-2">
                  {groupAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 p-2 border rounded-md bg-gray-50"
                    >
                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <a
                        href={att.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm truncate text-blue-600 underline"
                      >
                        {att.fileName}
                      </a>
                      {att.fileSize && (
                        <span className="text-xs text-muted-foreground">
                          {(att.fileSize / 1024).toFixed(0)}KB
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* コメントタブ */}
          {activeTab === "comments" && (
            <div className="p-1">
              <CommentSection
                paymentGroupId={group.id}
                allowCommentTypes
              />
            </div>
          )}
        </div>

        {/* 却下ダイアログ */}
        {showRejectDialog && (
          <Dialog
            open={showRejectDialog}
            onOpenChange={setShowRejectDialog}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>却下して再依頼</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  却下理由を入力してください。取引先に再依頼を送る際に参照されます。
                </p>
                <div>
                  <Label htmlFor="reject-reason">却下理由</Label>
                  <Textarea
                    id="reject-reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="却下理由を入力..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectDialog(false);
                      setRejectReason("");
                    }}
                    disabled={loading}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={loading || !rejectReason.trim()}
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    却下する
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* メール送付モーダル */}
        <PaymentGroupMailModal
          open={showMailModal}
          onClose={() => {
            setShowMailModal(false);
            onClose();
          }}
          paymentGroupId={group.id}
        />

        {/* インライン取引作成 */}
        {showInlineForm && (
          <InlineTransactionForm
            onClose={() => setShowInlineForm(false)}
            onCreated={() => {
              setLoadingUngrouped(true);
              getUngroupedExpenseTransactions(group.counterpartyId)
                .then((txs) => {
                  setUngroupedTransactions(txs);
                  setLoadingUngrouped(false);
                })
                .catch(() => setLoadingUngrouped(false));
            }}
            counterpartyId={group.counterpartyId}
            expenseCategories={expenseCategories}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
