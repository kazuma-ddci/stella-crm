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
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Trash2,
  Mail,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  AlertTriangle,
  Upload,
  Pencil,
  History,
  Check,
  X,
  Lock,
  Copy,
  Clock,
  Undo2,
} from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CommentSection } from "@/app/finance/comments/comment-section";
import { ReceiptsReadonly } from "@/components/finance/receipts-readonly";
import { PaymentGroupMailModal } from "./payment-group-mail-modal";
import { getPaymentGroupMailHistory, type MailHistoryItem } from "./mail-actions";
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
  approvePaymentGroup,
  rejectInvoice,
  updatePaymentGroupStatus,
  addTransactionToPaymentGroup,
  removeTransactionFromPaymentGroup,
  getUngroupedExpenseTransactions,
  getPaymentGroupTransactions,
  submitPaymentGroupToAccounting,
  requestReturnPaymentGroup,
  cancelPaymentGroupHandover,
  getPaymentGroupAttachments,
  addPaymentGroupAttachments,
  deletePaymentGroupAttachment,
} from "./actions";
import {
  getGroupAllocationWarnings,
  type AllocationWarning,
} from "@/app/finance/transactions/allocation-group-item-actions";
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
import { toast } from "sonner";

const SEND_METHOD_LABELS: Record<string, string> = {
  email: "メール",
  line: "LINE",
  postal: "郵送",
  other: "その他",
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "承認待ち",
  unprocessed: "未処理",
  before_request: "依頼前",
  requested: "発行依頼済み",
  invoice_received: "請求書受領",
  rejected: "差し戻し",
  re_requested: "再依頼済み",
  confirmed: "確認済み",
  awaiting_accounting: "経理引渡済み",
  paid: "支払済み",
  returned: "差し戻し",
};

type Props = {
  open: boolean;
  onClose: () => void;
  group: PaymentGroupListItem;
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  expenseCategories: { id: number; name: string; type: string }[];
  canEditAccounting?: boolean;
};

export function PaymentGroupDetailModal({
  open,
  onClose,
  group,
  expenseCategories,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "detail" | "transactions" | "add" | "attachments" | "history" | "comments"
  >("detail");

  // 編集可能な情報
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>(
    group.expectedPaymentDate ?? ""
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>(
    group.paymentDueDate ?? ""
  );
  const [isConfidentialState, setIsConfidentialState] = useState<boolean>(
    group.isConfidential ?? false
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
  const [mailModalInitialTab, setMailModalInitialTab] = useState<"email" | "manual">("email");

  // 差し戻し依頼ダイアログ
  const [showReturnRequestDialog, setShowReturnRequestDialog] = useState(false);
  const [returnRequestBody, setReturnRequestBody] = useState("");

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

  // 受領記録待ちフラグ（証憑アップロード後に自動確認を出す）
  const [pendingReceiptRecord, setPendingReceiptRecord] = useState(false);

  // 送信履歴
  const [mailHistory, setMailHistory] = useState<MailHistoryItem[]>([]);
  const [loadingMailHistory, setLoadingMailHistory] = useState(false);

  const isEditable = ["pending_approval", "before_request", "rejected"].includes(group.status);
  const canDelete = ["pending_approval", "before_request"].includes(group.status);

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
    getUngroupedExpenseTransactions(group.counterpartyId ?? undefined)
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
    setIsConfidentialState(group.isConfidential ?? false);
  }, [group.expectedPaymentDate, group.paymentDueDate, group.isConfidential]);

  // 按分警告を取得
  useEffect(() => {
    if (!open) return;
    if (group.allocationItemCount === 0 && group.transactionCount === 0) return;
    let cancelled = false;
    getGroupAllocationWarnings("payment", group.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAllocationWarnings(result.data);
      } else {
        setAllocationWarnings([]);
      }
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

  // 送信履歴を取得
  useEffect(() => {
    if (!open || activeTab !== "history") return;
    let cancelled = false;
    setLoadingMailHistory(true);
    getPaymentGroupMailHistory(group.id)
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

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updatePaymentGroup(group.id, {
        expectedPaymentDate: expectedPaymentDate || null,
        paymentDueDate: paymentDueDate || null,
        isConfidential: isConfidentialState,
      });
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

  const handleDelete = async () => {
    if (
      !confirm(
        "この支払を削除しますか？取引は支払から外れます。"
      )
    )
      return;
    setLoading(true);
    try {
      const result = await deletePaymentGroup(group.id);
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
    if (!confirm("この取引を支払から外しますか？")) return;
    setLoading(true);
    try {
      const result = await removeTransactionFromPaymentGroup(group.id, transactionId);
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

  const handleAddTransactions = async () => {
    if (selectedAddIds.size === 0) return;
    setLoading(true);
    try {
      const result = await addTransactionToPaymentGroup(
        group.id,
        Array.from(selectedAddIds)
      );
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

  // 請求書受領を記録
  const handleRecordReceived = async () => {
    setLoading(true);
    try {
      const attachments = await getPaymentGroupAttachments(group.id);
      if (attachments.length === 0) {
        toast.error("証憑タブから請求書ファイルをアップロードしてください。");
        setActiveTab("attachments");
        setPendingReceiptRecord(true);
        return;
      }
      if (!confirm("請求書の受領・保管が完了しました。受領を記録しますか？")) return;
      const result = await updatePaymentGroupStatus(group.id, "invoice_received");
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

  // 確認する
  const handleConfirm = async () => {
    if (!paymentDueDate && !expectedPaymentDate) {
      alert("支払期限または支払予定日を入力してください");
      return;
    }
    if (!confirm("この支払を確認済みにしますか？")) return;
    setLoading(true);
    try {
      // まず日付情報を保存
      {
        const r = await updatePaymentGroup(group.id, {
          expectedPaymentDate: expectedPaymentDate || null,
          paymentDueDate: paymentDueDate || null,
        });
        if (!r.ok) {
          alert(r.error);
          return;
        }
      }
      // 確認ステータスへ遷移
      const result = await confirmReceivedInvoice(group.id, {
        expectedPaymentDate: expectedPaymentDate || undefined,
      });
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

  // 承認する（pending_approval → before_request）
  const handleApprove = async () => {
    if (!confirm("この支払を承認しますか？承認後、請求書発行依頼に進めます。")) return;
    setLoading(true);
    try {
      const result = await approvePaymentGroup(group.id);
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

  // 却下して再依頼
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("却下理由を入力してください");
      return;
    }
    setLoading(true);
    try {
      const result = await rejectInvoice(group.id, rejectReason.trim());
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setShowRejectDialog(false);
      setRejectReason("");
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
      const result = await submitPaymentGroupToAccounting(group.id);
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
      const response = await fetch("/api/finance/payment-groups/upload", {
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

      await addPaymentGroupAttachments(group.id, filesWithMetadata);
      const atts = await getPaymentGroupAttachments(group.id);
      setGroupAttachments(atts);
      setShowUploadDialog(false);
      setPendingFiles([]);

      // 受領記録待ちの場合、アップロード完了後に確認を出す
      if (pendingReceiptRecord) {
        setPendingReceiptRecord(false);
        if (confirm("請求書の受領・保管が完了しました。受領を記録しますか？")) {
          const r = await updatePaymentGroupStatus(group.id, "invoice_received");
          if (!r.ok) {
            alert(r.error);
            return;
          }
          onClose();
          return;
        }
      }
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
      const atts = await getPaymentGroupAttachments(group.id);
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
      await deletePaymentGroupAttachment(attachmentId);
      setGroupAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="wide" className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap pr-6">
            <DialogTitle className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">支払詳細</span>
              <span className="font-mono text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                #{group.id}
              </span>
              {group.isConfidential && (
                <span className="text-amber-500" title="機密">
                  <Lock className="h-4 w-4" />
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              {/* before_request: 発行依頼メール送信 + 手動で依頼済み */}
              {group.paymentType === "invoice" && group.status === "before_request" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMailModalInitialTab("email");
                      setShowMailModal(true);
                    }}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Mail className="mr-1 h-4 w-4" />
                    発行依頼メール送信
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMailModalInitialTab("manual");
                      setShowMailModal(true);
                    }}
                    disabled={loading}
                  >
                    手動で依頼済み
                  </Button>
                </>
              )}

              {/* requested / re_requested: 請求書受領を記録 */}
              {group.paymentType === "invoice" && (group.status === "requested" || group.status === "re_requested") && (
                <Button
                  size="sm"
                  onClick={handleRecordReceived}
                  disabled={loading}
                >
                  <FileText className="mr-1 h-4 w-4" />
                  請求書受領を記録
                </Button>
              )}

              {/* invoice_received: 確認する + 却下して再依頼 */}
              {group.paymentType === "invoice" && group.status === "invoice_received" && (
                <>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={loading}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    確認する
                  </Button>
                  {!paymentDueDate && !expectedPaymentDate && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      支払期限/支払予定日を入力
                    </span>
                  )}
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

              {/* rejected: 再依頼メール送信 + 手動で依頼済み */}
              {group.paymentType === "invoice" && group.status === "rejected" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setMailModalInitialTab("email");
                      setShowMailModal(true);
                    }}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Mail className="mr-1 h-4 w-4" />
                    再依頼メール送信
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMailModalInitialTab("manual");
                      setShowMailModal(true);
                    }}
                    disabled={loading}
                  >
                    手動で依頼済み
                  </Button>
                </>
              )}

              {/* pending_approval: 承認する */}
              {group.status === "pending_approval" && (
                <Button size="sm" onClick={handleApprove} disabled={loading}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  承認する
                </Button>
              )}

              {/* confirmed: 経理へ引渡 */}
              {group.status === "confirmed" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={loading}>
                      <Send className="mr-1 h-4 w-4" />
                      経理へ引渡
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>経理へ引渡しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この支払を経理部門へ引渡します。按分確定が完了していない取引が含まれている場合はエラーになります。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmitToAccounting}>
                        引渡する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* awaiting_accounting: 引渡取消ボタン */}
              {group.status === "awaiting_accounting" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("経理引渡を取り消して「確認済み」に戻しますか？\n※経理側で仕訳処理が開始されている場合は取り消せません。")) return;
                    setLoading(true);
                    try {
                      const result = await cancelPaymentGroupHandover(group.id);
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

              {/* paid: 支払済みバッジ */}
              {group.status === "paid" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  支払済み
                </span>
              )}

              {/* returned: 確認済みに戻す */}
              {group.status === "returned" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("確認済みに戻しますか？")) return;
                    setLoading(true);
                    try {
                      const result = await updatePaymentGroupStatus(group.id, "confirmed");
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
                  確認済みに戻す
                </Button>
              )}
            </div>
          </div>
          {/* ステータスフロー ステップインジケータ */}
          {(() => {
            const steps = [
                  { key: "pending_approval", label: "承認待ち" },
                  { key: "before_request", label: "依頼前" },
                  { key: "requested", label: "依頼済み" },
                  { key: "invoice_received", label: "請求書受領" },
                  { key: "confirmed", label: "確認済み" },
                  { key: "awaiting_accounting", label: "経理引渡" },
                  { key: "paid", label: "支払済み" },
                ];
            const currentIdx = steps.findIndex((s) => s.key === group.status);
            // returned/rejected/re_requested は特殊ステータスなので非表示
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
            onClick={() => setActiveTab("attachments")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === "attachments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            証憑
          </button>
          {group.paymentType === "invoice" && (
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
          )}
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
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ステータス表示 - 全タブ共通・スクロール時固定 */}
          <div className="sticky top-0 z-10 bg-white px-1 pt-1">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div>
                <span className="text-sm text-muted-foreground">ステータス: </span>
                <span className="font-medium">{STATUS_LABELS[group.status] ?? group.status}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* awaiting_accounting / paid: 差し戻し依頼ボタン */}
                {(group.status === "awaiting_accounting" || group.status === "paid") && (
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
              </div>
            </div>
          </div>

          {/* 基本情報タブ */}
          {activeTab === "detail" && (
            <div className="space-y-4 p-1">
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
                    className="mt-1 disabled:opacity-100 disabled:bg-gray-100 disabled:text-gray-900"
                  />
                </div>
                <div>
                  <Label>支払元法人</Label>
                  <Input
                    value={group.operatingCompanyName}
                    disabled
                    className="mt-1 disabled:opacity-100 disabled:bg-gray-100 disabled:text-gray-900"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-paymentDueDate">
                    支払期限
                  </Label>
                  <DatePicker
                    id="detail-paymentDueDate"
                    value={paymentDueDate}
                    onChange={setPaymentDueDate}
                    disabled={!isEditable && group.status !== "invoice_received"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="detail-expectedPaymentDate">
                    支払予定日
                  </Label>
                  <DatePicker
                    id="detail-expectedPaymentDate"
                    value={expectedPaymentDate}
                    onChange={setExpectedPaymentDate}
                    disabled={!isEditable && group.status !== "invoice_received"}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* 機密チェックボックス */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="detail-isConfidential"
                  checked={isConfidentialState}
                  onChange={(e) => setIsConfidentialState(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="detail-isConfidential" className="text-sm font-normal cursor-pointer">
                  機密（作成者と経理担当のみ閲覧可能）
                </Label>
              </div>

              {/* 参照コード・返信待ち受信先 */}
              {(group.referenceCode || group.expectedInboundEmail) && (
                <div className="rounded-lg border p-3 space-y-2">
                  {group.referenceCode && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">参照コード:</span>
                      <span className="font-mono font-medium">{group.referenceCode}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(group.referenceCode || "");
                          toast.success("コピーしました");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {group.expectedInboundEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">返信待ち受信先:</span>
                      <span className="text-sm">{group.expectedInboundEmail.email}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 参考情報（読み取り専用） */}
              <div className="rounded-lg bg-gray-50 p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">実際の支払日</div>
                    <div className="mt-0.5 text-sm font-medium">
                      {group.actualPaymentDate ? (
                        <>
                          {group.actualPaymentDate}
                          {group.manualPaymentStatus === "partial" && (
                            <span className="ml-1 text-red-600">(一部支払)</span>
                          )}
                          {group.manualPaymentStatus === "completed" && (
                            <span className="ml-1 text-green-700">(完了)</span>
                          )}
                        </>
                      ) : (
                        <span className="text-orange-600">未支払</span>
                      )}
                    </div>
                  </div>
                  {group.receivedPdfFileName && (
                    <div>
                      <div className="text-xs text-muted-foreground">受領済みPDF</div>
                      <div className="mt-0.5 text-sm font-medium truncate" title={group.receivedPdfFileName}>
                        {group.receivedPdfFileName}
                      </div>
                    </div>
                  )}
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
                  {group.confirmedByName && (
                    <div>
                      <div className="text-xs text-muted-foreground">確認者</div>
                      <div className="mt-0.5 text-sm font-medium">
                        {group.confirmedByName}
                      </div>
                    </div>
                  )}
                  {group.confirmedAt && (
                    <div>
                      <div className="text-xs text-muted-foreground">確認日時</div>
                      <div className="mt-0.5 text-sm font-medium">
                        {group.confirmedAt}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 支払記録（経理側で記録された分割支払を読み取り専用で表示） */}
              <ReceiptsReadonly
                mode="payment"
                totalAmount={group.totalAmount}
                records={group.payments.map((p) => ({
                  id: p.id,
                  date: p.paidDate,
                  amount: p.amount,
                  comment: p.comment,
                  createdByName: p.createdByName,
                  isBankLinked: p.isBankLinked,
                }))}
                status={group.paymentStatus}
                recordTotal={group.paymentTotal}
                manualPaymentStatus={group.manualPaymentStatus}
              />

              {/* 金額表示 */}
              <div className="rounded-lg border p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      小計
                    </div>
                    <div className="text-lg font-bold">
                      ¥{((group.totalAmount ?? 0) - (group.taxAmount ?? 0)).toLocaleString()}
                    </div>
                  </div>
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
                  {(isEditable || ["invoice_received", "confirmed"].includes(group.status)) && (
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
                      className="flex items-center gap-2 p-2 border rounded-md bg-gray-50"
                    >
                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      {/* 証憑種類バッジ */}
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
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
                defaultDisplayName={`${group.counterpartyName}_${group.referenceCode ?? `PG-${String(group.id).padStart(4, "0")}`}`}
                existingAttachmentNames={groupAttachments.map((a) => a.generatedName || a.fileName)}
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
                          <Badge variant="outline" className="text-xs">
                            {SEND_METHOD_LABELS[mail.sendMethod] ?? mail.sendMethod}
                          </Badge>
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
                      {mail.sendMethod !== "email" && mail.body && (
                        <div className="text-xs text-muted-foreground bg-gray-50 rounded p-2">
                          {mail.body}
                        </div>
                      )}
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
          initialTab={mailModalInitialTab}
        />

        {/* インライン取引作成 */}
        {showInlineForm && (
          <InlineTransactionForm
            onClose={() => setShowInlineForm(false)}
            onCreated={() => {
              setLoadingUngrouped(true);
              getUngroupedExpenseTransactions(group.counterpartyId ?? undefined)
                .then((txs) => {
                  setUngroupedTransactions(txs);
                  setLoadingUngrouped(false);
                })
                .catch(() => setLoadingUngrouped(false));
            }}
            counterpartyId={group.counterpartyId!}
            expenseCategories={expenseCategories}
          />
        )}

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
                    const result = await requestReturnPaymentGroup(group.id, { body: returnRequestBody.trim() });
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
      </DialogContent>
    </Dialog>
  );
}
