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
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, Plus, Trash2, FileText, AlertTriangle, Eye, Download, RefreshCw, ArrowRight, Link2, Upload, Send, CheckCircle2, Pencil, History, Check, X, Clock, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { CommentSection } from "@/app/finance/comments/comment-section";
import { ReceiptsReadonly } from "@/components/finance/receipts-readonly";
import { InvoiceMailModal } from "./invoice-mail-modal";
import { getInvoiceGroupMailHistory, type MailHistoryItem } from "./mail-actions";
import { InlineTransactionForm } from "./inline-transaction-form";
import type { InvoiceGroupListItem, UngroupedTransaction } from "./actions";
import {
  updateInvoiceGroup,
  updateInvoiceGroupTransactionNote,
  deleteInvoiceGroup,
  addTransactionToGroup,
  removeTransactionFromGroup,
  getUngroupedTransactions,
  createCorrectionInvoiceGroup,
  updateInvoiceGroupStatus,
  generateInvoicePdf,
  submitInvoiceGroupToAccounting,
  getInvoiceGroupAttachments,
  addInvoiceGroupAttachments,
  deleteInvoiceGroupAttachment,
  requestReturnInvoiceGroup,
  cancelInvoiceGroupHandover,
} from "./actions";
import {
  getGroupAllocationWarnings,
  type AllocationWarning,
} from "@/app/finance/transactions/allocation-group-item-actions";
import { InvoiceBuilderTab } from "./invoice-builder-tab";
import {
  UploadConfirmationDialog,
  type FileUploadEntry,
} from "@/components/attachments/upload-confirmation-dialog";
import {
  ATTACHMENT_TYPE_LABELS,
} from "@/lib/attachments/constants";
import {
  updateAttachmentDisplayName,
  getAttachmentHistory,
} from "@/lib/attachments/actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { GroupStatementLinkPanel } from "@/components/accounting/group-statement-link-panel";

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
  stellaCustomerOptions: { value: string; label: string; companyId: number }[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
  expenseCategories: { id: number; name: string; type: string }[];
  projectId?: number;
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

function displayCounterpartyName(label: string): string {
  return label.replace(/^[A-Z]+-\d+\s+-?\s*/, "");
}

export function InvoiceGroupDetailModal({
  open,
  onClose,
  group,
  stellaCustomerOptions,
  counterpartyOptions,
  bankAccountsByCompany,
  expenseCategories,
  projectId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"detail" | "transactions" | "add" | "invoice-builder" | "attachments" | "history" | "comments" | "statement-links">(
    "detail"
  );
  const [showReturnRequestDialog, setShowReturnRequestDialog] = useState(false);
  const [returnRequestBody, setReturnRequestBody] = useState("");

  // 編集可能な情報
  const [counterpartyId, setCounterpartyId] = useState<string>(
    String(group.counterpartyId)
  );
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const isBillingChanged = String(group.counterpartyId) !== counterpartyId;
  const [billingTab, setBillingTab] = useState<"stella" | "other">("stella");
  const [billingSearch, setBillingSearch] = useState("");

  // 宛先選択肢のフィルタ（Stella顧客はpage.tsxで降順ソート済み）
  const filteredBillingOptions = useMemo(() => {
    const source = billingTab === "stella" ? stellaCustomerOptions : counterpartyOptions;
    if (!billingSearch) return source;
    const q = billingSearch.toLowerCase();
    return source.filter((o) => o.label.toLowerCase().includes(q));
  }, [billingTab, stellaCustomerOptions, counterpartyOptions, billingSearch]);
  // 全選択肢を結合（ラベル検索用）
  const allBillingOptions = useMemo(() => [...stellaCustomerOptions, ...counterpartyOptions], [stellaCustomerOptions, counterpartyOptions]);
  const selectedBillingLabel =
    allBillingOptions.find((o) => o.value === counterpartyId)?.label ?? group.counterpartyName;
  const selectedBillingDisplayName = displayCounterpartyName(selectedBillingLabel);

  const [bankAccountId, setBankAccountId] = useState<string>(
    group.bankAccountId ? String(group.bankAccountId) : ""
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    group.invoiceDate ?? ""
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>(
    group.paymentDueDate ?? ""
  );
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>(
    group.expectedPaymentDate ?? ""
  );
  const actualPaymentDate = group.actualPaymentDate ?? "";
  const isReturnRequested = group.returnRequestStatus === "requested";

  // グループ内の取引
  const [transactions, setTransactions] = useState<GroupTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

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

  // インライン取引作成
  const [showInlineForm, setShowInlineForm] = useState(false);

  // メール送付モーダル
  const [showMailModal, setShowMailModal] = useState(false);

  // PDFプレビュー
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // ビルダータブでPDF作成された場合のローカル状態追跡
  const [invoiceCreated, setInvoiceCreated] = useState(false);
  const effectiveStatus = invoiceCreated ? "pdf_created" : group.status;

  // PDF作成後のアクション選択ダイアログ
  const [showPdfActionDialog, setShowPdfActionDialog] = useState(false);
  const [generatedPdfPath, setGeneratedPdfPath] = useState<string | null>(null);

  // 証憑
  const [groupAttachments, setGroupAttachments] = useState<{
    id: number;
    fileName: string;
    filePath: string;
    fileSize: number | null;
    mimeType: string | null;
    attachmentType: string;
    displayName: string | null;
    generatedName: string | null;
    createdAt: string;
  }[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  // アップロード確認ダイアログ
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // インライン編集
  const [editingAttachmentId, setEditingAttachmentId] = useState<number | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");
  // 変更履歴ポップオーバー
  const [, setHistoryAttachmentId] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<{
    id: number;
    changedAt: string;
    changedByName: string;
    oldDisplayName: string | null;
    newDisplayName: string | null;
  }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 送信履歴
  const [mailHistory, setMailHistory] = useState<MailHistoryItem[]>([]);
  const [loadingMailHistory, setLoadingMailHistory] = useState(false);

  // 按分警告
  const [allocationWarnings, setAllocationWarnings] = useState<AllocationWarning[]>([]);

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

  // 按分警告を取得（allocationItemCountがある場合のみ）
  useEffect(() => {
    if (!open) return;
    if (group.allocationItemCount === 0 && group.transactionCount === 0) return;
    let cancelled = false;
    getGroupAllocationWarnings("invoice", group.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAllocationWarnings(result.data);
      } else {
        // 権限エラー / 未存在の場合は空配列で描画（詳細は server log に出力済）
        setAllocationWarnings([]);
      }
    });
    return () => { cancelled = true; };
  }, [open, group.id, group.allocationItemCount, group.transactionCount]);

  // 証憑を取得
  useEffect(() => {
    if (!open || activeTab !== "attachments") return;
    let cancelled = false;
    getInvoiceGroupAttachments(group.id)
      .then((atts) => {
        if (!cancelled) setGroupAttachments(atts);
      })
      .catch(() => {
        if (!cancelled) setGroupAttachments([]);
      });
    return () => { cancelled = true; };
  }, [open, activeTab, group.id]);

  // 送信履歴を取得
  useEffect(() => {
    if (!open || activeTab !== "history") return;
    let cancelled = false;
    setLoadingMailHistory(true);
    getInvoiceGroupMailHistory(group.id)
      .then((history) => {
        if (!cancelled) setMailHistory(history);
      })
      .catch(() => {
        if (!cancelled) setMailHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMailHistory(false);
      });
    return () => { cancelled = true; };
  }, [open, activeTab, group.id]);

  const isEditable = ["draft", "pdf_created"].includes(group.status);
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
      const result = await updateInvoiceGroup(group.id, {
        counterpartyId: counterpartyId.startsWith("new-") ? counterpartyId : Number(counterpartyId),
        bankAccountId: bankAccountId ? Number(bankAccountId) : null,
        invoiceDate: invoiceDate || null,
        paymentDueDate: paymentDueDate || null,
        expectedPaymentDate: expectedPaymentDate || null,
      });
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setSaved(true);
      setIsEditingBilling(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("この請求を削除しますか？取引は請求から外れます。")) return;
    setLoading(true);
    try {
      const result = await deleteInvoiceGroup(group.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTransaction = async (transactionId: number) => {
    if (!confirm("この取引を請求から外しますか？")) return;
    setLoading(true);
    try {
      const result = await removeTransactionFromGroup(group.id, transactionId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      await loadTransactions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTransactionNote = async (transactionId: number) => {
    setSavingNoteId(transactionId);
    try {
      const result = await updateInvoiceGroupTransactionNote(
        group.id,
        transactionId,
        noteDraft
      );
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setTransactions((current) =>
        current.map((tx) =>
          tx.id === transactionId ? { ...tx, note: noteDraft.trim() || null } : tx
        )
      );
      setEditingNoteId(null);
      setNoteDraft("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "摘要の保存に失敗しました");
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleAddTransactions = async () => {
    if (selectedAddIds.size === 0) return;
    setLoading(true);
    try {
      const result = await addTransactionToGroup(group.id, Array.from(selectedAddIds));
      if (!result.ok) {
        alert(result.error);
        return;
      }
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
      const url = `/api/finance/invoice-groups/${group.id}/pdf?preview=true${projectId ? `&projectId=${projectId}` : ""}`;
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
      if (!result.ok) {
        alert(result.error);
        return;
      }
      alert(`PDFを保存しました（${result.data.invoiceNumber}）`);
      // プレビューのblobURLを解放
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      setShowPdfPreview(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 保存済みPDFを開く
  const handleOpenPdf = () => {
    window.open(`/api/finance/invoice-groups/${group.id}/pdf${projectId ? `?projectId=${projectId}` : ""}`, "_blank");
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
      const result = await createCorrectionInvoiceGroup(group.id, type);
      if (!result.ok) {
        alert(result.error);
        return;
      }
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
      const result = await updateInvoiceGroupStatus(group.id, newStatus);
      if (!result.ok) {
        alert(result.error);
        return;
      }
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
      const result = await submitInvoiceGroupToAccounting(group.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setShowSubmitToAccountingDialog(false);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // PDF作成後のコールバック → アクション選択ダイアログを表示
  const handlePdfGenerated = (pdfPath: string) => {
    setGeneratedPdfPath(pdfPath);
    setShowPdfActionDialog(true);
    setInvoiceCreated(true);
  };

  // PDFアクションダイアログを閉じる
  const handleClosePdfActionDialog = () => {
    setShowPdfActionDialog(false);
  };

  // PDFを新しいタブで確認
  const handleViewPdf = () => {
    if (generatedPdfPath) {
      window.open(generatedPdfPath, "_blank");
    }
  };

  // PDFをダウンロード
  const handleDownloadPdf = () => {
    if (generatedPdfPath) {
      const a = document.createElement("a");
      a.href = generatedPdfPath;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // 証憑アップロード: ファイル選択 → 確認ダイアログ表示
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setShowUploadDialog(true);
    e.target.value = "";
  };

  // 確認ダイアログで「アップロード」を押したときの処理
  const handleUploadConfirm = async (entries: FileUploadEntry[]) => {
    setUploadingAttachment(true);
    try {
      const formDataUpload = new FormData();
      for (const entry of entries) {
        formDataUpload.append("files", entry.file);
      }
      const response = await fetch("/api/finance/invoice-groups/upload", {
        method: "POST",
        body: formDataUpload,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "アップロードに失敗しました");

      // APIレスポンスにメタデータをマージ（generatedNameはダイアログ側で重複連番込みで生成済み）
      const filesWithMetadata = result.files.map((f: { filePath: string; fileName: string; fileSize: number; mimeType: string }, i: number) => ({
        ...f,
        attachmentType: entries[i].attachmentType,
        displayName: entries[i].displayName,
        generatedName: entries[i].generatedName,
      }));

      await addInvoiceGroupAttachments(group.id, filesWithMetadata);
      const atts = await getInvoiceGroupAttachments(group.id);
      setGroupAttachments(atts);
      setShowUploadDialog(false);
      setPendingFiles([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploadingAttachment(false);
    }
  };

  // 表示名のインライン編集を保存
  const handleSaveDisplayName = async (attachmentId: number) => {
    const trimmed = editingDisplayName.trim();
    if (!trimmed) {
      setEditingAttachmentId(null);
      return;
    }
    try {
      const result = await updateAttachmentDisplayName(attachmentId, trimmed);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      const atts = await getInvoiceGroupAttachments(group.id);
      setGroupAttachments(atts);
    } catch (e) {
      alert(e instanceof Error ? e.message : "変更に失敗しました");
    } finally {
      setEditingAttachmentId(null);
    }
  };

  // 変更履歴の読み込み
  const handleLoadHistory = async (attachmentId: number) => {
    setHistoryAttachmentId(attachmentId);
    setHistoryData([]);
    setLoadingHistory(true);
    try {
      const history = await getAttachmentHistory(attachmentId);
      // Popoverがまだ開いている場合のみデータを設定
      setHistoryData(history);
    } catch {
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 証憑削除
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm("この証憑を削除しますか？")) return;
    try {
      await deleteInvoiceGroupAttachment(attachmentId);
      setGroupAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        size={activeTab === "invoice-builder" ? "fullwidth" : "wide"}
        className={`${activeTab === "invoice-builder" ? "h-[88vh]" : "max-h-[80vh]"} flex flex-col`}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap pr-6">
            <DialogTitle className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">請求詳細</span>
              <span className="font-mono text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                #{group.id}
              </span>
              {(group.invoiceNumber || invoiceCreated) && (
                <span className="font-mono text-sm text-muted-foreground truncate">
                  {group.invoiceNumber}
                </span>
              )}
              {group.correctionType && (
                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full shrink-0">
                  {group.correctionType === "replacement"
                    ? "差し替え"
                    : "追加請求"}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              {effectiveStatus === "draft" && (
                <Button
                  size="sm"
                  onClick={() => setActiveTab("invoice-builder")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <FileText className="mr-1 h-4 w-4" />
                  {group.invoiceNumber ? "PDF再作成" : "請求書作成"}
                </Button>
              )}
              {effectiveStatus === "pdf_created" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      alert("変更点がありません。内容を変更してからPDFを再作成してください。");
                    }}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    PDF再作成
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowMailModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Send className="mr-1 h-4 w-4" />
                    送付
                  </Button>
                </>
              )}
              {effectiveStatus === "sent" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  送付済み
                </span>
              )}
              {effectiveStatus === "awaiting_accounting" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700">
                  経理処理待ち
                </span>
              )}
              {(effectiveStatus === "partially_paid" || effectiveStatus === "paid") && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  effectiveStatus === "paid"
                    ? "bg-blue-50 border border-blue-200 text-blue-700"
                    : "bg-orange-50 border border-orange-200 text-orange-700"
                }`}>
                  {STATUS_LABELS[effectiveStatus]}
                </span>
              )}
            </div>
          </div>
          {/* ステータスフロー ステップインジケータ */}
          {(() => {
            const steps = [
              { key: "draft", label: "下書き" },
              { key: "pdf_created", label: "PDF作成" },
              { key: "sent", label: "送付" },
              { key: "awaiting_accounting", label: "経理引渡" },
              { key: "paid", label: "入金" },
            ];
            const currentIdx = steps.findIndex((s) => s.key === effectiveStatus);
            // corrected/returnedは特殊ステータスなので非表示
            if (currentIdx === -1) return null;
            return (
              <div className="flex items-center mt-3 px-1">
                {steps.map((step, i) => (
                  <div key={step.key} className="flex items-center">
                    {i > 0 && (
                      <div className={`w-8 h-0.5 ${i <= currentIdx ? "bg-blue-400" : "bg-gray-200"}`} />
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`flex items-center justify-center rounded-full ${
                          i < currentIdx
                            ? "w-7 h-7 bg-blue-500 text-white"
                            : i === currentIdx
                            ? "w-8 h-8 bg-blue-600 text-white ring-2 ring-blue-200"
                            : "w-7 h-7 bg-gray-100 text-gray-400 border border-gray-200"
                        }`}
                      >
                        {i < currentIdx ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-bold">{i + 1}</span>
                        )}
                      </div>
                      <span
                        className={`text-xs whitespace-nowrap ${
                          i < currentIdx
                            ? "text-gray-500"
                            : i === currentIdx
                            ? "font-bold text-blue-700"
                            : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogHeader>

        {/* タブ */}
        <div className="flex border-b overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab("detail")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === "detail"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            基本情報
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
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
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                activeTab === "add"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              + 取引追加
            </button>
          )}
          <button
            onClick={() => setActiveTab("invoice-builder")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === "invoice-builder"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {group.invoiceNumber ? "請求書再作成" : "請求書作成"}
          </button>
          <button
            onClick={() => setActiveTab("attachments")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === "attachments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            証憑
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <Clock className="inline h-3 w-3 mr-1" />
            送信履歴
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === "comments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            コメント
          </button>
          <button
            onClick={() => setActiveTab("statement-links")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === "statement-links"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            入出金紐付け
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ステータスと操作 - 全タブ共通・スクロール時固定 */}
          <div className="sticky top-0 z-10 bg-white px-1 pt-1">
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
                  {group.canCancelHandover && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!confirm("経理引渡を取り消して「送付済み」に戻しますか？\n※経理側で仕訳処理が開始されている場合は取り消せません。")) return;
                        setLoading(true);
                        try {
                          const result = await cancelInvoiceGroupHandover(group.id);
                          if (!result.ok) {
                            alert(result.error);
                            return;
                          }
                          onClose();
                        } catch (e) {
                          alert(e instanceof Error ? e.message : "エラーが発生しました");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      <Undo2 className="mr-1 h-4 w-4" />
                      引渡取消
                    </Button>
                  )}
                  {group.canRequestReturn && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => setShowReturnRequestDialog(true)}
                      disabled={loading}
                    >
                      差し戻し依頼
                    </Button>
                  )}
                  {isReturnRequested && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                      差し戻し依頼中
                    </Badge>
                  )}
                  {group.status === "returned" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange("draft")}
                      disabled={loading}
                    >
                      下書きに戻す
                    </Button>
                  )}
                </div>
            </div>
          </div>

          {/* 基本情報タブ */}
          {isReturnRequested && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">経理へ差し戻し依頼中です</p>
              <p className="mt-1 whitespace-pre-wrap">{group.returnRequestReason}</p>
            </div>
          )}
          {group.status === "returned" && group.returnRequestReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <p className="font-medium">経理から差し戻されています</p>
              <p className="mt-1 whitespace-pre-wrap">{group.returnRequestReason}</p>
            </div>
          )}
          {activeTab === "detail" && (
            <div className="space-y-4 p-1">
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

              {/* 宛先変更の警告 */}
              {(group.originalCounterpartyName || isBillingChanged) && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">宛先が変更されています</p>
                    <p className="text-amber-700 mt-0.5">
                      {isBillingChanged
                        ? `宛先を「${selectedBillingDisplayName}」に変更しました。`
                        : `取引先「${group.originalCounterpartyName}」の取引を、「${group.counterpartyName}」宛の請求書として発行します。`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* 基本情報フォーム */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>請求書の宛先</Label>
                    {isEditable && (
                      !isEditingBilling ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => setIsEditingBilling(true)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          宛先変更
                        </Button>
                      ) : isBillingChanged ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => {
                            setCounterpartyId(String(group.counterpartyId));
                            setIsEditingBilling(false);
                          }}
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          元に戻す
                        </Button>
                      ) : null
                    )}
                  </div>
                  {isEditable && isEditingBilling ? (
                    <div className={`mt-1 rounded-md border ${isBillingChanged ? "border-amber-400 bg-amber-50" : "border-input"}`}>
                      <div className="flex border-b">
                        <button
                          type="button"
                          className={`flex-1 px-3 py-1.5 text-xs font-medium ${billingTab === "stella" ? "bg-white border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                          onClick={() => { setBillingTab("stella"); setBillingSearch(""); }}
                        >
                          Stella顧客 ({stellaCustomerOptions.length})
                        </button>
                        <button
                          type="button"
                          className={`flex-1 px-3 py-1.5 text-xs font-medium ${billingTab === "other" ? "bg-white border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                          onClick={() => { setBillingTab("other"); setBillingSearch(""); }}
                        >
                          その他 ({counterpartyOptions.length})
                        </button>
                      </div>
                      <div className="p-2">
                        <Input
                          placeholder="検索..."
                          value={billingSearch}
                          onChange={(e) => setBillingSearch(e.target.value)}
                          className="h-8 text-sm mb-2"
                        />
                        <div className="max-h-40 overflow-y-auto space-y-0.5">
                          {filteredBillingOptions.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-blue-50 ${
                                counterpartyId === o.value ? "bg-blue-100 font-medium" : ""
                              }`}
                              onClick={() => { setCounterpartyId(o.value); setIsEditingBilling(false); }}
                            >
                              {o.label}
                            </button>
                          ))}
                          {filteredBillingOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground py-2 text-center">該当なし</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Input
                      value={
                        isEditable
                          ? selectedBillingDisplayName
                          : group.counterpartyName
                      }
                      disabled
                      className="mt-1 disabled:opacity-100 disabled:bg-gray-100 disabled:text-gray-900"
                    />
                  )}
                </div>
                <div>
                  <Label>請求元法人</Label>
                  <Input
                    value={group.operatingCompanyName}
                    disabled
                    className="mt-1 disabled:opacity-100 disabled:bg-gray-100 disabled:text-gray-900"
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
                  <DatePicker
                    id="detail-invoiceDate"
                    value={invoiceDate}
                    onChange={setInvoiceDate}
                    disabled={!isEditable}
                    placeholder="日付を選択"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-paymentDueDate">入金期限</Label>
                  <DatePicker
                    id="detail-paymentDueDate"
                    value={paymentDueDate}
                    onChange={setPaymentDueDate}
                    disabled={!isEditable}
                    placeholder="日付を選択"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-expectedPaymentDate">入金予定日</Label>
                  <DatePicker
                    id="detail-expectedPaymentDate"
                    value={expectedPaymentDate}
                    onChange={setExpectedPaymentDate}
                    disabled={!isEditable}
                    placeholder="日付を選択"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* 参考情報（読み取り専用） */}
              <div className="rounded-lg bg-gray-50 p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">実際の入金日</div>
                    <div className="mt-0.5 text-sm font-medium">
                      {actualPaymentDate ? (
                        <>
                          {actualPaymentDate}
                          {group.manualPaymentStatus === "partial" && (
                            <span className="ml-1 text-red-600">(一部入金)</span>
                          )}
                          {group.manualPaymentStatus === "completed" && (
                            <span className="ml-1 text-green-700">(完了)</span>
                          )}
                        </>
                      ) : (
                        <span className="text-orange-600">未入金</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">請求書番号</div>
                    <div className="mt-0.5 text-sm font-medium font-mono">
                      {group.invoiceNumber ?? "未採番"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">作成者</div>
                    <div className="mt-0.5 text-sm font-medium">
                      {group.createdByName ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">作成日</div>
                    <div className="mt-0.5 text-sm font-medium">
                      {group.createdAt ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 入金記録（経理側で記録された分割入金を読み取り専用で表示） */}
              <ReceiptsReadonly
                mode="invoice"
                totalAmount={group.totalAmount}
                records={group.receipts.map((r) => ({
                  id: r.id,
                  date: r.receivedDate,
                  amount: r.amount,
                  comment: r.comment,
                  createdByName: r.createdByName,
                }))}
                status={group.receiptStatus}
                recordTotal={group.receiptTotal}
                manualPaymentStatus={group.manualPaymentStatus}
              />

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
                  {(isEditable || ["sent"].includes(group.status)) && (
                    <Button onClick={handleSave} disabled={loading || saved}>
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : saved ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : null}
                      {saved ? "保存しました" : "保存"}
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
                        <div className="mt-1">
                          {editingNoteId === t.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                rows={2}
                                className="text-sm"
                                placeholder="請求書に表示する摘要"
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSaveTransactionNote(t.id)}
                                  disabled={savingNoteId === t.id}
                                >
                                  {savingNoteId === t.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                                  保存
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setNoteDraft("");
                                  }}
                                  disabled={savingNoteId === t.id}
                                >
                                  キャンセル
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                                <span className="font-medium text-gray-500">摘要: </span>
                                <span className="whitespace-pre-wrap break-words">
                                  {t.note || "未入力"}
                                </span>
                              </div>
                              {isEditable && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    setEditingNoteId(t.id);
                                    setNoteDraft(t.note ?? "");
                                  }}
                                  disabled={loading}
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  編集
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
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
                    onChange={handleFileSelect}
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
                      className={`flex items-center gap-2 p-2 border rounded-md ${
                        att.attachmentType === "invoice_old" ? "bg-gray-100 opacity-60" : "bg-gray-50"
                      }`}
                    >
                      <FileText className={`h-4 w-4 flex-shrink-0 ${
                        att.attachmentType === "invoice_old" ? "text-gray-400" : "text-blue-600"
                      }`} />
                      {/* 証憑種類バッジ */}
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                        att.attachmentType === "invoice_old"
                          ? "bg-gray-200 text-gray-500"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {ATTACHMENT_TYPE_LABELS[att.attachmentType] ?? att.attachmentType}
                      </span>
                      {/* ファイル名（インライン編集対応） */}
                      {editingAttachmentId === att.id ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <Input
                            value={editingDisplayName}
                            onChange={(e) => setEditingDisplayName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveDisplayName(att.id);
                              if (e.key === "Escape") setEditingAttachmentId(null);
                            }}
                            className="h-7 text-sm flex-1"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-green-600"
                            onClick={() => handleSaveDisplayName(att.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400"
                            onClick={() => setEditingAttachmentId(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <a
                          href={att.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm truncate text-blue-600 underline"
                        >
                          {att.generatedName ?? att.fileName}
                        </a>
                      )}
                      {att.fileSize && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(att.fileSize / 1024).toFixed(0)}KB
                        </span>
                      )}
                      {/* 編集ボタン */}
                      {editingAttachmentId !== att.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setEditingAttachmentId(att.id);
                            setEditingDisplayName(att.displayName ?? att.fileName);
                          }}
                          title="表示名を変更"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {/* 変更履歴ボタン */}
                      <Popover onOpenChange={(open) => {
                        if (open) {
                          handleLoadHistory(att.id);
                        } else {
                          setHistoryAttachmentId(null);
                          setHistoryData([]);
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                            title="変更履歴"
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3" align="end">
                          <div className="text-xs font-medium mb-2">変更履歴</div>
                          {loadingHistory ? (
                            <div className="flex items-center justify-center py-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : historyData.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2">
                              変更履歴はありません
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {historyData.map((h) => (
                                <div key={h.id} className="text-xs border-b pb-1.5 last:border-0">
                                  <div className="text-muted-foreground">
                                    {new Date(h.changedAt).toLocaleString("ja-JP")} — {h.changedByName}
                                  </div>
                                  <div>
                                    <span className="line-through text-red-500">{h.oldDisplayName ?? "（なし）"}</span>
                                    {" → "}
                                    <span className="text-green-600">{h.newDisplayName ?? "（なし）"}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      {/* 削除ボタン */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* アップロード確認ダイアログ */}
              <UploadConfirmationDialog
                open={showUploadDialog}
                onClose={() => {
                  setShowUploadDialog(false);
                  setPendingFiles([]);
                }}
                files={pendingFiles}
                onConfirm={handleUploadConfirm}
                uploading={uploadingAttachment}
                defaultDisplayName={`${group.counterpartyName}_${group.invoiceNumber ?? `INV-${String(group.id).padStart(4, "0")}`}`}
                existingAttachmentNames={groupAttachments.map((a) => a.generatedName || a.fileName)}
              />
            </div>
          )}

          {/* 請求書作成タブ */}
          {activeTab === "invoice-builder" && (
            <div className="p-1 h-full">
              <InvoiceBuilderTab
                groupId={group.id}
                projectId={projectId}
                onInvoiceCreated={() => setInvoiceCreated(true)}
                onPdfGenerated={handlePdfGenerated}
                isEditable={isEditable || invoiceCreated}
                invoiceDate={invoiceDate}
                paymentDueDate={paymentDueDate}
                onInvoiceDateChange={setInvoiceDate}
                onPaymentDueDateChange={setPaymentDueDate}
              />
            </div>
          )}

          {/* 送信履歴タブ */}
          {activeTab === "history" && (
            <div className="p-1 space-y-3">
              {loadingMailHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : mailHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  送信履歴がありません
                </div>
              ) : (
                <div className="space-y-2">
                  {mailHistory.map((mail) => (
                    <div
                      key={mail.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              mail.status === "sent"
                                ? "default"
                                : mail.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={
                              mail.status === "sent"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : undefined
                            }
                          >
                            {mail.status === "sent"
                              ? "送信済み"
                              : mail.status === "failed"
                                ? "失敗"
                                : mail.status === "draft"
                                  ? "下書き"
                                  : mail.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {mail.sendMethod === "email" ? "メール" : mail.sendMethod === "line" ? "LINE" : mail.sendMethod === "postal" ? "郵送" : mail.sendMethod}
                          </span>
                          {mail.sentAt && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(mail.sentAt).toLocaleString("ja-JP")}
                            </span>
                          )}
                        </div>
                      </div>
                      {mail.subject && (
                        <p className="text-sm font-medium">{mail.subject}</p>
                      )}
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {mail.recipientEmails.length > 0 && (
                          <div>宛先: {mail.recipientEmails.join(", ")}</div>
                        )}
                        {mail.sentByName && (
                          <div>送信者: {mail.sentByName}</div>
                        )}
                      </div>
                      {mail.status === "failed" && mail.errorMessage && (
                        <div className="text-xs text-red-600 bg-red-50 rounded p-2">
                          {mail.errorMessage}
                        </div>
                      )}
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
                invoiceGroupId={group.id}
                allowCommentTypes
              />
            </div>
          )}

          {/* 入出金紐付けタブ */}
          {activeTab === "statement-links" && (
            <div className="p-3">
              <GroupStatementLinkPanel
                groupKind="invoice"
                groupId={group.id}
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

        {/* PDF作成後のアクション選択ダイアログ */}
        <Dialog open={showPdfActionDialog} onOpenChange={handleClosePdfActionDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                請求書PDFを作成しました
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  handleViewPdf();
                  handleClosePdfActionDialog();
                }}
              >
                <Eye className="h-4 w-4" />
                PDFを確認する
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  handleDownloadPdf();
                  handleClosePdfActionDialog();
                }}
              >
                <Download className="h-4 w-4" />
                ダウンロードする
              </Button>
              <Button
                className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  handleClosePdfActionDialog();
                  setShowMailModal(true);
                }}
              >
                <Send className="h-4 w-4" />
                取引先へ送付する
              </Button>
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={handleClosePdfActionDialog}>
                閉じる
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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

        {/* 差し戻し依頼ダイアログ */}
        <AlertDialog open={showReturnRequestDialog} onOpenChange={setShowReturnRequestDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>差し戻し依頼</AlertDialogTitle>
              <AlertDialogDescription>
                経理担当者に差し戻しを依頼します。理由を入力してください。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={returnRequestBody}
              onChange={(e) => setReturnRequestBody(e.target.value)}
              placeholder="差し戻し理由を入力してください"
              rows={3}
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setReturnRequestBody(""); }}>
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={!returnRequestBody.trim() || loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const result = await requestReturnInvoiceGroup(group.id, { body: returnRequestBody.trim() });
                    if (!result.ok) {
                      alert(result.error);
                      return;
                    }
                    alert("差し戻し依頼を送信しました");
                    setShowReturnRequestDialog(false);
                    setReturnRequestBody("");
                    onClose();
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "エラーが発生しました");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                送信
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

        {/* インライン取引作成 */}
        {showInlineForm && (
          <InlineTransactionForm
            onClose={() => setShowInlineForm(false)}
            onCreated={() => {
              setLoadingUngrouped(true);
              getUngroupedTransactions(group.counterpartyId)
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
