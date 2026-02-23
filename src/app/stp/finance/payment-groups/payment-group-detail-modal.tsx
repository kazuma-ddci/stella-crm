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
} from "lucide-react";
import { PaymentGroupMailModal } from "./payment-group-mail-modal";
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
} from "./actions";

const STATUS_LABELS: Record<string, string> = {
  before_request: "依頼前",
  requested: "発行依頼済み",
  invoice_received: "請求書受領",
  rejected: "差し戻し",
  re_requested: "再依頼済み",
  confirmed: "確認済み",
  paid: "支払済み",
};

type Props = {
  open: boolean;
  onClose: () => void;
  group: PaymentGroupListItem;
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
};

export function PaymentGroupDetailModal({
  open,
  onClose,
  group,
  counterpartyOptions,
  operatingCompanyOptions,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "detail" | "transactions" | "add"
  >("detail");

  // 編集可能な情報
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>(
    group.expectedPaymentDate ?? ""
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

  // 却下ダイアログ
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // メール送付モーダル
  const [showMailModal, setShowMailModal] = useState(false);

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
    setRequestedPdfName(group.requestedPdfName ?? "");
  }, [group.expectedPaymentDate, group.requestedPdfName]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updatePaymentGroup(group.id, {
        expectedPaymentDate: expectedPaymentDate || null,
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
        "この支払グループを削除しますか？取引はグループから外れます。"
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
    if (!confirm("この取引をグループから外しますか？")) return;
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
    if (!confirm("この支払グループを確認済みにしますか？")) return;
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            支払グループ詳細
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

                  {/* confirmed: 支払済みにする */}
                  {group.status === "confirmed" && (
                    <Button
                      size="sm"
                      onClick={handleMarkPaid}
                      disabled={loading}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      支払済みにする
                    </Button>
                  )}
                </div>
              </div>

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
                  {isEditable && (
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
      </DialogContent>
    </Dialog>
  );
}
