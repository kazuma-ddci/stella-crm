"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  PlusCircle,
} from "lucide-react";
import type {
  UngroupedExpenseTransaction,
  PaymentGroupListItem,
} from "./actions";
import { CreatePaymentGroupModal } from "./create-payment-group-modal";

type Props = {
  ungroupedTransactions: UngroupedExpenseTransaction[];
  draftPaymentGroups: PaymentGroupListItem[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
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
  draftPaymentGroups,
  counterpartyOptions,
  operatingCompanyOptions,
  projectId,
}: Props) {
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preSelectedCounterpartyId, setPreSelectedCounterpartyId] = useState<
    string | null
  >(null);

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

  if (ungroupedTransactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        未処理の経費取引はありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        確認済みで、まだ支払に紐づいていない経費取引の一覧です。取引先ごとにまとめて支払を作成できます。
      </p>

      <div className="space-y-3">
        {counterpartyGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.counterpartyId);

          return (
            <Card key={group.counterpartyId}>
              <CardContent className="p-4">
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
                    <span className="font-medium">
                      {group.counterpartyName}
                    </span>
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
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          この取引先には下書きの支払があります
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // 下書きに追加 - 詳細モーダルを開いて取引追加タブに遷移する代わりに
                            // 新しい支払作成モーダルを開く（既存の下書きがある旨を表示）
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

                {/* 展開時の取引リスト */}
                {isExpanded && (
                  <div className="mt-3 border rounded-lg divide-y">
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
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
          defaultCounterpartyId={preSelectedCounterpartyId ?? undefined}
          projectId={projectId}
        />
      )}
    </div>
  );
}
