"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  Plus,
  PlusCircle,
  Eye,
} from "lucide-react";
import type {
  UngroupedExpenseTransaction,
  UngroupedAllocationItem,
  PaymentGroupListItem,
} from "./actions";
import { CreatePaymentGroupModal } from "./create-payment-group-modal";
import { TransactionPreviewModal } from "../transactions/transaction-preview-modal";

type Props = {
  ungroupedTransactions: UngroupedExpenseTransaction[];
  ungroupedAllocationItems: UngroupedAllocationItem[];
  draftPaymentGroups: PaymentGroupListItem[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  expenseCategories: { id: number; name: string; type: string }[];
  unconfirmedTransactions: UngroupedExpenseTransaction[];
  projectId?: number;
};

type CounterpartyGroup = {
  counterpartyId: number;
  counterpartyName: string;
  transactions: UngroupedExpenseTransaction[];
  totalAmount: number;
  draftGroup: PaymentGroupListItem | null;
};

export function UngroupedExpensesPanel({
  ungroupedTransactions,
  ungroupedAllocationItems,
  draftPaymentGroups,
  counterpartyOptions,
  operatingCompanyOptions,
  expenseCategories,
  unconfirmedTransactions,
  projectId,
}: Props) {
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preSelectedCounterpartyId, setPreSelectedCounterpartyId] = useState<
    string | null
  >(null);
  const [expandedUnconfirmed, setExpandedUnconfirmed] = useState<Set<number>>(new Set());
  const [previewTxId, setPreviewTxId] = useState<number | null>(null);

  // 取引先ごとにグループ化
  const counterpartyGroups = useMemo(() => {
    const grouped = new Map<number, UngroupedExpenseTransaction[]>();
    for (const tx of ungroupedTransactions) {
      if (!grouped.has(tx.counterpartyId)) {
        grouped.set(tx.counterpartyId, []);
      }
      grouped.get(tx.counterpartyId)!.push(tx);
    }

    const result: CounterpartyGroup[] = [];
    for (const [counterpartyId, transactions] of grouped) {
      const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const draftGroup =
        draftPaymentGroups.find(
          (g) =>
            g.counterpartyId === counterpartyId &&
            g.status === "before_request"
        ) ?? null;

      result.push({
        counterpartyId,
        counterpartyName: transactions[0].counterpartyName,
        transactions,
        totalAmount,
        draftGroup,
      });
    }

    // 件数の多い順にソート
    result.sort((a, b) => b.transactions.length - a.transactions.length);
    return result;
  }, [ungroupedTransactions, draftPaymentGroups]);

  // 未確定取引を取引先ごとにグループ化
  const unconfirmedByCounterparty = useMemo(() => {
    const grouped = new Map<number, UngroupedExpenseTransaction[]>();
    for (const t of unconfirmedTransactions) {
      if (!grouped.has(t.counterpartyId)) {
        grouped.set(t.counterpartyId, []);
      }
      grouped.get(t.counterpartyId)!.push(t);
    }
    return grouped;
  }, [unconfirmedTransactions]);

  const toggleExpand = (counterpartyId: number) => {
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

  const handleCreatePayment = (counterpartyId: string) => {
    setPreSelectedCounterpartyId(counterpartyId);
    setShowCreateModal(true);
  };

  if (ungroupedTransactions.length === 0 && ungroupedAllocationItems.length === 0 && unconfirmedTransactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        未処理の経費取引はありません
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
            按分確定済みで、まだ支払に紐づいていない按分取引です。按分取引は支払の詳細画面から追加してください。
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
                通常の経費取引（{ungroupedTransactions.length}件）
              </h3>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            確認済みで、まだ支払に紐づいていない経費取引の一覧です。取引先ごとにまとめて支払を作成できます。
          </p>
        </>
      )}

      <div className="space-y-3">
        {counterpartyGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.counterpartyId);
          const unconfirmedForCp = unconfirmedByCounterparty.get(group.counterpartyId);
          const isUnconfirmedExpanded = expandedUnconfirmed.has(group.counterpartyId);

          return (
            <Card key={group.counterpartyId}>
              <CardHeader className="pb-3">
                {/* ヘッダー */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleExpand(group.counterpartyId)}
                    className="flex items-center gap-2 text-left hover:text-primary transition-colors"
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
                    <span className="text-sm font-medium text-emerald-600">
                      ¥{group.totalAmount.toLocaleString()}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    {group.draftGroup ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            router.refresh();
                          }}
                        >
                          <PlusCircle className="mr-1 h-3 w-3" />
                          下書きに追加
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleCreatePayment(
                              String(group.counterpartyId)
                            )
                          }
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          新しい支払を作成
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleCreatePayment(
                            String(group.counterpartyId)
                          )
                        }
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        支払を作成
                      </Button>
                    )}
                  </div>
                </div>

                {group.draftGroup && (
                  <div className="flex items-center gap-2 mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      この取引先には下書きの支払があります
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

              {/* 展開時の取引リスト */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="border rounded-lg divide-y">
                    {group.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 px-4 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {tx.expenseCategoryName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {tx.periodFrom} ~ {tx.periodTo}
                            </span>
                          </div>
                          {tx.note && (
                            <div className="text-xs text-muted-foreground truncate">
                              {tx.note}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium">
                            ¥{tx.amount.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            税¥{tx.taxAmount.toLocaleString()} ({tx.taxRate}%)
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
      </div>

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

      {/* 取引プレビューモーダル */}
      {previewTxId !== null && (
        <TransactionPreviewModal
          transactionId={previewTxId}
          open={true}
          onClose={() => setPreviewTxId(null)}
          onConfirmed={() => router.refresh()}
          expenseCategories={expenseCategories}
          transactionType="expense"
        />
      )}

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <CreatePaymentGroupModal
          open={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setPreSelectedCounterpartyId(null);
          }}
          counterpartyOptions={counterpartyOptions}
          operatingCompanyOptions={operatingCompanyOptions}
          expenseCategories={expenseCategories}
          defaultCounterpartyId={preSelectedCounterpartyId ?? undefined}
          projectId={projectId}
        />
      )}
    </div>
  );
}
