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
import { Loader2, ChevronRight, ChevronLeft, Plus, AlertTriangle, Pencil, Undo2 } from "lucide-react";
import {
  createInvoiceGroup,
  getUngroupedTransactions,
  calculatePaymentDueDate,
  type UngroupedTransaction,
} from "./actions";
import { InlineTransactionForm } from "./inline-transaction-form";

type Step = "counterparty" | "transactions" | "info";

type Props = {
  open: boolean;
  onClose: () => void;
  stellaCustomerOptions: { value: string; label: string; companyId: number }[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
  defaultBankAccountByCompany: Record<string, string>;
  expenseCategories: { id: number; name: string; type: string }[];
  defaultCounterpartyId?: string;
  initialTransactions?: UngroupedTransaction[];
  projectId?: number;
  onCreated?: (groupId: number) => void;
};

export function CreateInvoiceGroupModal({
  open,
  onClose,
  stellaCustomerOptions,
  counterpartyOptions,
  operatingCompanyOptions,
  bankAccountsByCompany,
  defaultBankAccountByCompany,
  expenseCategories,
  defaultCounterpartyId,
  initialTransactions,
  projectId,
  onCreated,
}: Props) {
  const [step, setStep] = useState<Step>(
    defaultCounterpartyId ? "transactions" : "counterparty"
  );
  const [loading, setLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Step 1: 取引先選択
  const [counterpartyId, setCounterpartyId] = useState<string>(
    defaultCounterpartyId ?? ""
  );
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [counterpartyTab, setCounterpartyTab] = useState<"stella" | "other">(
    () => {
      if (!defaultCounterpartyId) return "stella";
      const isStellaCustomer = stellaCustomerOptions.some((o) => o.value === defaultCounterpartyId);
      return isStellaCustomer ? "stella" : "other";
    }
  );

  // Step 2: 取引選択
  const [ungroupedTransactions, setUngroupedTransactions] = useState<
    UngroupedTransaction[]
  >(initialTransactions ?? []);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<
    Set<number>
  >(new Set());
  // initialTransactionsで既にデータがある場合、再fetchをスキップするためのトラッカー
  const [loadedCounterpartyId, setLoadedCounterpartyId] = useState<string | null>(
    initialTransactions && defaultCounterpartyId ? defaultCounterpartyId : null
  );

  // Step 3: 請求情報
  // 請求書の宛先（デフォルトはStep1で選んだ取引先）
  const [billingCounterpartyId, setBillingCounterpartyId] = useState<string>("");
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [billingTab, setBillingTab] = useState<"stella" | "other">("stella");
  const [billingSearch, setBillingSearch] = useState("");
  const isBillingRedirected = billingCounterpartyId !== "" && billingCounterpartyId !== counterpartyId;
  const effectiveCounterpartyId = billingCounterpartyId || counterpartyId;

  const [operatingCompanyId, setOperatingCompanyId] = useState<string>(
    operatingCompanyOptions[0]?.value ?? ""
  );
  const [bankAccountId, setBankAccountId] = useState<string>(
    defaultBankAccountByCompany[operatingCompanyOptions[0]?.value ?? ""] ?? ""
  );
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");
  const [loadingDueDate, setLoadingDueDate] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);

  // 取引先タブ分けとフィルタ（Stella顧客はpage.tsxで降順ソート済み）
  const filteredCounterparties = useMemo(() => {
    const source = counterpartyTab === "stella" ? stellaCustomerOptions : counterpartyOptions;
    if (!counterpartySearch) return source;
    const q = counterpartySearch.toLowerCase();
    return source.filter((o) => o.label.toLowerCase().includes(q));
  }, [counterpartyTab, stellaCustomerOptions, counterpartyOptions, counterpartySearch]);

  // 宛先変更用タブ分けオプション
  const filteredBillingOptions = useMemo(() => {
    const source = billingTab === "stella" ? stellaCustomerOptions : counterpartyOptions;
    if (!billingSearch) return source;
    const q = billingSearch.toLowerCase();
    return source.filter((o) => o.label.toLowerCase().includes(q));
  }, [billingTab, stellaCustomerOptions, counterpartyOptions, billingSearch]);

  // 全選択肢を結合（ラベル検索用）
  const allOptions = useMemo(() => [...stellaCustomerOptions, ...counterpartyOptions], [stellaCustomerOptions, counterpartyOptions]);

  const handleCounterpartyTabChange = (tab: "stella" | "other") => {
    setCounterpartyTab(tab);
    setCounterpartySearch("");
  };

  // 取引先選択後に未グループ化取引を取得（既にロード済みの場合はスキップ）
  const isNewCounterparty = counterpartyId.startsWith("new-");
  useEffect(() => {
    if (step !== "transactions" || !counterpartyId) return;
    if (loadedCounterpartyId === counterpartyId) return;
    if (isNewCounterparty) {
      setUngroupedTransactions([]);
      setLoadedCounterpartyId(counterpartyId);
      return;
    }
    let cancelled = false;
    setLoadingTransactions(true);
    getUngroupedTransactions(Number(counterpartyId), projectId)
      .then((txs) => {
        if (!cancelled) {
          setUngroupedTransactions(txs);
          setLoadedCounterpartyId(counterpartyId);
          setLoadingTransactions(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingTransactions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, counterpartyId, projectId, loadedCounterpartyId]);

  // Step 3 に遷移時、入金期限を自動計算
  useEffect(() => {
    if (step !== "info" || !counterpartyId || !operatingCompanyId) return;
    if (paymentDueDate) return; // 既に設定済みならスキップ
    let cancelled = false;
    setLoadingDueDate(true);
    const effId = effectiveCounterpartyId.startsWith("new-") ? undefined : Number(effectiveCounterpartyId);
    if (!effId) { setLoadingDueDate(false); return; }
    calculatePaymentDueDate(effId, Number(operatingCompanyId))
      .then((date) => {
        if (!cancelled && date) {
          setPaymentDueDate(date);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDueDate(false);
      });
    return () => { cancelled = true; };
  }, [step, effectiveCounterpartyId, operatingCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 銀行口座オプション
  const currentBankAccounts = useMemo(
    () => bankAccountsByCompany[operatingCompanyId] ?? [],
    [bankAccountsByCompany, operatingCompanyId]
  );

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
    if (selectedTransactionIds.size === 0) return;
    setLoading(true);
    try {
      const result = await createInvoiceGroup({
        counterpartyId: effectiveCounterpartyId.startsWith("new-") ? effectiveCounterpartyId : Number(effectiveCounterpartyId),
        operatingCompanyId: Number(operatingCompanyId),
        bankAccountId: bankAccountId ? Number(bankAccountId) : null,
        paymentDueDate: paymentDueDate || null,
        transactionIds: Array.from(selectedTransactionIds),
        projectId,
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

  const canGoToStep2 = !!counterpartyId;
  const canGoToStep3 = selectedTransactionIds.size > 0;
  const canSubmit =
    !!operatingCompanyId && selectedTransactionIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            請求の新規作成
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {step === "counterparty" && "Step 1/3: 取引先選択"}
              {step === "transactions" && "Step 2/3: 取引選択"}
              {step === "info" && "Step 3/3: 請求情報設定"}
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
                  Stella全顧客マスタ ({stellaCustomerOptions.length})
                </button>
                <button
                  onClick={() => handleCounterpartyTabChange("other")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    counterpartyTab === "other"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  その他の取引先 ({counterpartyOptions.length})
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

          {/* Step 2: 取引選択 */}
          {step === "transactions" && (
            <div className="space-y-4 p-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  取引先:{" "}
                  <span className="font-medium text-foreground">
                    {
                      allOptions.find(
                        (o) => o.value === counterpartyId
                      )?.label
                    }
                  </span>{" "}
                  の確認済み・未請求の取引
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
                      if (!isNewCounterparty) {
                        getUngroupedTransactions(Number(counterpartyId), projectId)
                          .then((txs) => {
                            setUngroupedTransactions(txs);
                            setLoadingTransactions(false);
                          })
                          .catch(() => setLoadingTransactions(false));
                      } else {
                        setLoadingTransactions(false);
                      }
                    }}
                    counterpartyId={isNewCounterparty ? 0 : Number(counterpartyId)}
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
                  対象の取引がありません
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

          {/* Step 3: 請求情報設定 */}
          {step === "info" && (
            <div className="space-y-4 p-1">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    取引先:{" "}
                    {
                      allOptions.find(
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

              {/* 請求書の宛先変更 */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="billingCounterpartyId">請求書の宛先</Label>
                  {!isEditingBilling ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => setIsEditingBilling(true)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      宛先変更
                    </Button>
                  ) : isBillingRedirected ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setBillingCounterpartyId("");
                        setPaymentDueDate("");
                        setIsEditingBilling(false);
                      }}
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      元に戻す
                    </Button>
                  ) : null}
                </div>
                {isEditingBilling ? (
                  <div className={`mt-1 rounded-md border ${isBillingRedirected ? "border-amber-400 bg-amber-50" : "border-input"}`}>
                    <div className="flex border-b">
                      <button
                        type="button"
                        className={`flex-1 px-3 py-1.5 text-xs font-medium ${billingTab === "stella" ? "bg-white border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                        onClick={() => { setBillingTab("stella"); setBillingSearch(""); }}
                      >
                        Stella顧客 ({stellaCustomerOptions.length})
                      </button>
                      <button
                        type="button"
                        className={`flex-1 px-3 py-1.5 text-xs font-medium ${billingTab === "other" ? "bg-white border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                        onClick={() => { setBillingTab("other"); setBillingSearch(""); }}
                      >
                        その他 ({counterpartyOptions.length})
                      </button>
                    </div>
                    <div className="p-2">
                      <Input
                        placeholder="検索..."
                        value={billingSearch}
                        onChange={(e) => setBillingSearch(e.target.value)}
                        className="h-8 text-sm mb-2"
                      />
                      <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {filteredBillingOptions.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-blue-50 ${
                              effectiveCounterpartyId === o.value ? "bg-blue-100 font-medium" : ""
                            }`}
                            onClick={() => {
                              setBillingCounterpartyId(o.value);
                              setPaymentDueDate("");
                            }}
                          >
                            {o.label}
                          </button>
                        ))}
                        {filteredBillingOptions.length === 0 && (
                          <p className="text-xs text-muted-foreground py-2 text-center">該当なし</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Input
                    value={allOptions.find((o) => o.value === effectiveCounterpartyId)?.label ?? ""}
                    disabled
                    className="mt-1 disabled:opacity-100 disabled:bg-gray-100 disabled:text-gray-900"
                  />
                )}
              </div>

              {isBillingRedirected && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">宛先が取引先と異なります</p>
                    <p className="text-amber-700 mt-0.5">
                      取引先「{allOptions.find((o) => o.value === counterpartyId)?.label}」の取引を、
                      「{allOptions.find((o) => o.value === billingCounterpartyId)?.label}」宛の請求書として発行します。
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="operatingCompanyId">請求元法人 *</Label>
                  <select
                    id="operatingCompanyId"
                    value={operatingCompanyId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOperatingCompanyId(v);
                      setBankAccountId(defaultBankAccountByCompany[v] ?? "");
                      // 運営法人変更時に入金期限を再計算
                      setPaymentDueDate("");
                    }}
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
                  <Label htmlFor="bankAccountId">振込先口座</Label>
                  <select
                    id="bankAccountId"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">選択してください</option>
                    {currentBankAccounts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="paymentDueDate">入金期限</Label>
                  <DatePicker
                    id="paymentDueDate"
                    value={paymentDueDate}
                    onChange={setPaymentDueDate}
                    className="mt-1"
                    disabled={loadingDueDate}
                  />
                  {loadingDueDate && (
                    <p className="text-xs text-muted-foreground mt-1">計算中...</p>
                  )}
                </div>
              </div>

              {/* 口座未選択の警告 */}
              {!bankAccountId && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">振込先口座が未選択です</p>
                    <p className="text-amber-700 mt-0.5">
                      {currentBankAccounts.length === 0
                        ? "この法人には振込先口座が登録されていません。設定画面で口座を追加してください。"
                        : "請求書PDF作成時に口座の設定が必要です。後から詳細画面で設定できます。"}
                    </p>
                  </div>
                </div>
              )}
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
