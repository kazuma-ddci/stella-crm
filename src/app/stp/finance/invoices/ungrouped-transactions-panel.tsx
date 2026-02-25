"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  Plus,
  FileText,
  Eye,
} from "lucide-react";
import type { InvoiceGroupListItem, UngroupedTransaction, UngroupedAllocationItem } from "./actions";
import { addTransactionToGroup } from "./actions";
import { CreateInvoiceGroupModal } from "./create-invoice-group-modal";
import { TransactionPreviewModal } from "../transactions/transaction-preview-modal";

type Props = {
  ungroupedTransactions: UngroupedTransaction[];
  ungroupedAllocationItems: UngroupedAllocationItem[];
  draftInvoiceGroups: InvoiceGroupListItem[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
  expenseCategories: { id: number; name: string; type: string }[];
  unconfirmedTransactions: UngroupedTransaction[];
  projectId?: number;
};

type CounterpartyGroup = {
  counterpartyId: number;
  counterpartyName: string;
  transactions: UngroupedTransaction[];
  totalAmount: number;
};

export function UngroupedTransactionsPanel({
  ungroupedTransactions,
  ungroupedAllocationItems,
  draftInvoiceGroups,
  counterpartyOptions,
  operatingCompanyOptions,
  bankAccountsByCompany,
  expenseCategories,
  unconfirmedTransactions,
  projectId,
}: Props) {
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preSelectedCounterpartyId, setPreSelectedCounterpartyId] = useState<
    string | null
  >(null);
  const [expandedUnconfirmed, setExpandedUnconfirmed] = useState<Set<number>>(new Set());
  const [previewTxId, setPreviewTxId] = useState<number | null>(null);

  // 取引先ごとにグループ化
  const counterpartyGroups = useMemo(() => {
    const grouped = new Map<number, CounterpartyGroup>();
    for (const t of ungroupedTransactions) {
      let group = grouped.get(t.counterpartyId);
      if (!group) {
        group = {
          counterpartyId: t.counterpartyId,
          counterpartyName: t.counterpartyName,
          transactions: [],
          totalAmount: 0,
        };
        grouped.set(t.counterpartyId, group);
      }
      group.transactions.push(t);
      group.totalAmount += t.amount;
    }
    // 数値IDの昇順でソート（localeCompare回避）
    return Array.from(grouped.values()).sort(
      (a, b) => a.counterpartyId - b.counterpartyId
    );
  }, [ungroupedTransactions]);

  // 未確定取引を取引先ごとにグループ化
  const unconfirmedByCounterparty = useMemo(() => {
    const grouped = new Map<number, UngroupedTransaction[]>();
    for (const t of unconfirmedTransactions) {
      if (!grouped.has(t.counterpartyId)) {
        grouped.set(t.counterpartyId, []);
      }
      grouped.get(t.counterpartyId)!.push(t);
    }
    return grouped;
  }, [unconfirmedTransactions]);

  const toggleExpanded = (counterpartyId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(counterpartyId)) {
        next.delete(counterpartyId);
      } else {
        next.add(counterpartyId);
      }
      return next;
    });
  };

  const toggleUnconfirmedExpanded = (counterpartyId: number) => {
    setExpandedUnconfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(counterpartyId)) {
        next.delete(counterpartyId);
      } else {
        next.add(counterpartyId);
      }
      return next;
    });
  };

  // 取引先に対応する下書き請求を検索
  const getDraftForCounterparty = (counterpartyId: number) => {
    return draftInvoiceGroups.find(
      (g) => g.counterpartyId === counterpartyId
    );
  };

  // 新しい請求を作成（モーダル経由）
  const handleCreateInvoice = (counterpartyId: string, transactions: UngroupedTransaction[]) => {
    setPreSelectedCounterpartyId(counterpartyId);
    setShowCreateModal(true);
  };

  // モーダルに渡す初期取引データ
  const getInitialTransactionsForModal = () => {
    if (!preSelectedCounterpartyId) return undefined;
    const group = counterpartyGroups.find(
      (g) => String(g.counterpartyId) === preSelectedCounterpartyId
    );
    return group?.transactions;
  };

  // 既存の下書きに追加
  const handleAddToDraft = async (
    group: CounterpartyGroup,
    draftGroupId: number
  ) => {
    setLoading(group.counterpartyId);
    try {
      await addTransactionToGroup(
        draftGroupId,
        group.transactions.map((t) => t.id)
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  if (ungroupedTransactions.length === 0 && ungroupedAllocationItems.length === 0 && unconfirmedTransactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">未処理の取引はありません</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          確認済みの売上取引がすべて請求に紐づけられています。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 按分取引セクション */}
      {ungroupedAllocationItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium">
              未処理の按分取引（{ungroupedAllocationItems.length}件）
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            按分確定済みで、まだ請求に紐づいていない按分取引です。按分取引は請求の詳細画面から追加してください。
          </p>
          <div className="border rounded-lg divide-y">
            {ungroupedAllocationItems.map((item) => (
              <div
                key={`${item.transactionId}-${item.costCenterId}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {item.counterpartyName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.expenseCategoryName}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {item.costCenterName} ({item.allocationRate}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{item.periodFrom} 〜 {item.periodTo}</span>
                    {item.ownerCostCenterName && (
                      <span className="text-muted-foreground">
                        代表: {item.ownerCostCenterName}
                      </span>
                    )}
                  </div>
                  {/* 他PJの処理状況 */}
                  {item.otherItems.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {item.otherItems.map((other) => (
                        <span
                          key={other.costCenterName}
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${
                            other.isProcessed
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {other.costCenterName}
                          {other.groupLabel ? `: ${other.groupLabel}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">
                    ¥{item.allocatedAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    税¥{item.allocatedTaxAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 通常取引セクション */}
      {ungroupedTransactions.length > 0 && (
        <>
          {ungroupedAllocationItems.length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <h3 className="text-sm font-medium">
                通常の売上取引（{ungroupedTransactions.length}件）
              </h3>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            確認済みで未請求の売上取引を取引先ごとにまとめています。
            請求を作成すると、選択した取引が請求に紐づけられます。
          </p>
        </>
      )}

      {/* 取引プレビューモーダル */}
      {previewTxId !== null && (
        <TransactionPreviewModal
          transactionId={previewTxId}
          open={true}
          onClose={() => setPreviewTxId(null)}
          onConfirmed={() => router.refresh()}
          expenseCategories={expenseCategories}
          transactionType="revenue"
        />
      )}

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <CreateInvoiceGroupModal
          open={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setPreSelectedCounterpartyId(null);
          }}
          counterpartyOptions={counterpartyOptions}
          operatingCompanyOptions={operatingCompanyOptions}
          bankAccountsByCompany={bankAccountsByCompany}
          expenseCategories={expenseCategories}
          defaultCounterpartyId={preSelectedCounterpartyId ?? undefined}
          initialTransactions={getInitialTransactionsForModal()}
          projectId={projectId}
        />
      )}

      {counterpartyGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.counterpartyId);
        const isLoading = loading === group.counterpartyId;
        const draftGroup = getDraftForCounterparty(group.counterpartyId);
        const unconfirmedForCp = unconfirmedByCounterparty.get(group.counterpartyId);
        const isUnconfirmedExpanded = expandedUnconfirmed.has(group.counterpartyId);

        return (
          <Card key={group.counterpartyId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2 text-left"
                  onClick={() => toggleExpanded(group.counterpartyId)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">
                    {group.counterpartyName}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {group.transactions.length}件
                  </span>
                  <span className="text-sm font-medium">
                    ¥{group.totalAmount.toLocaleString()}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  {isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {draftGroup ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAddToDraft(group, draftGroup.id)
                        }
                        disabled={isLoading}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        下書きに追加
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleCreateInvoice(String(group.counterpartyId), group.transactions)
                        }
                        disabled={isLoading}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        新しい請求を作成
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        handleCreateInvoice(String(group.counterpartyId), group.transactions)
                      }
                      disabled={isLoading}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      請求を作成
                    </Button>
                  )}
                </div>
              </div>

              {draftGroup && (
                <div className="flex items-center gap-2 mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    この取引先には下書きの請求があります
                    {draftGroup.invoiceNumber && (
                      <span className="font-mono ml-1">
                        ({draftGroup.invoiceNumber})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {unconfirmedForCp && unconfirmedForCp.length > 0 && (
                <div className="mt-2 rounded-md bg-blue-50 border border-blue-200 overflow-hidden">
                  <button
                    onClick={() => toggleUnconfirmedExpanded(group.counterpartyId)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    <Info className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">
                      この取引先の未確定の取引が{unconfirmedForCp.length}件あります
                    </span>
                    {isUnconfirmedExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                  {isUnconfirmedExpanded && (
                    <div className="border-t border-blue-200 divide-y divide-blue-100">
                      {unconfirmedForCp.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 px-4 py-2.5 bg-white/50"
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
                          <div className="text-right text-sm mr-2">
                            <div className="font-medium">
                              ¥{t.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              税¥{t.taxAmount.toLocaleString()} ({t.taxRate}%)
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPreviewTxId(t.id)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            詳細
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="border rounded-lg divide-y">
                  {group.transactions.map((t) => (
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
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* 確認済み取引がないが未確定取引だけがある取引先 */}
      {Array.from(unconfirmedByCounterparty.entries())
        .filter(([cpId]) => !counterpartyGroups.some((g) => g.counterpartyId === cpId))
        .sort(([a], [b]) => a - b)
        .map(([counterpartyId, txs]) => {
          const isUnconfirmedExpanded = expandedUnconfirmed.has(counterpartyId);
          return (
            <Card key={`unconfirmed-${counterpartyId}`}>
              <CardHeader className="pb-3">
                <div className="mt-0 rounded-md bg-blue-50 border border-blue-200 overflow-hidden">
                  <button
                    onClick={() => toggleUnconfirmedExpanded(counterpartyId)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    <Info className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium mr-1">{txs[0].counterpartyName}</span>
                    <span className="flex-1 text-left">
                      — 未確定の取引が{txs.length}件あります
                    </span>
                    {isUnconfirmedExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                  {isUnconfirmedExpanded && (
                    <div className="border-t border-blue-200 divide-y divide-blue-100">
                      {txs.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 px-4 py-2.5 bg-white/50"
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
                          <div className="text-right text-sm mr-2">
                            <div className="font-medium">
                              ¥{t.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              税¥{t.taxAmount.toLocaleString()} ({t.taxRate}%)
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPreviewTxId(t.id)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            詳細
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          );
        })}
    </div>
  );
}
