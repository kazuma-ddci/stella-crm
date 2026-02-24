"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, FileText, AlertTriangle, Eye, Download, RefreshCw, Mail, MessageSquare, ArrowRight, Link2 } from "lucide-react";
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
import { CommentSection } from "@/app/accounting/comments/comment-section";
import { InvoiceMailModal } from "./invoice-mail-modal";
import type { InvoiceGroupListItem, UngroupedTransaction } from "./actions";
import {
  updateInvoiceGroup,
  deleteInvoiceGroup,
  addTransactionToGroup,
  removeTransactionFromGroup,
  getUngroupedTransactions,
  createCorrectionInvoiceGroup,
  updateInvoiceGroupStatus,
  generateInvoicePdf,
  submitInvoiceGroupToAccounting,
} from "./actions";

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  pdf_created: "PDF作成済み",
  sent: "送付済み",
  awaiting_accounting: "経理処理待ち",
  partially_paid: "一部入金",
  paid: "入金完了",
  returned: "差し戻し",
  corrected: "訂正済み",
};

type Props = {
  open: boolean;
  onClose: () => void;
  group: InvoiceGroupListItem;
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
};

type GroupTransaction = {
  id: number;
  expenseCategoryName: string;
  amount: number;
  taxAmount: number;
  taxRate: number;
  taxType: string;
  periodFrom: string;
  periodTo: string;
  note: string | null;
};

export function InvoiceGroupDetailModal({
  open,
  onClose,
  group,
  counterpartyOptions,
  operatingCompanyOptions,
  bankAccountsByCompany,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"detail" | "transactions" | "add" | "comments">(
    "detail"
  );

  // 編集可能な情報
  const [bankAccountId, setBankAccountId] = useState<string>(
    group.bankAccountId ? String(group.bankAccountId) : ""
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    group.invoiceDate ?? ""
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>(
    group.paymentDueDate ?? ""
  );

  // グループ内の取引
  const [transactions, setTransactions] = useState<GroupTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // 追加用の未グループ化取引
  const [ungroupedTransactions, setUngroupedTransactions] = useState<
    UngroupedTransaction[]
  >([]);
  const [selectedAddIds, setSelectedAddIds] = useState<Set<number>>(new Set());
  const [loadingUngrouped, setLoadingUngrouped] = useState(false);

  // 訂正モーダル
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  // 経理引渡確認
  const [showSubmitToAccountingDialog, setShowSubmitToAccountingDialog] = useState(false);

  // 訂正請求情報
  const [correctionChildren, setCorrectionChildren] = useState<{ id: number; invoiceNumber: string | null }[]>([]);

  // メール送付モーダル
  const [showMailModal, setShowMailModal] = useState(false);

  // PDFプレビュー
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // 訂正請求の子を取得
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/finance/invoice-groups/${group.id}/corrections`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setCorrectionChildren(data);
      })
      .catch(() => {
        if (!cancelled) setCorrectionChildren([]);
      });
    return () => { cancelled = true; };
  }, [open, group.id]);

  const isEditable = ["draft", "pdf_created"].includes(group.status);
  const canCreateCorrection = ["sent", "awaiting_accounting"].includes(
    group.status
  );
  const canDelete = group.status === "draft";

  const currentBankAccounts = useMemo(
    () => bankAccountsByCompany[String(group.operatingCompanyId)] ?? [],
    [bankAccountsByCompany, group.operatingCompanyId]
  );

  // グループ内の取引を取得
  const loadTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      const res = await fetch(
        `/api/finance/invoice-groups/${group.id}/transactions`
      );
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
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
    getUngroupedTransactions(group.counterpartyId)
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

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateInvoiceGroup(group.id, {
        bankAccountId: bankAccountId ? Number(bankAccountId) : null,
        invoiceDate: invoiceDate || null,
        paymentDueDate: paymentDueDate || null,
      });
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("この請求グループを削除しますか？取引はグループから外れます。")) return;
    setLoading(true);
    try {
      await deleteInvoiceGroup(group.id);
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
      await removeTransactionFromGroup(group.id, transactionId);
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
      await addTransactionToGroup(group.id, Array.from(selectedAddIds));
      setSelectedAddIds(new Set());
      setActiveTab("transactions");
      await loadTransactions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // PDFプレビュー表示
  const handlePreviewPdf = async () => {
    setLoadingPdf(true);
    try {
      const url = `/api/finance/invoice-groups/${group.id}/pdf?preview=true`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "PDF生成に失敗しました" }));
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(blobUrl);
      setShowPdfPreview(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF生成に失敗しました");
    } finally {
      setLoadingPdf(false);
    }
  };

  // PDF保存（採番・ファイル保存・ステータス更新）
  const handleSavePdf = async () => {
    setLoading(true);
    try {
      const result = await generateInvoicePdf(group.id);
      alert(`PDFを保存しました（${result.invoiceNumber}）`);
      // プレビューのblobURLを解放
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      setShowPdfPreview(false);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 保存済みPDFを開く
  const handleOpenPdf = () => {
    window.open(`/api/finance/invoice-groups/${group.id}/pdf`, "_blank");
  };

  // PDFプレビューを閉じる
  const handleClosePdfPreview = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setShowPdfPreview(false);
  };

  const handleCreateCorrection = async (
    type: "replacement" | "additional"
  ) => {
    setLoading(true);
    try {
      await createCorrectionInvoiceGroup(group.id, type);
      setShowCorrectionDialog(false);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "sent" && !confirm("送付済みにしますか？以降は編集できなくなります。")) return;
    setLoading(true);
    try {
      await updateInvoiceGroupStatus(group.id, newStatus);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToAccounting = async () => {
    setLoading(true);
    try {
      await submitInvoiceGroupToAccounting(group.id);
      setShowSubmitToAccountingDialog(false);
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
            請求詳細
            {group.invoiceNumber && (
              <span className="font-mono text-sm text-muted-foreground">
                {group.invoiceNumber}
              </span>
            )}
            {group.correctionType && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                {group.correctionType === "replacement"
                  ? "差し替え"
                  : "追加請求"}
              </span>
            )}
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
              {/* ステータスと操作 */}
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
                  {group.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePreviewPdf}
                      disabled={loading || loadingPdf}
                    >
                      {loadingPdf ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="mr-1 h-4 w-4" />
                      )}
                      {group.invoiceNumber ? "PDF再作成" : "PDFプレビュー"}
                    </Button>
                  )}
                  {group.status === "pdf_created" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenPdf}
                        disabled={loading}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        PDFを確認
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePreviewPdf}
                        disabled={loading || loadingPdf}
                      >
                        <RefreshCw className="mr-1 h-4 w-4" />
                        PDF再作成
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowMailModal(true)}
                        disabled={loading}
                      >
                        <Mail className="mr-1 h-4 w-4" />
                        送付
                      </Button>
                    </>
                  )}
                  {group.status === "sent" && (
                    <Button
                      size="sm"
                      onClick={() => setShowSubmitToAccountingDialog(true)}
                      disabled={loading}
                    >
                      <ArrowRight className="mr-1 h-4 w-4" />
                      経理へ引渡
                    </Button>
                  )}
                  {canCreateCorrection && (
                    <>
                      {group.pdfPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleOpenPdf}
                          disabled={loading}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          PDF
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCorrectionDialog(true)}
                      >
                        <AlertTriangle className="mr-1 h-4 w-4" />
                        訂正請求書を作成
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* 訂正元情報 */}
              {group.originalInvoiceNumber && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <span>
                    元の請求: {group.originalInvoiceNumber} の訂正
                    （{group.correctionType === "replacement" ? "差し替え" : "追加請求"}）
                  </span>
                </div>
              )}

              {/* 訂正請求による差し替え情報 */}
              {correctionChildren.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>
                    訂正請求 {correctionChildren.map((c) => c.invoiceNumber ?? `#${c.id}`).join(", ")} で差し替えられました
                  </span>
                </div>
              )}

              {/* PDF無効化警告（2.3.5: PDF作成済みで明細変更した場合） */}
              {group.status === "draft" && group.invoiceNumber && !group.pdfPath && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      明細が変更されたためPDFが無効になりました
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      PDFを再作成してください。請求書番号（{group.invoiceNumber}）は維持されます。
                    </p>
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
                  <Label>請求元法人</Label>
                  <Input
                    value={group.operatingCompanyName}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-bankAccountId">振込先口座</Label>
                  <select
                    id="detail-bankAccountId"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    disabled={!isEditable}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                  >
                    <option value="">選択してください</option>
                    {currentBankAccounts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="detail-invoiceDate">請求日</Label>
                  <Input
                    id="detail-invoiceDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    disabled={!isEditable}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-paymentDueDate">支払期限</Label>
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
                  <Label>請求書番号</Label>
                  <Input
                    value={group.invoiceNumber ?? "未採番"}
                    disabled
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              {/* 金額 */}
              <div className="rounded-lg border p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">小計</div>
                    <div className="text-lg font-bold">
                      ¥{(group.subtotal ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">消費税</div>
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

          {/* コメントタブ */}
          {activeTab === "comments" && (
            <div className="p-1">
              <CommentSection
                invoiceGroupId={group.id}
                allowCommentTypes
              />
            </div>
          )}
        </div>

        {/* 訂正請求書ダイアログ */}
        {showCorrectionDialog && (
          <Dialog
            open={showCorrectionDialog}
            onOpenChange={setShowCorrectionDialog}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>訂正請求書の作成</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  元請求書: {group.invoiceNumber ?? `#${group.id}`}
                </p>
                <p className="text-sm">訂正方法を選択してください:</p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleCreateCorrection("replacement")}
                    disabled={loading}
                  >
                    <div className="text-left">
                      <div className="font-medium">差し替え</div>
                      <div className="text-xs text-muted-foreground">
                        新しい請求書で全体を置き換え
                      </div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleCreateCorrection("additional")}
                    disabled={loading}
                  >
                    <div className="text-left">
                      <div className="font-medium">追加請求</div>
                      <div className="text-xs text-muted-foreground">
                        差額分のみ追加で請求
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* PDFプレビューダイアログ */}
        {showPdfPreview && (
          <Dialog open={showPdfPreview} onOpenChange={handleClosePdfPreview}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  請求書PDFプレビュー
                  {group.invoiceNumber && (
                    <span className="font-mono text-sm text-muted-foreground">
                      {group.invoiceNumber}
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* PDFビューア */}
              <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-100">
                {pdfPreviewUrl ? (
                  <iframe
                    src={pdfPreviewUrl}
                    className="w-full h-full"
                    title="請求書PDFプレビュー"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* 操作ボタン */}
              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-muted-foreground">
                  {group.invoiceNumber
                    ? "内容を確認して「保存」を押してください。"
                    : "保存時に請求書番号が自動採番されます。内容を確認して「保存」を押してください。"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleClosePdfPreview}
                    disabled={loading}
                  >
                    キャンセル
                  </Button>
                  <Button onClick={handleSavePdf} disabled={loading}>
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <FileText className="mr-1 h-4 w-4" />
                    保存
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* 経理引渡確認ダイアログ */}
        <AlertDialog
          open={showSubmitToAccountingDialog}
          onOpenChange={setShowSubmitToAccountingDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>経理へ引き渡しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この請求（{group.invoiceNumber ?? `#${group.id}`}）を経理処理待ちに変更します。
                この操作は取り消せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmitToAccounting} disabled={loading}>
                引き渡す
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* メール送付モーダル */}
        <InvoiceMailModal
          open={showMailModal}
          onClose={() => {
            setShowMailModal(false);
            onClose();
          }}
          invoiceGroupId={group.id}
        />
      </DialogContent>
    </Dialog>
  );
}
