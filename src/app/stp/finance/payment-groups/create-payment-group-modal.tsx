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
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import {
  createPaymentGroup,
  getUngroupedExpenseTransactions,
  type UngroupedExpenseTransaction,
} from "./actions";

type Step = "counterparty" | "transactions" | "info";

type Props = {
  open: boolean;
  onClose: () => void;
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
};

export function CreatePaymentGroupModal({
  open,
  onClose,
  counterpartyOptions,
  operatingCompanyOptions,
}: Props) {
  const [step, setStep] = useState<Step>("counterparty");
  const [loading, setLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Step 1: 取引先選択
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [counterpartySearch, setCounterpartySearch] = useState("");

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
  const [targetMonth, setTargetMonth] = useState<string>("");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>("");
  const [requestedPdfName, setRequestedPdfName] = useState<string>("");

  // 取引先フィルタ
  const filteredCounterparties = useMemo(() => {
    if (!counterpartySearch) return counterpartyOptions;
    const q = counterpartySearch.toLowerCase();
    return counterpartyOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [counterpartyOptions, counterpartySearch]);

  // 取引先選択後に未グループ化の経費取引を取得
  useEffect(() => {
    if (step !== "transactions" || !counterpartyId) return;
    let cancelled = false;
    setLoadingTransactions(true);
    getUngroupedExpenseTransactions(Number(counterpartyId))
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
  }, [step, counterpartyId]);

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
    setLoading(true);
    try {
      await createPaymentGroup({
        counterpartyId: Number(counterpartyId),
        operatingCompanyId: Number(operatingCompanyId),
        targetMonth: targetMonth,
        expectedPaymentDate: expectedPaymentDate || null,
        requestedPdfName: requestedPdfName || null,
        transactionIds: Array.from(selectedTransactionIds),
      });
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const canGoToStep2 = !!counterpartyId;
  const canGoToStep3 = selectedTransactionIds.size > 0;
  const canSubmit =
    !!operatingCompanyId && !!targetMonth && selectedTransactionIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            支払グループの新規作成
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {step === "counterparty" && "Step 1/3: 取引先選択"}
              {step === "transactions" && "Step 2/3: 取引選択"}
              {step === "info" && "Step 3/3: 支払情報設定"}
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

          {/* Step 2: 取引選択 */}
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
                  の確定済み・未グループ化の経費取引
                </p>
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
              </div>

              {loadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : ungroupedTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  グループ化できる経費取引がありません
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

          {/* Step 3: 支払情報設定 */}
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
                  <Label htmlFor="targetMonth">対象月 *</Label>
                  <Input
                    id="targetMonth"
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="expectedPaymentDate">支払予定日</Label>
                  <Input
                    id="expectedPaymentDate"
                    type="date"
                    value={expectedPaymentDate}
                    onChange={(e) => setExpectedPaymentDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="requestedPdfName">請求書PDF名</Label>
                  <Input
                    id="requestedPdfName"
                    type="text"
                    value={requestedPdfName}
                    onChange={(e) => setRequestedPdfName(e.target.value)}
                    placeholder="例: 代理店X_202603_Meta Trust宛.pdf"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step !== "counterparty" && (
            <Button
              variant="outline"
              onClick={() =>
                setStep(step === "info" ? "transactions" : "counterparty")
              }
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
              disabled={!canGoToStep2}
            >
              次へ
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === "transactions" && (
            <Button
              onClick={() => setStep("info")}
              disabled={!canGoToStep3}
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
