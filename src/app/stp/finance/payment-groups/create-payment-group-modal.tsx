"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, ChevronRight, ChevronLeft, Plus } from "lucide-react";
import {
  createPaymentGroup,
  getUngroupedExpenseTransactions,
  type UngroupedExpenseTransaction,
} from "./actions";
import { InlineTransactionForm } from "./inline-transaction-form";

type Step = "counterparty" | "transactions" | "info";

type Props = {
  open: boolean;
  onClose: () => void;
  counterpartyOptions: { value: string; label: string; isStellaCustomer: boolean }[];
  operatingCompanyOptions: { value: string; label: string }[];
  expenseCategories: { id: number; name: string; type: string }[];
  defaultCounterpartyId?: string;
  projectId?: number;
  onCreated?: (groupId: number) => void;
};

export function CreatePaymentGroupModal({
  open,
  onClose,
  counterpartyOptions,
  operatingCompanyOptions,
  expenseCategories,
  defaultCounterpartyId,
  projectId,
  onCreated,
}: Props) {
  const [step, setStep] = useState<Step>(
    defaultCounterpartyId ? "transactions" : "counterparty"
  );
  const [loading, setLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);

  // Step 1: 取引先選択
  const [counterpartyId, setCounterpartyId] = useState<string>(
    defaultCounterpartyId ?? ""
  );
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [counterpartyTab, setCounterpartyTab] = useState<"stella" | "other">(
    () => {
      if (!defaultCounterpartyId) return "stella";
      const found = counterpartyOptions.find((o) => o.value === defaultCounterpartyId);
      return found?.isStellaCustomer === false ? "other" : "stella";
    }
  );

  // Step 2: 取引選択
  const [ungroupedTransactions, setUngroupedTransactions] = useState<
    UngroupedExpenseTransaction[]
  >([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<
    Set<number>
  >(new Set());

  // Step 3: 支払情報
  const [operatingCompanyId, setOperatingCompanyId] = useState<string>(
    operatingCompanyOptions[0]?.value ?? ""
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>("");
  const [showInlineForm, setShowInlineForm] = useState(false);

  // 取引先タブ分けとフィルタ
  const extractDisplayNum = (label: string): number => {
    const match = label.match(/^(?:SC|TP)-(\d+)/);
    return match ? Number(match[1]) : 0;
  };

  const stellaCounterparties = useMemo(() => {
    return counterpartyOptions
      .filter((o) => o.isStellaCustomer)
      .sort((a, b) => extractDisplayNum(b.label) - extractDisplayNum(a.label));
  }, [counterpartyOptions]);

  const otherCounterparties = useMemo(() => {
    return counterpartyOptions
      .filter((o) => !o.isStellaCustomer)
      .sort((a, b) => extractDisplayNum(b.label) - extractDisplayNum(a.label));
  }, [counterpartyOptions]);

  const filteredCounterparties = useMemo(() => {
    const source = counterpartyTab === "stella" ? stellaCounterparties : otherCounterparties;
    if (!counterpartySearch) return source;
    const q = counterpartySearch.toLowerCase();
    return source.filter((o) => o.label.toLowerCase().includes(q));
  }, [counterpartyTab, stellaCounterparties, otherCounterparties, counterpartySearch]);

  const handleCounterpartyTabChange = (tab: "stella" | "other") => {
    setCounterpartyTab(tab);
    setCounterpartySearch("");
  };

  // 取引先選択後に未グループ化の経費取引を取得
  useEffect(() => {
    if (step !== "transactions" || !counterpartyId) return;
    let cancelled = false;
    setLoadingTransactions(true);
    getUngroupedExpenseTransactions(Number(counterpartyId), projectId)
      .then((txs) => {
        if (!cancelled) {
          setUngroupedTransactions(txs);
          setLoadingTransactions(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingTransactions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, counterpartyId, projectId]);

  // 選択中の取引の合計
  const selectedSummary = useMemo(() => {
    const selected = ungroupedTransactions.filter((t) =>
      selectedTransactionIds.has(t.id)
    );
    let subtotal = 0;
    let tax = 0;
    for (const t of selected) {
      if (t.taxType === "tax_excluded") {
        subtotal += t.amount;
        tax += t.taxAmount;
      } else {
        subtotal += t.amount - t.taxAmount;
        tax += t.taxAmount;
      }
    }
    return { count: selected.length, subtotal, tax, total: subtotal + tax };
  }, [ungroupedTransactions, selectedTransactionIds]);

  const handleToggleTransaction = (id: number) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedTransactionIds.size === ungroupedTransactions.length) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(
        new Set(ungroupedTransactions.map((t) => t.id))
      );
    }
  };

  const handleCreate = async () => {
    if (!paymentDueDate) {
      alert("支払期限を入力してください");
      return;
    }
    if (!expectedPaymentDate) {
      alert("支払予定日を入力してください");
      return;
    }
    setLoading(true);
    try {
      const result = await createPaymentGroup({
        counterpartyId: Number(counterpartyId),
        operatingCompanyId: Number(operatingCompanyId),
        paymentDueDate,
        expectedPaymentDate,
        transactionIds: Array.from(selectedTransactionIds),
        projectId,
        isConfidential,
      });
      onClose();
      if (onCreated) {
        onCreated(result.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const canGoToTransactions = !!counterpartyId;
  const canGoToInfo = selectedTransactionIds.size > 0;
  const canSubmit =
    !!operatingCompanyId &&
    selectedTransactionIds.size > 0 &&
    !!paymentDueDate &&
    !!expectedPaymentDate;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            支払の新規作成
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {defaultCounterpartyId ? (
                <>
                  {step === "transactions" && "Step 1/2: 取引選択"}
                  {step === "info" && "Step 2/2: 支払情報設定"}
                </>
              ) : (
                <>
                  {step === "counterparty" && "Step 1/3: 取引先選択"}
                  {step === "transactions" && "Step 2/3: 取引選択"}
                  {step === "info" && "Step 3/3: 支払情報設定"}
                </>
              )}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Step 1: 取引先選択 */}
          {step === "counterparty" && (
            <div className="space-y-4 p-1">
              <div>
                <Label>取引先を選択</Label>
                <Input
                  placeholder="取引先名で検索..."
                  value={counterpartySearch}
                  onChange={(e) => setCounterpartySearch(e.target.value)}
                  className="mt-1"
                />
              </div>
              {/* タブ切り替え */}
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => handleCounterpartyTabChange("stella")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    counterpartyTab === "stella"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Stella全顧客マスタ ({stellaCounterparties.length})
                </button>
                <button
                  onClick={() => handleCounterpartyTabChange("other")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    counterpartyTab === "other"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  その他の取引先 ({otherCounterparties.length})
                </button>
              </div>
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                {filteredCounterparties.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    取引先が見つかりません
                  </div>
                ) : (
                  filteredCounterparties.map((cp) => (
                    <button
                      key={cp.value}
                      onClick={() => setCounterpartyId(cp.value)}
                      className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                        counterpartyId === cp.value
                          ? "bg-blue-50 border-l-4 border-l-blue-500"
                          : ""
                      }`}
                    >
                      {cp.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 3: 取引選択 */}
          {step === "transactions" && (
            <div className="space-y-4 p-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  取引先:{" "}
                  <span className="font-medium text-foreground">
                    {
                      counterpartyOptions.find(
                        (o) => o.value === counterpartyId
                      )?.label
                    }
                  </span>{" "}
                  の確認済み・未処理の経費取引
                </p>
                <div className="flex items-center gap-2">
                  {ungroupedTransactions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleAll}
                    >
                      {selectedTransactionIds.size ===
                      ungroupedTransactions.length
                        ? "全選択解除"
                        : "全選択"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInlineForm(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    取引を新規作成
                  </Button>
                </div>
              </div>

              {showInlineForm ? (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <InlineTransactionForm
                    onClose={() => setShowInlineForm(false)}
                    onCreated={() => {
                      setShowInlineForm(false);
                      setLoadingTransactions(true);
                      getUngroupedExpenseTransactions(Number(counterpartyId), projectId)
                        .then((txs) => {
                          setUngroupedTransactions(txs);
                          setLoadingTransactions(false);
                        })
                        .catch(() => setLoadingTransactions(false));
                    }}
                    counterpartyId={Number(counterpartyId)}
                    projectId={projectId}
                    expenseCategories={expenseCategories}
                  />
                </div>
              ) : loadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : ungroupedTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  対象の経費取引がありません
                </div>
              ) : (
                <div className="border rounded-lg max-h-[350px] overflow-y-auto">
                  {ungroupedTransactions.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                        selectedTransactionIds.has(t.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.has(t.id)}
                        onChange={() => handleToggleTransaction(t.id)}
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
                        {t.note && (
                          <div className="text-xs text-muted-foreground truncate">
                            {t.note}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          ¥{t.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          税¥{t.taxAmount.toLocaleString()} ({t.taxRate}%)
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* 選択サマリー */}
              {selectedTransactionIds.size > 0 && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{selectedSummary.count}件選択中</span>
                    <div className="text-right">
                      <div>
                        小計: ¥{selectedSummary.subtotal.toLocaleString()}
                      </div>
                      <div>税: ¥{selectedSummary.tax.toLocaleString()}</div>
                      <div className="font-bold">
                        合計: ¥{selectedSummary.total.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: 支払情報設定 */}
          {step === "info" && (
            <div className="space-y-4 p-1">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    取引先:{" "}
                    {
                      counterpartyOptions.find(
                        (o) => o.value === counterpartyId
                      )?.label
                    }
                  </span>
                  <span>{selectedSummary.count}件の取引</span>
                </div>
                <div className="text-right font-bold mt-1">
                  合計: ¥{selectedSummary.total.toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="operatingCompanyId">支払元法人 *</Label>
                  <select
                    id="operatingCompanyId"
                    value={operatingCompanyId}
                    onChange={(e) => setOperatingCompanyId(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {operatingCompanyOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="paymentDueDate">
                    支払期限 <span className="text-red-600">*</span>
                  </Label>
                  <DatePicker
                    id="paymentDueDate"
                    value={paymentDueDate}
                    onChange={setPaymentDueDate}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="expectedPaymentDate">
                    支払予定日 <span className="text-red-600">*</span>
                  </Label>
                  <DatePicker
                    id="expectedPaymentDate"
                    value={expectedPaymentDate}
                    onChange={setExpectedPaymentDate}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isConfidential"
                  checked={isConfidential}
                  onChange={(e) => setIsConfidential(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="isConfidential" className="text-sm font-normal cursor-pointer">
                  機密（作成者と経理担当のみ閲覧可能）
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step !== "counterparty" && !defaultCounterpartyId && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === "info") setStep("transactions");
                else if (step === "transactions") setStep("counterparty");
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              戻る
            </Button>
          )}
          {step !== "transactions" && defaultCounterpartyId && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === "info") setStep("transactions");
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              戻る
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          {step === "counterparty" && (
            <Button
              onClick={() => setStep("transactions")}
              disabled={!canGoToTransactions}
            >
              次へ
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "transactions" && (
            <Button
              onClick={() => setStep("info")}
              disabled={!canGoToInfo}
            >
              次へ
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "info" && (
            <Button onClick={handleCreate} disabled={loading || !canSubmit}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              作成
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
