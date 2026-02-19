"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2 } from "lucide-react";
import { allocatePayment, removeAllocation } from "./actions";
import { useTimedFormCache } from "@/hooks/use-timed-form-cache";

type AllocationInfo = {
  id: number;
  allocatedAmount: number;
  note: string | null;
  revenueRecordId: number | null;
  expenseRecordId: number | null;
  revenueCompanyName: string | null;
  expenseAgentName: string | null;
};

type RevenueOption = {
  id: number;
  companyName: string;
  revenueType: string;
  targetMonth: string | null;
  expectedAmount: number;
  status: string;
};

type ExpenseOption = {
  id: number;
  agentName: string;
  expenseType: string;
  targetMonth: string | null;
  expectedAmount: number;
  status: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  transaction: Record<string, unknown>;
  revenueOptions: RevenueOption[];
  expenseOptions: ExpenseOption[];
};

const revenueTypeLabels: Record<string, string> = {
  initial: "初期費用",
  monthly: "月額費用",
  performance: "成果報酬",
};

const expenseTypeLabels: Record<string, string> = {
  agent_initial: "代理店初期",
  agent_monthly: "代理店月額",
  commission_initial: "紹介初期",
  commission_monthly: "紹介月額",
  commission_performance: "紹介成果",
};

export function AllocationModal({
  open,
  onClose,
  transaction,
  revenueOptions,
  expenseOptions,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    Map<string, { id: number; type: "revenue" | "expense"; amount: number }>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  type CachedState = {
    search: string;
    selectedItems: Map<string, { id: number; type: "revenue" | "expense"; amount: number }>;
  };
  const { restore, save } = useTimedFormCache<CachedState>(
    `allocation-${transaction.id as number}`
  );
  const formStateRef = useRef<CachedState>({ search: "", selectedItems: new Map() });
  formStateRef.current = { search, selectedItems };

  // クローズ時にキャッシュ保存
  useEffect(() => {
    if (!open) return;
    return () => {
      save(formStateRef.current);
    };
  }, [open, save]);

  useEffect(() => {
    if (open) {
      const cached = restore();
      if (cached) {
        setSearch(cached.search);
        setSelectedItems(cached.selectedItems);
      } else {
        setSearch("");
        setSelectedItems(new Map());
      }
    }
  }, [open, restore]);

  const direction = transaction.direction as string;
  const amount = transaction.amount as number;
  const totalAllocated = transaction.totalAllocated as number;
  const remainingAmount = amount - totalAllocated;
  const existingAllocations = (transaction.allocations as AllocationInfo[]) || [];
  const isIncoming = direction === "incoming";

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    const searchLower = search.toLowerCase();

    if (isIncoming) {
      return revenueOptions.filter((r) =>
        search
          ? r.companyName.toLowerCase().includes(searchLower) ||
            r.revenueType.toLowerCase().includes(searchLower)
          : true
      );
    } else {
      return expenseOptions.filter((r) =>
        search
          ? r.agentName.toLowerCase().includes(searchLower) ||
            r.expenseType.toLowerCase().includes(searchLower)
          : true
      );
    }
  }, [isIncoming, revenueOptions, expenseOptions, search]);

  const toggleItem = (
    id: number,
    type: "revenue" | "expense",
    expectedAmount: number
  ) => {
    const key = `${type}-${id}`;
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        const defaultAmount = Math.min(expectedAmount, remainingAmount);
        next.set(key, { id, type, amount: Math.max(defaultAmount, 0) });
      }
      return next;
    });
  };

  const updateAmount = (key: string, newAmount: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const item = next.get(key);
      if (item) {
        next.set(key, { ...item, amount: newAmount });
      }
      return next;
    });
  };

  const handleAllocate = async () => {
    if (selectedItems.size === 0) return;

    setLoading(true);
    try {
      const allocations = Array.from(selectedItems.values()).map((item) => ({
        revenueRecordId: item.type === "revenue" ? item.id : undefined,
        expenseRecordId: item.type === "expense" ? item.id : undefined,
        allocatedAmount: item.amount,
      }));

      await allocatePayment(transaction.id as number, allocations);
      setSelectedItems(new Map());
      onClose();
    } catch {
      alert("消込の実行に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAllocation = async (allocationId: number) => {
    setRemovingId(allocationId);
    try {
      await removeAllocation(allocationId);
      onClose();
    } catch {
      alert("消込の解除に失敗しました");
    } finally {
      setRemovingId(null);
    }
  };

  const totalSelected = Array.from(selectedItems.values()).reduce(
    (sum, item) => sum + item.amount,
    0
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[min(800px,calc(100vw-2rem))] max-h-[85vh] flex flex-col"
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            消込 - {isIncoming ? "入金" : "出金"} #
            {transaction.id as number}
          </DialogTitle>
        </DialogHeader>

        {/* Transaction info */}
        <div className="flex gap-4 text-sm border-b pb-3 flex-shrink-0">
          <div>
            <span className="text-muted-foreground">金額: </span>
            <span className="font-bold">¥{amount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">取引先: </span>
            <span>
              {(transaction.counterpartyName as string) || "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">未配分残高: </span>
            <span className="font-bold text-orange-600">
              ¥{remainingAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Existing allocations */}
        {existingAllocations.length > 0 && (
          <div className="flex-shrink-0">
            <h4 className="text-sm font-medium mb-2">既存の配分</h4>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {existingAllocations.map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-1.5"
                >
                  <span>
                    {alloc.revenueCompanyName || alloc.expenseAgentName || "-"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>¥{alloc.allocatedAmount.toLocaleString()}</span>
                    <button
                      onClick={() => handleRemoveAllocation(alloc.id)}
                      disabled={removingId === alloc.id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {removingId === alloc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex-shrink-0">
          <Input
            placeholder={
              isIncoming
                ? "企業名で検索..."
                : "代理店名で検索..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Records list */}
        <div className="flex-1 min-h-0 overflow-y-auto border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="w-8 p-2"></th>
                <th className="text-left p-2">
                  {isIncoming ? "企業名" : "代理店名"}
                </th>
                <th className="text-left p-2">種別</th>
                <th className="text-left p-2">対象月</th>
                <th className="text-right p-2">金額</th>
                <th className="text-right p-2 w-[120px]">配分金額</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted-foreground">
                    対象レコードがありません
                  </td>
                </tr>
              ) : isIncoming ? (
                (filteredRecords as RevenueOption[]).map((record) => {
                  const key = `revenue-${record.id}`;
                  const isSelected = selectedItems.has(key);
                  return (
                    <tr
                      key={key}
                      className={`border-b hover:bg-muted/30 ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleItem(
                              record.id,
                              "revenue",
                              record.expectedAmount
                            )
                          }
                          className="rounded"
                        />
                      </td>
                      <td className="p-2">{record.companyName}</td>
                      <td className="p-2">
                        {revenueTypeLabels[record.revenueType] ||
                          record.revenueType}
                      </td>
                      <td className="p-2">{record.targetMonth || "-"}</td>
                      <td className="p-2 text-right">
                        ¥{record.expectedAmount.toLocaleString()}
                      </td>
                      <td className="p-2 text-right">
                        {isSelected && (
                          <Input
                            type="number"
                            value={selectedItems.get(key)!.amount}
                            onChange={(e) =>
                              updateAmount(key, Number(e.target.value))
                            }
                            className="h-7 w-[110px] text-right ml-auto"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                (filteredRecords as ExpenseOption[]).map((record) => {
                  const key = `expense-${record.id}`;
                  const isSelected = selectedItems.has(key);
                  return (
                    <tr
                      key={key}
                      className={`border-b hover:bg-muted/30 ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleItem(
                              record.id,
                              "expense",
                              record.expectedAmount
                            )
                          }
                          className="rounded"
                        />
                      </td>
                      <td className="p-2">{record.agentName}</td>
                      <td className="p-2">
                        {expenseTypeLabels[record.expenseType] ||
                          record.expenseType}
                      </td>
                      <td className="p-2">{record.targetMonth || "-"}</td>
                      <td className="p-2 text-right">
                        ¥{record.expectedAmount.toLocaleString()}
                      </td>
                      <td className="p-2 text-right">
                        {isSelected && (
                          <Input
                            type="number"
                            value={selectedItems.get(key)!.amount}
                            onChange={(e) =>
                              updateAmount(key, Number(e.target.value))
                            }
                            className="h-7 w-[110px] text-right ml-auto"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with totals and submit */}
        <DialogFooter className="flex-shrink-0 flex items-center justify-between">
          <div className="text-sm">
            {selectedItems.size > 0 && (
              <span>
                選択: {selectedItems.size}件 / 配分合計: ¥
                {totalSelected.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              閉じる
            </Button>
            <Button
              onClick={handleAllocate}
              disabled={loading || selectedItems.size === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                "消込実行"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
