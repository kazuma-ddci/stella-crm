"use client";

import { Fragment, useState } from "react";
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
import { ArrowLeft, Plus, Check, Clock, AlertCircle, Lock, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { JournalEntryModal } from "../../journal/journal-entry-modal";
import { realizeJournalEntry, confirmJournalEntry, deleteJournalEntry } from "../../journal/actions";
import { setTransactionJournalCompleted } from "../actions";
import type { WorkflowGroupDetail, WorkflowTransaction } from "../actions";
import type { JournalFormData } from "../../journal/actions";
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
    try {
      await confirmJournalEntry(journalEntryId);
      toast.success("仕訳を確定しました");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRealize = async (journalEntryId: number) => {
    setProcessingId(journalEntryId);
    try {
      await realizeJournalEntry(journalEntryId);
      toast.success("仕訳を実現にしました");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setProcessingId(null);
    }
  };

  const [completeConfirmId, setCompleteConfirmId] = useState<number | null>(null);

  const handleConfirmComplete = async () => {
    if (completeConfirmId === null) return;
    try {
      await setTransactionJournalCompleted(completeConfirmId, true);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    }
    setCompleteConfirmId(null);
  };

  const handleUncomplete = async (transactionId: number) => {
    try {
      await setTransactionJournalCompleted(transactionId, false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleDeleteJournal = async () => {
    if (deleteConfirmId === null) return;
    try {
      await deleteJournalEntry(deleteConfirmId);
      toast.success("仕訳を削除しました");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
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
  const paymentLabel = detail.groupType === "invoice" ? "入金日" : "支払日";

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
              {detail.hasActualPaymentDate ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3 mr-1" />
                  {paymentLabel}確認済
                  {detail.actualPaymentDate && (
                    <span className="ml-1 font-mono">
                      ({new Date(detail.actualPaymentDate).toLocaleDateString("ja-JP")})
                    </span>
                  )}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <Clock className="h-3 w-3 mr-1" />{paymentLabel}未確認
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

      {/* 仕訳作成モーダル */}
      <JournalEntryModal
        open={journalModalOpen}
        onOpenChange={setJournalModalOpen}
        formData={journalFormData}
        onSuccess={handleJournalSuccess}
        defaultTransactionId={selectedTransactionId ?? undefined}
        defaultProjectId={selectedProjectId ?? undefined}
        defaultCounterpartyId={detail.counterpartyId}
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
