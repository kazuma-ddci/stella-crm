"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  FileText,
} from "lucide-react";
import type { InvoiceGroupListItem, UngroupedTransaction } from "./actions";
import {
  createInvoiceGroup,
  addTransactionToGroup,
} from "./actions";

type Props = {
  ungroupedTransactions: UngroupedTransaction[];
  draftInvoiceGroups: InvoiceGroupListItem[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
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
  draftInvoiceGroups,
  counterpartyOptions,
  operatingCompanyOptions,
  bankAccountsByCompany,
  projectId,
}: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<number | null>(null);

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

  // 取引先に対応する下書き請求を検索
  const getDraftForCounterparty = (counterpartyId: number) => {
    return draftInvoiceGroups.find(
      (g) => g.counterpartyId === counterpartyId
    );
  };

  // 新しい請求を作成
  const handleCreateInvoice = async (group: CounterpartyGroup) => {
    setLoading(group.counterpartyId);
    try {
      // 最初の運営法人をデフォルトとして使用
      const defaultOperatingCompanyId = operatingCompanyOptions[0]?.value;
      if (!defaultOperatingCompanyId) {
        alert("運営法人が設定されていません");
        return;
      }

      await createInvoiceGroup({
        counterpartyId: group.counterpartyId,
        operatingCompanyId: Number(defaultOperatingCompanyId),
        transactionIds: group.transactions.map((t) => t.id),
        projectId,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
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

  if (ungroupedTransactions.length === 0) {
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
      <p className="text-sm text-muted-foreground">
        確認済みで未請求の売上取引を取引先ごとにまとめています。
        請求を作成すると、選択した取引が請求に紐づけられます。
      </p>

      {counterpartyGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.counterpartyId);
        const isLoading = loading === group.counterpartyId;
        const draftGroup = getDraftForCounterparty(group.counterpartyId);

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
                        onClick={() => handleCreateInvoice(group)}
                        disabled={isLoading}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        新しい請求を作成
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleCreateInvoice(group)}
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
    </div>
  );
}
