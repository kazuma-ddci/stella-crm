"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Check, Clock, AlertCircle, Lock, ChevronDown, ChevronRight, Pencil, Trash2, Undo2, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { JournalEntryModal } from "../../journal/journal-entry-modal";
import { realizeJournalEntry, confirmJournalEntry, deleteJournalEntry } from "../../journal/actions";
import { setTransactionJournalCompleted, getGroupAttachments, addGroupAttachments, deleteGroupAttachment } from "../actions";
import { returnGroupToStp } from "../../batch-complete/actions";
import type { WorkflowGroupDetail, WorkflowTransaction } from "../actions";
import { ReceiptsSection } from "./receipts-section";
import type { JournalFormData } from "../../journal/actions";
import { ATTACHMENT_TYPE_OPTIONS, ATTACHMENT_TYPE_LABELS } from "@/lib/attachments/constants";
/** 税込合計を返す（tax_included の場合 amount がすでに税込） */
function getTaxIncludedTotal(tx: WorkflowTransaction): number {
  return tx.taxType === "tax_included" ? tx.amount : tx.amount + tx.taxAmount;
}

type Props = {
  detail: WorkflowGroupDetail;
  journalFormData: JournalFormData;
};

function TransactionStatusIcon({ transaction }: { transaction: WorkflowTransaction }) {
  const entries = transaction.journalEntries;

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span className="text-xs">未仕訳</span>
      </div>
    );
  }

  const allRealized = entries.every((e) => e.realizationStatus === "realized");
  const realizedCount = entries.filter((e) => e.realizationStatus === "realized").length;

  if (allRealized) {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <Check className="h-4 w-4" />
        <span className="text-xs">全仕訳実現済み</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-yellow-600">
      <Clock className="h-4 w-4" />
      <span className="text-xs">
        実現 {realizedCount}/{entries.length}
      </span>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const config: Record<string, { label: string; className: string }> = {
    needs_journal: { label: "仕訳待ち", className: "bg-red-50 text-red-700 border-red-200" },
    in_progress: { label: "処理中", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    completed: { label: "完了", className: "bg-green-50 text-green-700 border-green-200" },
    returned: { label: "差し戻し中", className: "bg-gray-50 text-gray-600 border-gray-200" },
  };
  const c = config[category] ?? { label: category, className: "" };
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

export function GroupDetailClient({ detail, journalFormData }: Props) {
  const router = useRouter();
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [expandedJournalIds, setExpandedJournalIds] = useState<Set<number>>(new Set());
  const [editJournalEntry, setEditJournalEntry] = useState<WorkflowTransaction["journalEntries"][number] | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // 証憑管理
  type AttachmentRow = { id: number; fileName: string; filePath: string; fileSize: number | null; mimeType: string | null; attachmentType: string; displayName: string | null; generatedName: string | null; createdAt: string };
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getGroupAttachments(detail.id, detail.groupType).then(setAttachments);
  }, [detail.id, detail.groupType]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      const uploadEndpoint = detail.groupType === "invoice"
        ? "/api/finance/invoice-groups/upload"
        : "/api/finance/payment-groups/upload";
      const formData = new FormData();
      formData.append("groupId", detail.id.toString());
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "アップロードに失敗しました");
      }
      const { files: uploadedFiles } = await res.json();
      await addGroupAttachments(detail.id, detail.groupType, uploadedFiles);
      const updated = await getGroupAttachments(detail.id, detail.groupType);
      setAttachments(updated);
      toast.success(`${files.length}件の証憑をアップロードしました`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await deleteGroupAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("証憑を削除しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const isCompleted = detail.category === "completed";
  const isReturned = detail.category === "returned";
  const isReadOnly = isCompleted || isReturned;

  const openCreateJournal = (transactionId: number, projectId: number | null) => {
    setSelectedTransactionId(transactionId);
    setSelectedProjectId(projectId ?? null);
    setJournalModalOpen(true);
  };

  const handleJournalSuccess = async () => {
    setJournalModalOpen(false);
    setEditModalOpen(false);
    setEditJournalEntry(null);
    router.refresh();
  };

  const openEditJournal = (je: WorkflowTransaction["journalEntries"][number]) => {
    setEditJournalEntry(je);
    setEditModalOpen(true);
  };

  const handleConfirm = async (journalEntryId: number) => {
    setProcessingId(journalEntryId);
    const result = await confirmJournalEntry(journalEntryId);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("仕訳を確定しました");
      router.refresh();
    }
    setProcessingId(null);
  };

  const handleRealize = async (journalEntryId: number) => {
    setProcessingId(journalEntryId);
    const result = await realizeJournalEntry(journalEntryId);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("仕訳を実現にしました");
      router.refresh();
    }
    setProcessingId(null);
  };

  const [completeConfirmId, setCompleteConfirmId] = useState<number | null>(null);

  const handleConfirmComplete = async () => {
    if (completeConfirmId === null) return;
    const result = await setTransactionJournalCompleted(completeConfirmId, true);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      router.refresh();
    }
    setCompleteConfirmId(null);
  };

  const handleUncomplete = async (transactionId: number) => {
    const result = await setTransactionJournalCompleted(transactionId, false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returning, setReturning] = useState(false);

  const handleReturnToStp = async () => {
    setReturning(true);
    try {
      const result = await returnGroupToStp(detail.id, detail.groupType, returnReason.trim() || undefined);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("プロジェクト側に差し戻しました");
      setShowReturnDialog(false);
      setReturnReason("");
      router.push("/accounting/workflow");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setReturning(false);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleDeleteJournal = async () => {
    if (deleteConfirmId === null) return;
    const result = await deleteJournalEntry(deleteConfirmId);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("仕訳を削除しました");
      router.refresh();
    }
    setDeleteConfirmId(null);
  };

  const toggleExpandJournal = (id: number) => {
    setExpandedJournalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupTypeLabel = detail.groupType === "invoice" ? "請求" : "支払";

  return (
    <>
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounting/workflow">
            <ArrowLeft className="h-4 w-4 mr-1" />
            戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {groupTypeLabel}グループ: {detail.label}
        </h1>
        <CategoryBadge category={detail.category} />
        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => setShowReturnDialog(true)}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            プロジェクトへ差し戻し
          </Button>
        )}
      </div>

      {/* グループ概要 + 条件ステータス */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">取引先</span>
              <p className="font-medium">{detail.counterpartyName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">合計金額</span>
              <p className="font-medium">
                {detail.totalAmount != null
                  ? `¥${detail.totalAmount.toLocaleString()}`
                  : "-"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">取引数</span>
              <p className="font-medium">{detail.transactions.length}件</p>
            </div>
          </div>

          {/* 3条件のステータス表示 */}
          <div className="flex gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              {detail.isAllJournalized ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3 mr-1" />仕訳完了
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <AlertCircle className="h-3 w-3 mr-1" />仕訳未完了
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {detail.isAllRealized ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3 mr-1" />全実現
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <Clock className="h-3 w-3 mr-1" />実現待ち
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 経理判断による入金/支払ステータス（手動フラグ） */}
              {detail.manualPaymentStatus === "completed" ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3 mr-1" />
                  {detail.groupType === "invoice" ? "入金" : "支払"}完了
                  {detail.actualPaymentDate && (
                    <span className="ml-1 font-mono">
                      ({new Date(detail.actualPaymentDate).toLocaleDateString("ja-JP")})
                    </span>
                  )}
                </Badge>
              ) : detail.manualPaymentStatus === "partial" ? (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                  一部{detail.groupType === "invoice" ? "入金" : "支払"}
                  {detail.actualPaymentDate && (
                    <span className="ml-1 font-mono">
                      ({new Date(detail.actualPaymentDate).toLocaleDateString("ja-JP")})
                    </span>
                  )}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <Clock className="h-3 w-3 mr-1" />未{detail.groupType === "invoice" ? "入金" : "支払"}
                </Badge>
              )}
            </div>
            {isCompleted && (
              <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                <Lock className="h-3 w-3 mr-1" />ロック済み
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 差し戻し中の場合のメッセージ */}
      {isReturned && (
        <Card className="border-gray-300 bg-gray-50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              このグループはプロジェクト側に差し戻されています。プロジェクト側の対応が完了するまで操作できません。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 入金/支払の分割記録 — 仕訳と独立して経理が記録 */}
      <ReceiptsSection
        groupType={detail.groupType}
        groupId={detail.id}
        totalAmount={detail.totalAmount}
        readOnly={isReturned}
      />

      {/* 取引一覧 */}
      {detail.transactions.map((tx) => (
        <Card key={tx.id} className={isReadOnly ? "opacity-75" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">
                  {tx.type === "revenue" ? (
                    <span className="text-green-600">売上</span>
                  ) : (
                    <span className="text-red-600">経費</span>
                  )}
                  {" - "}
                  {tx.expenseCategoryName}
                </CardTitle>
                <TransactionStatusIcon transaction={tx} />
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  tx.journalCompleted ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="h-3 w-3 mr-1" />仕訳完了
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => handleUncomplete(tx.id)}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setCompleteConfirmId(tx.id)}
                    >
                      仕訳完了
                    </Button>
                  )
                )}
                <span className="text-lg font-bold">
                  ¥{getTaxIncludedTotal(tx).toLocaleString()}
                </span>
                {!isReadOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCreateJournal(tx.id, tx.projectId)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    仕訳作成
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 取引情報 */}
            <div className="grid grid-cols-4 gap-3 text-sm mb-4 pb-4 border-b">
              <div>
                <span className="text-muted-foreground">取引先</span>
                <p>{tx.counterpartyName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {tx.taxType === "tax_included" ? "金額（税込）" : "金額（税抜）"}
                </span>
                <p>¥{tx.amount.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">消費税</span>
                <p>¥{tx.taxAmount.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">発生期間</span>
                <p className="whitespace-nowrap">
                  {new Date(tx.periodFrom).toLocaleDateString("ja-JP")}
                  {" 〜 "}
                  {new Date(tx.periodTo).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>

            {tx.note && (
              <p className="text-sm text-muted-foreground mb-4">メモ: {tx.note}</p>
            )}

            {/* 仕訳一覧 */}
            {tx.journalEntries.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  仕訳（{tx.journalEntries.length}件）
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>仕訳日</TableHead>
                      <TableHead>実現</TableHead>
                      <TableHead>摘要</TableHead>
                      <TableHead>借方勘定</TableHead>
                      <TableHead>貸方勘定</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>ステータス</TableHead>
                      {!isReadOnly && <TableHead className="w-[80px]">操作</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tx.journalEntries.map((je) => {
                      const isExpanded = expandedJournalIds.has(je.id);
                      const debitAccounts = je.lines
                        .filter((l) => l.side === "debit")
                        .map((l) => l.accountName);
                      const creditAccounts = je.lines
                        .filter((l) => l.side === "credit")
                        .map((l) => l.accountName);
                      return (
                        <Fragment key={je.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleExpandJournal(je.id)}
                          >
                            <TableCell className="px-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {new Date(je.journalDate).toLocaleDateString("ja-JP")}
                            </TableCell>
                            <TableCell>
                              {je.realizationStatus === "realized" ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  実現
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  未実現
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {je.description}
                            </TableCell>
                            <TableCell className="text-sm">
                              {[...new Set(debitAccounts)].join("、") || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {[...new Set(creditAccounts)].join("、") || "-"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              ¥{je.debitTotal.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {je.status === "confirmed" ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  確定
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                                  下書き
                                </Badge>
                              )}
                            </TableCell>
                            {!isReadOnly && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => openEditJournal(je)}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    編集
                                  </Button>
                                  {je.status === "draft" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-green-700"
                                      onClick={() => handleConfirm(je.id)}
                                      disabled={processingId === je.id}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      確定
                                    </Button>
                                  )}
                                  {je.status === "confirmed" && je.realizationStatus === "unrealized" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => handleRealize(je.id)}
                                      disabled={processingId === je.id}
                                    >
                                      実現化
                                    </Button>
                                  )}
                                  {je.status === "draft" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-red-600 hover:text-red-700"
                                      onClick={() => setDeleteConfirmId(je.id)}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      削除
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                          {isExpanded && (() => {
                            const debitLines = je.lines.filter((l) => l.side === "debit");
                            const creditLines = je.lines.filter((l) => l.side === "credit");
                            const debitTotal = debitLines.reduce((sum, l) => sum + l.amount, 0);
                            const creditTotal = creditLines.reduce((sum, l) => sum + l.amount, 0);
                            const maxRows = Math.max(debitLines.length, creditLines.length);
                            return (
                              <TableRow>
                                <TableCell colSpan={!isReadOnly ? 9 : 8} className="p-0">
                                  <div className="bg-muted/30 px-8 py-3 overflow-x-auto">
                                    <div className="grid grid-cols-2 gap-0 min-w-[700px]">
                                      {/* 借方 */}
                                      <div className="border-r">
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-red-50/50 border-b">
                                          <span className="text-xs font-medium text-red-700">借方（Debit）</span>
                                          <span className="text-xs font-medium text-red-700">合計: ¥{debitTotal.toLocaleString()}</span>
                                        </div>
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b">
                                              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-1.5">勘定科目</th>
                                              <th className="text-xs font-medium text-muted-foreground text-right px-3 py-1.5">金額</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Array.from({ length: maxRows }).map((_, idx) => {
                                              const line = debitLines[idx];
                                              return (
                                                <tr key={idx} className="border-b last:border-b-0">
                                                  <td className="text-xs px-3 py-1.5">{line?.accountName ?? ""}</td>
                                                  <td className="text-xs text-right px-3 py-1.5 whitespace-nowrap">
                                                    {line ? `¥${line.amount.toLocaleString()}` : ""}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      {/* 貸方 */}
                                      <div>
                                        <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/50 border-b">
                                          <span className="text-xs font-medium text-blue-700">貸方（Credit）</span>
                                          <span className="text-xs font-medium text-blue-700">合計: ¥{creditTotal.toLocaleString()}</span>
                                        </div>
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b">
                                              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-1.5">勘定科目</th>
                                              <th className="text-xs font-medium text-muted-foreground text-right px-3 py-1.5">金額</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Array.from({ length: maxRows }).map((_, idx) => {
                                              const line = creditLines[idx];
                                              return (
                                                <tr key={idx} className="border-b last:border-b-0">
                                                  <td className="text-xs px-3 py-1.5">{line?.accountName ?? ""}</td>
                                                  <td className="text-xs text-right px-3 py-1.5 whitespace-nowrap">
                                                    {line ? `¥${line.amount.toLocaleString()}` : ""}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })()}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                まだ仕訳が作成されていません
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* 証憑セクション */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              証憑 ({attachments.length}件)
            </CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploadingAttachment}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment}
              >
                <Upload className="h-3 w-3 mr-1" />
                {uploadingAttachment ? "アップロード中..." : "証憑を追加"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              証憑がまだ添付されていません
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3 p-2 border rounded text-sm hover:bg-muted/50">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={att.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate block"
                    >
                      {att.displayName || att.generatedName || att.fileName}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {ATTACHMENT_TYPE_LABELS[att.attachmentType] || att.attachmentType}
                      </Badge>
                      {att.fileSize && (
                        <span>{(att.fileSize / 1024).toFixed(0)} KB</span>
                      )}
                      <span>{new Date(att.createdAt).toLocaleDateString("ja-JP")}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDeleteAttachment(att.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 仕訳作成モーダル */}
      <JournalEntryModal
        open={journalModalOpen}
        onOpenChange={setJournalModalOpen}
        formData={journalFormData}
        onSuccess={handleJournalSuccess}
        defaultTransactionId={selectedTransactionId ?? undefined}
        defaultProjectId={selectedProjectId ?? undefined}
        defaultCounterpartyId={detail.counterpartyId ?? undefined}
      />

      {/* 仕訳完了確認ダイアログ */}
      <AlertDialog open={completeConfirmId !== null} onOpenChange={(open) => { if (!open) setCompleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>仕訳完了にしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この取引の全仕訳の入力が完了しましたか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmComplete}>
              はい、完了です
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 仕訳削除確認ダイアログ */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>仕訳を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この仕訳を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteJournal} className="bg-red-600 hover:bg-red-700">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 差し戻し確認ダイアログ */}
      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プロジェクト側に差し戻しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この{groupTypeLabel}グループをプロジェクト側に差し戻します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="差し戻し理由（任意）"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReturnReason("")}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturnToStp}
              disabled={returning}
              className="bg-amber-600 hover:bg-amber-700"
            >
              差し戻す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 仕訳編集モーダル */}
      {editJournalEntry && (
        <JournalEntryModal
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setEditJournalEntry(null);
          }}
          formData={journalFormData}
          onSuccess={handleJournalSuccess}
          editEntry={{
            id: editJournalEntry.id,
            journalDate: editJournalEntry.journalDate,
            description: editJournalEntry.description,
            invoiceGroupId: editJournalEntry.invoiceGroupId,
            paymentGroupId: editJournalEntry.paymentGroupId,
            transactionId: editJournalEntry.transactionId,
            bankTransactionId: editJournalEntry.bankTransactionId,
            projectId: editJournalEntry.projectId,
            counterpartyId: editJournalEntry.counterpartyId,
            hasInvoice: editJournalEntry.hasInvoice,
            realizationStatus: editJournalEntry.realizationStatus,
            lines: editJournalEntry.lines.map((l) => ({
              id: l.id,
              side: l.side,
              accountId: l.accountId,
              amount: l.amount,
              description: l.description,
              taxClassification: l.taxClassification,
              taxAmount: l.taxAmount,
            })),
          }}
        />
      )}
    </>
  );
}
