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
  Plus,
  PlusCircle,
  Eye,
  Pencil,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type {
  UngroupedExpenseTransaction,
  UngroupedAllocationItem,
  PaymentGroupListItem,
} from "./actions";
import { CreatePaymentGroupModal } from "./create-payment-group-modal";
import { TransactionPreviewModal } from "../transactions/transaction-preview-modal";
import { CandidateDetectionPanel } from "./candidate-detection-panel";

type Props = {
  ungroupedTransactions: UngroupedExpenseTransaction[];
  ungroupedAllocationItems: UngroupedAllocationItem[];
  draftPaymentGroups: PaymentGroupListItem[];
  counterpartyOptions: { value: string; label: string; isStellaCustomer: boolean }[];
  operatingCompanyOptions: { value: string; label: string }[];
  expenseCategories: { id: number; name: string; type: string }[];
  projectId?: number;
};

type CounterpartyGroup = {
  counterpartyId: number;
  counterpartyName: string;
  confirmedTransactions: UngroupedExpenseTransaction[];
  unconfirmedTransactions: UngroupedExpenseTransaction[];
  totalConfirmedAmount: number;
  totalUnconfirmedAmount: number;
  draftGroup: PaymentGroupListItem | null;
};

export function UngroupedExpensesPanel({
  ungroupedTransactions,
  ungroupedAllocationItems,
  draftPaymentGroups,
  counterpartyOptions,
  operatingCompanyOptions,
  expenseCategories,
  projectId,
}: Props) {
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preSelectedCounterpartyId, setPreSelectedCounterpartyId] = useState<
    string | null
  >(null);
  const [previewTxId, setPreviewTxId] = useState<number | null>(null);
  const [showCandidatePanel, setShowCandidatePanel] = useState(false);

  // 取引先ごとにグループ化（confirmed + unconfirmed を統合）
  const counterpartyGroups = useMemo(() => {
    const grouped = new Map<number, { confirmed: UngroupedExpenseTransaction[]; unconfirmed: UngroupedExpenseTransaction[] }>();

    for (const tx of ungroupedTransactions) {
      if (!grouped.has(tx.counterpartyId)) {
        grouped.set(tx.counterpartyId, { confirmed: [], unconfirmed: [] });
      }
      const group = grouped.get(tx.counterpartyId)!;
      if (tx.status === "confirmed") {
        group.confirmed.push(tx);
      } else {
        group.unconfirmed.push(tx);
      }
    }

    const result: CounterpartyGroup[] = [];
    for (const [counterpartyId, { confirmed, unconfirmed }] of grouped) {
      const allTx = [...confirmed, ...unconfirmed];
      if (allTx.length === 0) continue;

      const totalConfirmedAmount = confirmed.reduce((sum, tx) => sum + tx.amount, 0);
      const totalUnconfirmedAmount = unconfirmed.reduce((sum, tx) => sum + tx.amount, 0);
      const draftGroup =
        draftPaymentGroups.find(
          (g) =>
            g.counterpartyId === counterpartyId &&
            g.status === "before_request"
        ) ?? null;

      result.push({
        counterpartyId,
        counterpartyName: allTx[0].counterpartyName,
        confirmedTransactions: confirmed,
        unconfirmedTransactions: unconfirmed,
        totalConfirmedAmount,
        totalUnconfirmedAmount,
        draftGroup,
      });
    }

    // 件数の多い順にソート
    result.sort((a, b) =>
      (b.confirmedTransactions.length + b.unconfirmedTransactions.length) -
      (a.confirmedTransactions.length + a.unconfirmedTransactions.length)
    );
    return result;
  }, [ungroupedTransactions, draftPaymentGroups]);

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

  const handleCreatePayment = (counterpartyId: string) => {
    setPreSelectedCounterpartyId(counterpartyId);
    setShowCreateModal(true);
  };

  const totalConfirmed = ungroupedTransactions.filter((t) => t.status === "confirmed").length;
  const totalUnconfirmed = ungroupedTransactions.filter((t) => t.status === "unconfirmed").length;

  if (ungroupedTransactions.length === 0 && ungroupedAllocationItems.length === 0 && !showCandidatePanel) {
    return (
      <div className="space-y-4">
        {/* 候補検出ボタン */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCandidatePanel(true)}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            契約から候補を検出
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          未処理の経費取引はありません
        </div>

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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 候補検出セクション */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {totalConfirmed > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              確認済み {totalConfirmed}件
            </span>
          )}
          {totalUnconfirmed > 0 && (
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              未確定 {totalUnconfirmed}件
            </span>
          )}
        </div>
        <Button
          variant={showCandidatePanel ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowCandidatePanel(!showCandidatePanel)}
        >
          <Sparkles className="mr-1 h-4 w-4" />
          契約から候補を検出
        </Button>
      </div>

      {/* 候補検出パネル */}
      {showCandidatePanel && (
        <CandidateDetectionPanel
          expenseCategories={expenseCategories}
          onClose={() => setShowCandidatePanel(false)}
        />
      )}

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
      {ungroupedTransactions.length > 0 && ungroupedAllocationItems.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <h3 className="text-sm font-medium">
            通常の経費取引（{ungroupedTransactions.length}件）
          </h3>
        </div>
      )}

      {ungroupedTransactions.length > 0 && (
        <p className="text-sm text-muted-foreground">
          まだ支払に紐づいていない経費取引の一覧です。確認済みの取引を選んで支払を作成できます。
        </p>
      )}

      <div className="space-y-3">
        {counterpartyGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.counterpartyId);
          const totalCount = group.confirmedTransactions.length + group.unconfirmedTransactions.length;
          const totalAmount = group.totalConfirmedAmount + group.totalUnconfirmedAmount;

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
                      {totalCount}件
                    </span>
                    <span className="text-sm font-medium text-emerald-600">
                      ¥{totalAmount.toLocaleString()}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    {group.confirmedTransactions.length > 0 && (
                      <>
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
                      </>
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

                {/* 未確定件数の案内 */}
                {group.unconfirmedTransactions.length > 0 && group.confirmedTransactions.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span>
                      未確定の取引が{group.unconfirmedTransactions.length}件あります。確定してから支払を作成してください。
                    </span>
                  </div>
                )}
              </CardHeader>

              {/* 展開時の取引リスト */}
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="border rounded-lg divide-y">
                    {/* 確認済み取引 */}
                    {group.confirmedTransactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        onEdit={() => setPreviewTxId(tx.id)}
                      />
                    ))}
                    {/* 未確定取引 */}
                    {group.unconfirmedTransactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        onEdit={() => setPreviewTxId(tx.id)}
                      />
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

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
          onCreated={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// 取引行コンポーネント
function TransactionRow({
  tx,
  onEdit,
}: {
  tx: UngroupedExpenseTransaction;
  onEdit: () => void;
}) {
  const isUnconfirmed = tx.status === "unconfirmed";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${
        isUnconfirmed ? "bg-amber-50/50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {tx.expenseCategoryName}
          </span>
          <span className="text-xs text-muted-foreground">
            {tx.periodFrom} ~ {tx.periodTo}
          </span>
          {isUnconfirmed && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              未確定
            </span>
          )}
        </div>
        {tx.note && (
          <div className="text-xs text-muted-foreground truncate">
            {tx.note}
          </div>
        )}
      </div>
      <div className="text-right text-sm mr-2">
        <div className="font-medium">
          ¥{tx.amount.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">
          税¥{tx.taxAmount.toLocaleString()} ({tx.taxRate}%)
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={onEdit}
      >
        {isUnconfirmed ? (
          <>
            <Pencil className="mr-1 h-3 w-3" />
            編集・確定
          </>
        ) : (
          <>
            <Eye className="mr-1 h-3 w-3" />
            詳細
          </>
        )}
      </Button>
    </div>
  );
}
