"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  CircleDot,
  CheckCircle2,
  FileText,
  Send,
  Banknote,
  Inbox,
  Undo2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getBillingLifecycleData,
  createTransactionFromBilling,
  bulkCreateTransactionsFromBilling,
  getExpenseLifecycleData,
  createTransactionFromExpense,
  bulkCreateTransactionsFromExpenses,
  getInvoiceGroupCandidatesFromTracker,
  getPaymentGroupCandidatesFromTracker,
  createInvoiceGroupFromTrackerTransactions,
  createPaymentGroupFromTrackerTransactions,
  createManualTrackerTransaction,
  createTrackerExpenseCategory,
} from "./actions";
import { deleteTransaction } from "@/app/finance/transactions/actions";
import { TransactionPreviewModal } from "../transactions/transaction-preview-modal";
import type {
  BillingLifecycleData,
  BillingLifecycleItem,
  LifecycleStatus,
  BillingItemInput,
  ExpenseLifecycleData,
  ExpenseLifecycleItem,
  ExpenseLifecycleStatus,
  TrackerGroupCandidateResult,
  ManualTrackerTransactionInput,
  TrackerExpenseCategoryInput,
} from "./actions";
import { calcTax } from "@/lib/finance/tax-calc";

type ExpenseCategoryOption = { id: number; name: string; type: string };
type AutoBillingLifecycleItem = BillingLifecycleItem & {
  feeType: "initial" | "monthly" | "performance";
};

// ============================================
// 売上ステータス設定
// ============================================

type StatusConfig = {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeClassName: string;
  icon: React.ElementType;
  summaryKey: string;
};

const REVENUE_STATUS_CONFIGS: Record<LifecycleStatus, StatusConfig> = {
  not_created: {
    label: "未取引化",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    badgeClassName: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle,
    summaryKey: "notCreated",
  },
  unconfirmed: {
    label: "取引化済み・未確定",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    badgeClassName: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: CircleDot,
    summaryKey: "unconfirmed",
  },
  confirmed: {
    label: "確定済み・未請求",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    badgeClassName: "bg-orange-100 text-orange-800 border-orange-200",
    icon: CheckCircle2,
    summaryKey: "confirmed",
  },
  in_invoice_draft: {
    label: "請求グループ作成済み",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badgeClassName: "bg-blue-100 text-blue-800 border-blue-200",
    icon: FileText,
    summaryKey: "inInvoiceDraft",
  },
  pdf_created: {
    label: "PDF作成済み・未送付",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    badgeClassName: "bg-purple-100 text-purple-800 border-purple-200",
    icon: FileText,
    summaryKey: "pdfCreated",
  },
  sent: {
    label: "送付済み・未入金",
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    badgeClassName: "bg-sky-100 text-sky-800 border-sky-200",
    icon: Send,
    summaryKey: "sent",
  },
  received: {
    label: "入金確認済み",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    badgeClassName: "bg-green-100 text-green-800 border-green-200",
    icon: Banknote,
    summaryKey: "received",
  },
  overdue: {
    label: "支払期限超過",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    badgeClassName: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle,
    summaryKey: "overdue",
  },
};

const REVENUE_STATUS_ORDER: LifecycleStatus[] = [
  "not_created",
  "unconfirmed",
  "confirmed",
  "in_invoice_draft",
  "pdf_created",
  "sent",
  "overdue",
  "received",
];

// ============================================
// 経費ステータス設定
// ============================================

const EXPENSE_STATUS_CONFIGS: Record<ExpenseLifecycleStatus, StatusConfig> = {
  not_created: {
    label: "未取引化",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    badgeClassName: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle,
    summaryKey: "notCreated",
  },
  unconfirmed: {
    label: "取引化済み・未確定",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    badgeClassName: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: CircleDot,
    summaryKey: "unconfirmed",
  },
  confirmed: {
    label: "確定済み・未支払グループ",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    badgeClassName: "bg-orange-100 text-orange-800 border-orange-200",
    icon: CheckCircle2,
    summaryKey: "confirmed",
  },
  in_payment_group: {
    label: "支払グループ作成済み",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badgeClassName: "bg-blue-100 text-blue-800 border-blue-200",
    icon: FileText,
    summaryKey: "inPaymentGroup",
  },
  invoice_received: {
    label: "請求書受領済み",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    badgeClassName: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Inbox,
    summaryKey: "invoiceReceived",
  },
  paid: {
    label: "支払済み",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    badgeClassName: "bg-green-100 text-green-800 border-green-200",
    icon: Banknote,
    summaryKey: "paid",
  },
  overdue: {
    label: "支払期限超過",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    badgeClassName: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle,
    summaryKey: "overdue",
  },
};

const EXPENSE_STATUS_ORDER: ExpenseLifecycleStatus[] = [
  "not_created",
  "unconfirmed",
  "confirmed",
  "in_payment_group",
  "invoice_received",
  "overdue",
  "paid",
];

// ============================================
// 共通ラベル
// ============================================

const FEE_TYPE_LABELS: Record<string, string> = {
  initial: "初期費用",
  monthly: "月額",
  performance: "成果報酬",
  manual: "手動追加",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  agent_initial: "代理店初期費用",
  agent_monthly: "代理店月額",
  commission_initial: "初期費用紹介報酬",
  commission_monthly: "月額紹介報酬",
  commission_performance: "成果報酬紹介報酬",
  manual: "手動追加",
};

// ============================================
// ユーティリティ
// ============================================

function formatAmount(amount: number): string {
  return `${amount.toLocaleString()}円`;
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}`;
}

function calculateGroupSummary(
  candidates: TrackerGroupCandidateResult["candidates"],
  selectedIds: Set<number>
) {
  let subtotal = 0;
  let tax = 0;
  for (const candidate of candidates) {
    if (!selectedIds.has(candidate.id)) continue;
    if (candidate.taxType === "tax_excluded") {
      subtotal += candidate.amount;
      tax += candidate.taxAmount;
    } else {
      subtotal += candidate.amount - candidate.taxAmount;
      tax += candidate.taxAmount;
    }
  }
  return { subtotal, tax, total: subtotal + tax, count: selectedIds.size };
}

function endOfMonthString(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNumber = Number(monthStr);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function ManualTrackerTransactionModal({
  open,
  selectedMonth,
  counterpartyOptions,
  expenseCategories,
  onClose,
  onCreated,
  onExpenseCategoryCreated,
}: {
  open: boolean;
  selectedMonth: string;
  counterpartyOptions: { id: number; label: string; counterpartyType: string }[];
  expenseCategories: ExpenseCategoryOption[];
  onClose: () => void;
  onCreated: (result: {
    type: "revenue" | "expense";
    status: "unconfirmed" | "confirmed";
    transactionId: number;
  }) => void;
  onExpenseCategoryCreated: (category: ExpenseCategoryOption) => void;
}) {
  const [type, setType] = useState<"revenue" | "expense">("revenue");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [taxType, setTaxType] = useState<"tax_included" | "tax_excluded">("tax_included");
  const [taxRate, setTaxRate] = useState("10");
  const [taxAmount, setTaxAmount] = useState("0");
  const [periodFrom, setPeriodFrom] = useState(`${selectedMonth}-01`);
  const [periodTo, setPeriodTo] = useState(endOfMonthString(selectedMonth));
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [note, setNote] = useState("");
  const [submittingMode, setSubmittingMode] = useState<"draft" | "confirm" | null>(null);
  const [showCategoryQuickAdd, setShowCategoryQuickAdd] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<TrackerExpenseCategoryInput["type"]>("revenue");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const filteredCategories = useMemo(
    () => expenseCategories.filter((category) => category.type === type || category.type === "both"),
    [expenseCategories, type]
  );

  useEffect(() => {
    setPeriodFrom(`${selectedMonth}-01`);
    setPeriodTo(endOfMonthString(selectedMonth));
  }, [selectedMonth]);

  useEffect(() => {
    setNewCategoryType(type);
  }, [type]);

  useEffect(() => {
    if (filteredCategories.length === 0) {
      setExpenseCategoryId("");
      return;
    }
    if (!filteredCategories.some((category) => String(category.id) === expenseCategoryId)) {
      setExpenseCategoryId(String(filteredCategories[0].id));
    }
  }, [expenseCategoryId, filteredCategories]);

  const updateTaxAmount = (nextAmount: string, nextRate = taxRate, nextType = taxType) => {
    setTaxAmount(calcTax(nextAmount, nextRate, nextType));
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    updateTaxAmount(value);
  };

  const handleTaxRateChange = (value: string) => {
    setTaxRate(value);
    updateTaxAmount(amount, value);
  };

  const handleTaxTypeChange = (value: "tax_included" | "tax_excluded") => {
    setTaxType(value);
    updateTaxAmount(amount, taxRate, value);
  };

  const handleCreateExpenseCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("費目名を入力してください");
      return;
    }

    setIsCreatingCategory(true);
    try {
      const result = await createTrackerExpenseCategory({
        name,
        type: newCategoryType,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onExpenseCategoryCreated(result.data);
      setExpenseCategoryId(String(result.data.id));
      setNewCategoryName("");
      setShowCategoryQuickAdd(false);
      toast.success(`費目「${result.data.name}」を追加しました`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "費目の追加に失敗しました");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSubmit = async (confirm: boolean) => {
    if (!counterpartyId) {
      toast.error("取引先を選択してください");
      return;
    }
    if (!expenseCategoryId) {
      toast.error("費目を選択してください");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("金額を入力してください");
      return;
    }
    if (!periodFrom || !periodTo) {
      toast.error("対象期間を入力してください");
      return;
    }

    setSubmittingMode(confirm ? "confirm" : "draft");
    try {
      const input: ManualTrackerTransactionInput = {
        type,
        counterpartyId: Number(counterpartyId),
        expenseCategoryId: Number(expenseCategoryId),
        amount: Number(amount),
        taxAmount: Number(taxAmount),
        taxRate: Number(taxRate),
        taxType,
        periodFrom,
        periodTo,
        paymentDueDate: paymentDueDate || null,
        note: note || null,
        confirm,
      };
      const result = await createManualTrackerTransaction(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(confirm ? "手動取引を追加して確定しました" : "手動取引を下書き保存しました");
      onCreated({
        type,
        status: result.data.status,
        transactionId: result.data.transactionId,
      });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "手動取引の追加に失敗しました");
    } finally {
      setSubmittingMode(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>手動で取引を追加</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 p-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manual-transaction-type">種別</Label>
              <select
                id="manual-transaction-type"
                value={type}
                onChange={(event) => setType(event.target.value as "revenue" | "expense")}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="revenue">売上</option>
                <option value="expense">支払</option>
              </select>
            </div>
            <div>
              <Label htmlFor="manual-counterparty">取引先</Label>
              <select
                id="manual-counterparty"
                value={counterpartyId}
                onChange={(event) => setCounterpartyId(event.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">選択してください</option>
                {counterpartyOptions.map((counterparty) => (
                  <option key={counterparty.id} value={String(counterparty.id)}>
                    {counterparty.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="manual-category">費目</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setShowCategoryQuickAdd((current) => !current);
                  setNewCategoryType(type);
                }}
              >
                + 新規追加
              </Button>
            </div>
            <select
              id="manual-category"
              value={expenseCategoryId}
              onChange={(event) => setExpenseCategoryId(event.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">選択してください</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
            {showCategoryQuickAdd && (
              <div className="rounded-md border bg-gray-50 p-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                  <div>
                    <Label htmlFor="manual-new-category-name">新しい費目名</Label>
                    <Input
                      id="manual-new-category-name"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      className="mt-1 bg-white"
                      placeholder={type === "revenue" ? "例: 月額売上" : "例: 外注費"}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-new-category-type">種別</Label>
                    <select
                      id="manual-new-category-type"
                      value={newCategoryType}
                      onChange={(event) =>
                        setNewCategoryType(event.target.value as TrackerExpenseCategoryInput["type"])
                      }
                      className="mt-1 w-full h-10 rounded-md border border-input bg-white px-3 text-sm"
                    >
                      <option value="revenue">売上用</option>
                      <option value="expense">経費用</option>
                      <option value="both">両方</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCategoryQuickAdd(false);
                      setNewCategoryName("");
                      setNewCategoryType(type);
                    }}
                    disabled={isCreatingCategory}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateExpenseCategory}
                    disabled={isCreatingCategory}
                  >
                    {isCreatingCategory && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    追加して選択
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manual-amount">金額</Label>
              <Input
                id="manual-amount"
                type="number"
                value={amount}
                onChange={(event) => handleAmountChange(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="manual-tax-type">税区分</Label>
              <select
                id="manual-tax-type"
                value={taxType}
                onChange={(event) => handleTaxTypeChange(event.target.value as "tax_included" | "tax_excluded")}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="tax_included">内税</option>
                <option value="tax_excluded">外税</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manual-tax-rate">税率 (%)</Label>
              <Input
                id="manual-tax-rate"
                type="number"
                value={taxRate}
                onChange={(event) => handleTaxRateChange(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="manual-tax-amount">税額</Label>
              <Input
                id="manual-tax-amount"
                type="number"
                value={taxAmount}
                onChange={(event) => setTaxAmount(event.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manual-period-from">対象期間From</Label>
              <DatePicker
                id="manual-period-from"
                value={periodFrom}
                onChange={setPeriodFrom}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="manual-period-to">対象期間To</Label>
              <DatePicker
                id="manual-period-to"
                value={periodTo}
                onChange={setPeriodTo}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="manual-payment-due-date">
              {type === "revenue" ? "入金期限" : "支払期限"}
            </Label>
            <DatePicker
              id="manual-payment-due-date"
              value={paymentDueDate}
              onChange={setPaymentDueDate}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="manual-note">摘要</Label>
            <Input
              id="manual-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1"
              placeholder="請求書・支払明細に表示する内容"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={submittingMode !== null}>
            キャンセル
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submittingMode !== null}
          >
            {submittingMode === "draft" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            下書き保存
          </Button>
          <Button onClick={() => handleSubmit(true)} disabled={submittingMode !== null}>
            {submittingMode === "confirm" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存して確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrackerGroupCandidateModal({
  open,
  kind,
  data,
  selectedIds,
  loading,
  onToggle,
  onClose,
  onSubmit,
}: {
  open: boolean;
  kind: "invoice" | "payment";
  data: TrackerGroupCandidateResult | null;
  selectedIds: Set<number>;
  loading: boolean;
  onToggle: (id: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const summary = useMemo(
    () => calculateGroupSummary(data?.candidates ?? [], selectedIds),
    [data, selectedIds]
  );
  const label = kind === "invoice" ? "請求" : "支払";
  const dueLabel = kind === "invoice" ? "入金期限" : "支払期限";
  const expectedLabel = kind === "invoice" ? "入金予定日" : "支払予定日";
  const recommendedCandidates = data?.candidates.filter((candidate) => candidate.recommended) ?? [];
  const additionalCandidates = data?.candidates.filter((candidate) => !candidate.recommended) ?? [];

  const renderCandidate = (candidate: TrackerGroupCandidateResult["candidates"][number]) => {
    const checked = selectedIds.has(candidate.id);
    return (
      <label
        key={candidate.id}
        className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
          checked ? "bg-blue-50" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={candidate.isAnchor}
          onChange={() => onToggle(candidate.id)}
          className="rounded"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {candidate.expenseCategoryName}
            </span>
            {candidate.isAnchor && (
              <Badge variant="secondary" className="text-xs">
                起点
              </Badge>
            )}
            {candidate.recommended && !candidate.isAnchor && (
              <Badge variant="outline" className="text-xs">
                自動選択
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDateDisplay(candidate.periodFrom)} - {formatDateDisplay(candidate.periodTo)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {dueLabel}: {formatDateDisplay(candidate.paymentDueDate)}
          </div>
          {candidate.note && (
            <div className="text-xs text-muted-foreground truncate">
              {candidate.note}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium">
            {formatAmount(candidate.amount)}
          </div>
          <div className="text-xs text-muted-foreground">
            税{formatAmount(candidate.taxAmount)} ({candidate.taxRate}%)
          </div>
        </div>
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{label}にまとめる</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 p-1">
          {!data ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-muted-foreground">{label}先</div>
                    <div className="font-medium">{data.counterpartyName}</div>
                  </div>
                  <div className="text-right">
                    <div>{dueLabel}: {formatDateDisplay(data.paymentDueDate)}</div>
                    <div>{expectedLabel}: {formatDateDisplay(data.expectedPaymentDate)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div>
                    <div className="text-sm font-medium">
                      起点と同じ条件の候補
                    </div>
                    <div className="text-xs text-muted-foreground">
                      起点の取引と同じ{label}先・同じ発生月・同じ{dueLabel}のものを自動選択しています。
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    {recommendedCandidates.map(renderCandidate)}
                  </div>
                </div>

                {additionalCandidates.length > 0 && (
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium">
                        別月/条件違いの追加候補
                      </div>
                      <div className="text-xs text-muted-foreground">
                        同じ{label}先ですが、表示中の発生月や{dueLabel}が起点と違うため未選択にしています。必要な場合だけ追加してください。
                      </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      {additionalCandidates.map(renderCandidate)}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-blue-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{summary.count}件選択中</span>
                  <div className="text-right">
                    <div>小計: {formatAmount(summary.subtotal)}</div>
                    <div>税: {formatAmount(summary.tax)}</div>
                    <div className="font-bold">合計: {formatAmount(summary.total)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            キャンセル
          </Button>
          <Button onClick={onSubmit} disabled={!data || selectedIds.size === 0 || loading}>
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            この内容で{label}作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// 売上アイテム行（展開式）
// ============================================

function RevenueItemRow({
  item,
  status,
  onCreateTransaction,
  onCancelTransaction,
  onOpenTransaction,
  onCreateInvoiceGroup,
  isCancelling,
  isCreating,
  isCreatingGroup,
}: {
  item: BillingLifecycleItem;
  status: LifecycleStatus;
  onCreateTransaction?: (item: BillingLifecycleItem) => void;
  onCancelTransaction?: (transactionId: number) => void;
  onOpenTransaction?: (transactionId: number, type: "revenue" | "expense") => void;
  onCreateInvoiceGroup?: (transactionId: number) => void;
  isCancelling?: boolean;
  isCreating?: boolean;
  isCreatingGroup?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [now] = useState(() => Date.now());

  const handleNavigate = () => {
    if (status === "not_created") return;
    if (item.transactionId) {
      if (status === "unconfirmed") {
        router.push(`/stp/finance/transactions/${item.transactionId}/edit`);
      } else if (item.invoiceGroupId) {
        router.push(`/stp/finance/invoices?groupId=${item.invoiceGroupId}`);
      } else {
        router.push(`/stp/finance/transactions`);
      }
    }
  };

  const isNavigable = status !== "not_created" && item.transactionId;
  const overdueDays =
    status === "overdue" && item.paymentDueDate
      ? Math.floor((now - new Date(item.paymentDueDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

  return (
    <div className={`rounded-lg border ${expanded ? "border-gray-300" : ""}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{item.companyName}</span>
            {item.billingCounterpartyName && (
              <span className="text-xs text-red-600 font-medium shrink-0">({item.billingCounterpartyName})</span>
            )}
            <Badge variant="outline" className="text-xs shrink-0">
              {FEE_TYPE_LABELS[item.feeType] || item.feeType}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="font-semibold text-gray-900">{formatAmount(item.amount)}</span>
            <span>{formatDateDisplay(item.periodFrom)} - {formatDateDisplay(item.periodTo)}</span>
            {item.candidateName && <span>{item.candidateName}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(status === "not_created" || status === "unconfirmed" || status === "confirmed") &&
            item.expectedInvoiceDate && (
              <div className="text-xs text-gray-500 text-right">
                <div>請求予定: {formatDateDisplay(item.expectedInvoiceDate)}</div>
              </div>
            )}
          {(status === "not_created" || status === "unconfirmed" || status === "confirmed" ||
            status === "sent" || status === "overdue") &&
            (item.expectedPaymentDeadline || item.paymentDueDate) && (
              <div className="text-xs text-gray-500 text-right">
                <div>支払期限: {formatDateDisplay(item.paymentDueDate || item.expectedPaymentDeadline)}</div>
              </div>
            )}
          {overdueDays != null && overdueDays > 0 && (
            <Badge className="bg-red-600 text-white text-xs">{overdueDays}日超過</Badge>
          )}
          {status === "not_created" && onCreateTransaction && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onCreateTransaction(item); }} disabled={isCreating}>
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認して確定"}
            </Button>
          )}
          {status === "unconfirmed" && item.transactionId && onCancelTransaction && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTransaction?.(item.transactionId!, "revenue");
              }}
            >
              編集・確定
            </Button>
          )}
          {status === "confirmed" && item.transactionId && onCreateInvoiceGroup && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreateInvoiceGroup(item.transactionId!);
              }}
              disabled={isCreatingGroup}
            >
              {isCreatingGroup ? <Loader2 className="h-3 w-3 animate-spin" /> : "請求にまとめる"}
            </Button>
          )}
          {status === "unconfirmed" && item.transactionId && onCancelTransaction && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={(e) => e.stopPropagation()} disabled={isCancelling}>
                  {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Undo2 className="h-3 w-3 mr-1" />取引化取消</>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>取引化を取り消しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この取引を削除し、未取引化の状態に戻します。再度「確認して確定」ボタンで取引を作り直せます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => onCancelTransaction(item.transactionId!)}>
                    取引化を取り消す
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isNavigable && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleNavigate(); }}>
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-3 bg-gray-50/50 rounded-b-lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-gray-500">企業名:</span> <span className="font-medium">{item.companyName}</span></div>
            {item.billingCounterpartyName && (
              <div><span className="text-gray-500">実際の請求先:</span> <span className="font-medium text-red-600">{item.billingCounterpartyName}</span></div>
            )}
            <div><span className="text-gray-500">費目:</span> <span className="font-medium">{FEE_TYPE_LABELS[item.feeType] || item.feeType}</span></div>
            <div><span className="text-gray-500">金額:</span> <span className="font-medium">{formatAmount(item.amount)}</span></div>
            <div><span className="text-gray-500">対象期間:</span> <span className="font-medium">{formatDateDisplay(item.periodFrom)} - {formatDateDisplay(item.periodTo)}</span></div>
            {item.expectedInvoiceDate && <div><span className="text-gray-500">請求予定日:</span> <span className="font-medium">{formatDateDisplay(item.expectedInvoiceDate)}</span></div>}
            {(item.paymentDueDate || item.expectedPaymentDeadline) && <div><span className="text-gray-500">支払期限:</span> <span className="font-medium">{formatDateDisplay(item.paymentDueDate || item.expectedPaymentDeadline)}</span></div>}
            {item.candidateName && <div><span className="text-gray-500">求職者:</span> <span className="font-medium">{item.candidateName}</span></div>}
            {item.description && <div className="col-span-2 md:col-span-3"><span className="text-gray-500">説明:</span> <span className="font-medium">{item.description}</span></div>}
            {item.transactionId && <div><span className="text-gray-500">取引ID:</span> <span className="font-medium">#{item.transactionId}</span></div>}
            {item.invoiceGroupId && <div><span className="text-gray-500">請求グループID:</span> <span className="font-medium">#{item.invoiceGroupId}</span></div>}
            {item.invoiceGroupStatus && <div><span className="text-gray-500">請求グループステータス:</span> <span className="font-medium">{item.invoiceGroupStatus}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 経費アイテム行（展開式）
// ============================================

function ExpenseItemRow({
  item,
  status,
  onCreateTransaction,
  onCancelTransaction,
  onOpenTransaction,
  onCreatePaymentGroup,
  isCancelling,
  isCreating,
  isCreatingGroup,
}: {
  item: ExpenseLifecycleItem;
  status: ExpenseLifecycleStatus;
  onCreateTransaction?: (item: ExpenseLifecycleItem) => void;
  onCancelTransaction?: (transactionId: number) => void;
  onOpenTransaction?: (transactionId: number, type: "revenue" | "expense") => void;
  onCreatePaymentGroup?: (transactionId: number) => void;
  isCancelling?: boolean;
  isCreating?: boolean;
  isCreatingGroup?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [now] = useState(() => Date.now());

  const handleNavigate = () => {
    if (status === "not_created") return;
    if (item.transactionId) {
      if (status === "unconfirmed") {
        router.push(`/stp/finance/transactions/${item.transactionId}/edit`);
      } else if (item.paymentGroupId) {
        router.push(`/stp/finance/payment-groups?groupId=${item.paymentGroupId}`);
      } else {
        router.push(`/stp/finance/transactions`);
      }
    }
  };

  const isNavigable = status !== "not_created" && item.transactionId;
  const overdueDays =
    status === "overdue" && item.paymentDueDate
      ? Math.floor((now - new Date(item.paymentDueDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

  return (
    <div className={`rounded-lg border ${expanded ? "border-gray-300" : ""}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{item.agentName}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {EXPENSE_TYPE_LABELS[item.expenseType] || item.expenseType}
            </Badge>
            {item.companyName && (
              <span className="text-xs text-gray-500 truncate">{item.companyName}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="font-semibold text-gray-900">{formatAmount(item.amount)}</span>
            {item.netPaymentAmount != null && item.netPaymentAmount !== item.amount && (
              <span className="text-gray-500">(差引: {formatAmount(item.netPaymentAmount)})</span>
            )}
            {item.candidateName && <span>{item.candidateName}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.paymentDueDate && (
            <div className="text-xs text-gray-500 text-right">
              <div>支払期限: {formatDateDisplay(item.paymentDueDate)}</div>
            </div>
          )}
          {overdueDays != null && overdueDays > 0 && (
            <Badge className="bg-red-600 text-white text-xs">{overdueDays}日超過</Badge>
          )}
          {status === "not_created" && onCreateTransaction && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onCreateTransaction(item); }} disabled={isCreating}>
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認して確定"}
            </Button>
          )}
          {status === "unconfirmed" && item.transactionId && onCancelTransaction && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTransaction?.(item.transactionId!, "expense");
              }}
            >
              編集・確定
            </Button>
          )}
          {status === "confirmed" && item.transactionId && onCreatePaymentGroup && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreatePaymentGroup(item.transactionId!);
              }}
              disabled={isCreatingGroup}
            >
              {isCreatingGroup ? <Loader2 className="h-3 w-3 animate-spin" /> : "支払にまとめる"}
            </Button>
          )}
          {status === "unconfirmed" && item.transactionId && onCancelTransaction && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={(e) => e.stopPropagation()} disabled={isCancelling}>
                  {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Undo2 className="h-3 w-3 mr-1" />取引化取消</>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>取引化を取り消しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この取引を削除し、未取引化の状態に戻します。再度「確認して確定」ボタンで取引を作り直せます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => onCancelTransaction(item.transactionId!)}>
                    取引化を取り消す
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isNavigable && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleNavigate(); }}>
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-3 bg-gray-50/50 rounded-b-lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-gray-500">代理店:</span> <span className="font-medium">{item.agentName}</span></div>
            <div><span className="text-gray-500">経費種別:</span> <span className="font-medium">{EXPENSE_TYPE_LABELS[item.expenseType] || item.expenseType}</span></div>
            <div><span className="text-gray-500">支払予定額:</span> <span className="font-medium">{formatAmount(item.amount)}</span></div>
            {item.companyName && <div><span className="text-gray-500">対象企業:</span> <span className="font-medium">{item.companyName}</span></div>}
            {item.appliedCommissionRate != null && (
              <div><span className="text-gray-500">報酬率:</span> <span className="font-medium">{item.appliedCommissionRate}%（{item.appliedCommissionType === "fixed" ? "固定" : "率"}）</span></div>
            )}
            {item.withholdingTaxAmount != null && item.withholdingTaxAmount > 0 && (
              <div><span className="text-gray-500">源泉徴収額:</span> <span className="font-medium">{formatAmount(item.withholdingTaxAmount)}</span></div>
            )}
            {item.netPaymentAmount != null && item.netPaymentAmount !== item.amount && (
              <div><span className="text-gray-500">差引支払額:</span> <span className="font-medium">{formatAmount(item.netPaymentAmount)}</span></div>
            )}
            {item.candidateName && <div><span className="text-gray-500">求職者:</span> <span className="font-medium">{item.candidateName}</span></div>}
            {item.description && <div className="col-span-2 md:col-span-3"><span className="text-gray-500">説明:</span> <span className="font-medium">{item.description}</span></div>}
            {item.paymentDueDate && <div><span className="text-gray-500">支払期限:</span> <span className="font-medium">{formatDateDisplay(item.paymentDueDate)}</span></div>}
            {item.transactionId && <div><span className="text-gray-500">取引ID:</span> <span className="font-medium">#{item.transactionId}</span></div>}
            {item.paymentGroupId && <div><span className="text-gray-500">支払グループID:</span> <span className="font-medium">#{item.paymentGroupId}</span></div>}
            {item.paymentGroupStatus && <div><span className="text-gray-500">支払グループステータス:</span> <span className="font-medium">{item.paymentGroupStatus}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// メインビュー
// ============================================

export function BillingLifecycleView({
  availableMonths,
  expenseCategories,
  counterpartyOptions,
}: {
  availableMonths: string[];
  expenseCategories: { id: number; name: string; type: string }[];
  counterpartyOptions: { id: number; label: string; counterpartyType: string }[];
}) {
  const router = useRouter();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const initialMonth = availableMonths.includes(defaultMonth)
    ? defaultMonth
    : availableMonths[availableMonths.length - 1] || defaultMonth;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [activeTopTab, setActiveTopTab] = useState("revenue");

  // 売上
  const [revenueData, setRevenueData] = useState<BillingLifecycleData | null>(null);
  const [isRevenueLoading, setIsRevenueLoading] = useState(false);
  const [activeRevenueStatus, setActiveRevenueStatus] = useState<LifecycleStatus>("not_created");

  // 経費
  const [expenseData, setExpenseData] = useState<ExpenseLifecycleData | null>(null);
  const [isExpenseLoading, setIsExpenseLoading] = useState(false);
  const [activeExpenseStatus, setActiveExpenseStatus] = useState<ExpenseLifecycleStatus>("not_created");

  const [isCreating, setIsCreating] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualExpenseCategories, setManualExpenseCategories] =
    useState<ExpenseCategoryOption[]>(expenseCategories);
  const [groupCreatingKey, setGroupCreatingKey] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<{
    kind: "invoice" | "payment";
    anchorTransactionId: number;
    data: TrackerGroupCandidateResult | null;
    selectedIds: Set<number>;
    submitting: boolean;
  } | null>(null);
  const [createdGroupPrompt, setCreatedGroupPrompt] = useState<{
    kind: "invoice" | "payment";
    groupId: number;
  } | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState<{
    id: number;
    type: "revenue" | "expense";
    initialEdit?: boolean;
    refreshOnClose?: boolean;
  } | null>(null);

  const loadRevenueData = useCallback(async (month: string) => {
    setIsRevenueLoading(true);
    try {
      const result = await getBillingLifecycleData(month);
      setRevenueData(result);
    } catch (error) {
      toast.error("売上データの取得に失敗しました");
      console.error(error);
    } finally {
      setIsRevenueLoading(false);
    }
  }, []);

  const loadExpenseData = useCallback(async (month: string) => {
    setIsExpenseLoading(true);
    try {
      const result = await getExpenseLifecycleData(month);
      setExpenseData(result);
    } catch (error) {
      toast.error("経費データの取得に失敗しました");
      console.error(error);
    } finally {
      setIsExpenseLoading(false);
    }
  }, []);

  const loadData = useCallback(async (month: string) => {
    await Promise.all([loadRevenueData(month), loadExpenseData(month)]);
  }, [loadRevenueData, loadExpenseData]);

  useEffect(() => {
    setManualExpenseCategories(expenseCategories);
  }, [expenseCategories]);

  useEffect(() => {
    loadData(initialMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    loadData(month);
  };

  const handleManualTransactionCreated = async (result: {
    type: "revenue" | "expense";
    status: "unconfirmed" | "confirmed";
    transactionId: number;
  }) => {
    if (result.type === "revenue") {
      setActiveTopTab("revenue");
      await loadRevenueData(selectedMonth);
      setActiveRevenueStatus(result.status === "confirmed" ? "confirmed" : "unconfirmed");
    } else {
      setActiveTopTab("expense");
      await loadExpenseData(selectedMonth);
      setActiveExpenseStatus(result.status === "confirmed" ? "confirmed" : "unconfirmed");
    }
  };

  const handleExpenseCategoryCreated = (category: ExpenseCategoryOption) => {
    setManualExpenseCategories((current) => {
      if (current.some((item) => item.id === category.id)) return current;
      return [...current, category];
    });
  };

  // 売上: 確認用の取引を作成して編集モーダルを開く
  const handleCreateRevenueTransaction = async (item: BillingLifecycleItem) => {
    if (item.feeType === "manual") return;
    setIsCreating(true);
    try {
      const input: BillingItemInput = {
        contractHistoryId: item.contractHistoryId,
        feeType: item.feeType,
        amount: item.amount,
        periodFrom: item.periodFrom,
        periodTo: item.periodTo,
        candidateId: item.candidateId ?? undefined,
        paymentDueDate: item.expectedPaymentDeadline ?? undefined,
      };
      const result = await createTransactionFromBilling(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      await loadRevenueData(selectedMonth);
      setPreviewTransaction({
        id: result.data.transactionId,
        type: "revenue",
        initialEdit: true,
        refreshOnClose: true,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取引化に失敗しました");
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkCreateRevenue = async () => {
    if (!revenueData) return;
    const notCreatedItems = revenueData.items.filter(
      (i): i is AutoBillingLifecycleItem =>
        i.status === "not_created" && i.feeType !== "manual"
    );
    if (notCreatedItems.length === 0) return;
    if (!window.confirm(`${notCreatedItems.length}件の取引を一括作成します。よろしいですか？`)) return;

    setIsCreating(true);
    try {
      const inputs: BillingItemInput[] = notCreatedItems.map((item) => ({
        contractHistoryId: item.contractHistoryId,
        feeType: item.feeType,
        amount: item.amount,
        periodFrom: item.periodFrom,
        periodTo: item.periodTo,
        candidateId: item.candidateId ?? undefined,
        paymentDueDate: item.expectedPaymentDeadline ?? undefined,
      }));
      const result = await bulkCreateTransactionsFromBilling(inputs);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.created}件の取引を作成しました`);
      await loadRevenueData(selectedMonth);
    } catch {
      toast.error("一括取引化に失敗しました");
    } finally {
      setIsCreating(false);
    }
  };

  // 経費: 確認用の取引を作成して編集モーダルを開く
  const handleCreateExpenseTransaction = async (item: ExpenseLifecycleItem) => {
    setIsCreating(true);
    try {
      const result = await createTransactionFromExpense({
        expenseType: item.expenseType,
        agentId: item.agentId,
        agentContractHistoryId: item.agentContractHistoryId,
        contractHistoryId: item.contractHistoryId,
        stpCompanyId: item.stpCompanyId,
        candidateId: item.candidateId,
        amount: item.amount,
        periodFrom: item.periodFrom,
        periodTo: item.periodTo,
        agentName: item.agentName,
        companyName: item.companyName,
        paymentDueDate: item.paymentDueDate ?? undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      await loadExpenseData(selectedMonth);
      setPreviewTransaction({
        id: result.data.transactionId,
        type: "expense",
        initialEdit: true,
        refreshOnClose: true,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "経費取引化に失敗しました");
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkCreateExpense = async () => {
    if (!expenseData) return;
    const notCreatedItems = expenseData.items.filter((i) => i.status === "not_created");
    if (notCreatedItems.length === 0) return;
    if (!window.confirm(`${notCreatedItems.length}件の経費取引を一括作成します。よろしいですか？`)) return;

    setIsCreating(true);
    try {
      const inputs = notCreatedItems.map((item) => ({
        expenseType: item.expenseType,
        agentId: item.agentId,
        agentContractHistoryId: item.agentContractHistoryId,
        contractHistoryId: item.contractHistoryId,
        stpCompanyId: item.stpCompanyId,
        candidateId: item.candidateId,
        amount: item.amount,
        periodFrom: item.periodFrom,
        periodTo: item.periodTo,
        agentName: item.agentName,
        companyName: item.companyName,
        paymentDueDate: item.paymentDueDate ?? undefined,
      }));
      const result = await bulkCreateTransactionsFromExpenses(inputs);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.created}件の経費取引を作成しました`);
      await loadExpenseData(selectedMonth);
    } catch {
      toast.error("一括取引化に失敗しました");
    } finally {
      setIsCreating(false);
    }
  };

  // 取引化取消
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelRevenueTransaction = async (transactionId: number) => {
    setIsCancelling(true);
    try {
      await deleteTransaction(transactionId);
      toast.success("取引化を取り消しました");
      await loadRevenueData(selectedMonth);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取引化取消に失敗しました");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancelExpenseTransaction = async (transactionId: number) => {
    setIsCancelling(true);
    try {
      await deleteTransaction(transactionId);
      toast.success("取引化を取り消しました");
      await loadExpenseData(selectedMonth);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取引化取消に失敗しました");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenTransaction = (id: number, type: "revenue" | "expense") => {
    setPreviewTransaction({ id, type, initialEdit: false });
  };

  const handleCreateInvoiceGroup = async (transactionId: number) => {
    setGroupCreatingKey(`invoice-${transactionId}`);
    setGroupModal({
      kind: "invoice",
      anchorTransactionId: transactionId,
      data: null,
      selectedIds: new Set([transactionId]),
      submitting: false,
    });
    try {
      const result = await getInvoiceGroupCandidatesFromTracker(transactionId);
      if (!result.ok) {
        toast.error(result.error);
        setGroupModal(null);
        return;
      }
      setGroupModal({
        kind: "invoice",
        anchorTransactionId: transactionId,
        data: result.data,
        selectedIds: new Set(
          result.data.candidates
            .filter((candidate) => candidate.recommended)
            .map((candidate) => candidate.id)
        ),
        submitting: false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "請求候補の取得に失敗しました");
      setGroupModal(null);
    } finally {
      setGroupCreatingKey(null);
    }
  };

  const handleCreatePaymentGroup = async (transactionId: number) => {
    setGroupCreatingKey(`payment-${transactionId}`);
    setGroupModal({
      kind: "payment",
      anchorTransactionId: transactionId,
      data: null,
      selectedIds: new Set([transactionId]),
      submitting: false,
    });
    try {
      const result = await getPaymentGroupCandidatesFromTracker(transactionId);
      if (!result.ok) {
        toast.error(result.error);
        setGroupModal(null);
        return;
      }
      setGroupModal({
        kind: "payment",
        anchorTransactionId: transactionId,
        data: result.data,
        selectedIds: new Set(
          result.data.candidates
            .filter((candidate) => candidate.recommended)
            .map((candidate) => candidate.id)
        ),
        submitting: false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "支払候補の取得に失敗しました");
      setGroupModal(null);
    } finally {
      setGroupCreatingKey(null);
    }
  };

  const handleToggleGroupCandidate = (id: number) => {
    setGroupModal((current) => {
      if (!current?.data) return current;
      const candidate = current.data.candidates.find((item) => item.id === id);
      if (candidate?.isAnchor) return current;
      const nextSelected = new Set(current.selectedIds);
      if (nextSelected.has(id)) {
        nextSelected.delete(id);
      } else {
        nextSelected.add(id);
      }
      return { ...current, selectedIds: nextSelected };
    });
  };

  const handleSubmitGroupModal = async () => {
    if (!groupModal?.data) return;
    const selectedTransactionIds = Array.from(groupModal.selectedIds);
    setGroupModal((current) => current ? { ...current, submitting: true } : current);
    try {
      const result =
        groupModal.kind === "invoice"
          ? await createInvoiceGroupFromTrackerTransactions(
              groupModal.anchorTransactionId,
              selectedTransactionIds
            )
          : await createPaymentGroupFromTrackerTransactions(
              groupModal.anchorTransactionId,
              selectedTransactionIds
            );
      if (!result.ok) {
        toast.error(result.error);
        setGroupModal((current) => current ? { ...current, submitting: false } : current);
        return;
      }
      toast.success(
        groupModal.kind === "invoice"
          ? `請求を作成しました（ID: ${result.data.groupId}）`
          : `支払を作成しました（ID: ${result.data.groupId}）`
      );
      setGroupModal(null);
      if (groupModal.kind === "invoice") {
        await loadRevenueData(selectedMonth);
        setActiveRevenueStatus("in_invoice_draft");
      } else {
        await loadExpenseData(selectedMonth);
        setActiveExpenseStatus("in_payment_group");
      }
      setCreatedGroupPrompt({
        kind: groupModal.kind,
        groupId: result.data.groupId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "グループ作成に失敗しました");
      setGroupModal((current) => current ? { ...current, submitting: false } : current);
    }
  };

  const handleOpenCreatedGroup = () => {
    if (!createdGroupPrompt) return;
    const path =
      createdGroupPrompt.kind === "invoice"
        ? `/stp/finance/invoices?groupId=${createdGroupPrompt.groupId}`
        : `/stp/finance/payment-groups?groupId=${createdGroupPrompt.groupId}`;
    setCreatedGroupPrompt(null);
    router.push(path);
  };

  const formatMonthLabel = (month: string): string => {
    const [y, m] = month.split("-");
    return `${y}年${parseInt(m, 10)}月`;
  };

  // 売上サマリー
  const revenueTotalAmount = revenueData
    ? revenueData.items.reduce((sum, item) => sum + item.amount, 0)
    : 0;

  const getRevenueItems = (status: LifecycleStatus) =>
    revenueData?.items.filter((item) => item.status === status) ?? [];

  // 経費サマリー
  const expenseTotalAmount = expenseData
    ? expenseData.items.reduce((sum, item) => sum + item.amount, 0)
    : 0;

  const getExpenseItems = (status: ExpenseLifecycleStatus) =>
    expenseData?.items.filter((item) => item.status === status) ?? [];

  return (
    <div className="space-y-6 p-6">
      {showManualModal && (
        <ManualTrackerTransactionModal
          open={showManualModal}
          selectedMonth={selectedMonth}
          counterpartyOptions={counterpartyOptions}
          expenseCategories={manualExpenseCategories}
          onClose={() => setShowManualModal(false)}
          onCreated={handleManualTransactionCreated}
          onExpenseCategoryCreated={handleExpenseCategoryCreated}
        />
      )}
      <Dialog
        open={createdGroupPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedGroupPrompt(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdGroupPrompt?.kind === "invoice" ? "請求を作成しました" : "支払を作成しました"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              このままトラッカーで他の取引をまとめることも、作成した
              {createdGroupPrompt?.kind === "invoice" ? "請求管理" : "支払管理"}
              に移動して次の処理へ進むこともできます。
            </p>
            {createdGroupPrompt && (
              <p className="font-medium text-foreground">
                作成ID: #{createdGroupPrompt.groupId}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setCreatedGroupPrompt(null)}
            >
              トラッカーで続ける
            </Button>
            <Button onClick={handleOpenCreatedGroup}>
              {createdGroupPrompt?.kind === "invoice" ? "請求管理へ移動" : "支払管理へ移動"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {groupModal && (
        <TrackerGroupCandidateModal
          open={true}
          kind={groupModal.kind}
          data={groupModal.data}
          selectedIds={groupModal.selectedIds}
          loading={groupModal.submitting}
          onToggle={handleToggleGroupCandidate}
          onClose={() => setGroupModal(null)}
          onSubmit={handleSubmitGroupModal}
        />
      )}
      {previewTransaction && (
        <TransactionPreviewModal
          transactionId={previewTransaction.id}
          open={true}
          initialEdit={previewTransaction.initialEdit}
          closeOnCancelEdit={previewTransaction.initialEdit}
          onClose={() => {
            const closingTransaction = previewTransaction;
            setPreviewTransaction(null);
            if (closingTransaction.refreshOnClose) {
              if (closingTransaction.type === "revenue") {
                void loadRevenueData(selectedMonth);
              } else {
                void loadExpenseData(selectedMonth);
              }
            }
          }}
          onConfirmed={async () => {
            if (previewTransaction.type === "revenue") {
              await loadRevenueData(selectedMonth);
              setActiveRevenueStatus("confirmed");
            } else {
              await loadExpenseData(selectedMonth);
              setActiveExpenseStatus("confirmed");
            }
          }}
          expenseCategories={manualExpenseCategories}
          transactionType={previewTransaction.type}
        />
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">売上・支払トラッカー</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowManualModal(true)}>
            手動追加
          </Button>
          <label className="text-sm font-medium text-gray-700">発生月:</label>
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthLabel(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 売上/支払タブ */}
      <Tabs value={activeTopTab} onValueChange={setActiveTopTab} className="w-full">
        <TabsList>
          <TabsTrigger value="revenue">
            売上（請求）
            {revenueData && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {revenueData.items.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expense">
            支払（外注費）
            {expenseData && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {expenseData.items.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ====== 売上タブ ====== */}
        <TabsContent value="revenue" className="space-y-4 mt-4">
          {revenueData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-xs text-gray-500">合計件数</div>
                <div className="text-xl font-bold">{revenueData.items.length}件</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">合計金額（税抜）</div>
                <div className="text-xl font-bold">{formatAmount(revenueTotalAmount)}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">未取引化</div>
                <div className="text-xl font-bold text-red-600">{revenueData.summary.notCreated}件</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">期限超過</div>
                <div className="text-xl font-bold text-red-600">{revenueData.summary.overdue}件</div>
              </Card>
            </div>
          )}

          {isRevenueLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">データを読み込み中...</span>
            </div>
          )}

          {revenueData && !isRevenueLoading && (
            <Tabs
              value={activeRevenueStatus}
              onValueChange={(v) => setActiveRevenueStatus(v as LifecycleStatus)}
              className="w-full"
            >
              <TabsList className="flex flex-wrap h-auto gap-1">
                {REVENUE_STATUS_ORDER.map((status) => {
                  const config = REVENUE_STATUS_CONFIGS[status];
                  const count = (revenueData.summary as Record<string, number>)[config.summaryKey] ?? 0;
                  return (
                    <TabsTrigger key={status} value={status} className="text-xs gap-1">
                      {config.label}
                      <Badge variant="secondary" className={`text-xs ml-1 ${count > 0 ? config.badgeClassName : ""}`}>
                        {count}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {REVENUE_STATUS_ORDER.map((status) => {
                const config = REVENUE_STATUS_CONFIGS[status];
                const count = (revenueData.summary as Record<string, number>)[config.summaryKey] ?? 0;
                return (
                  <TabsContent key={status} value={status} className="mt-4">
                    {status === "not_created" && count > 0 && (
                      <div className="flex justify-end mb-3">
                        <Button size="sm" onClick={handleBulkCreateRevenue} disabled={isCreating}>
                          {isCreating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          一括取引化（{count}件）
                        </Button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {getRevenueItems(status).length === 0 ? (
                        <div className="text-sm text-gray-500 py-8 text-center">該当する項目はありません</div>
                      ) : (
                        getRevenueItems(status).map((item) => (
                          <RevenueItemRow
                            key={item.id}
                            item={item}
                            status={status}
                            onCreateTransaction={status === "not_created" ? handleCreateRevenueTransaction : undefined}
                            onCancelTransaction={status === "unconfirmed" ? handleCancelRevenueTransaction : undefined}
                            onOpenTransaction={handleOpenTransaction}
                            onCreateInvoiceGroup={status === "confirmed" ? handleCreateInvoiceGroup : undefined}
                            isCancelling={isCancelling}
                            isCreating={isCreating}
                            isCreatingGroup={
                              item.transactionId != null &&
                              groupCreatingKey === `invoice-${item.transactionId}`
                            }
                          />
                        ))
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </TabsContent>

        {/* ====== 支払タブ ====== */}
        <TabsContent value="expense" className="space-y-4 mt-4">
          {expenseData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-xs text-gray-500">合計件数</div>
                <div className="text-xl font-bold">{expenseData.items.length}件</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">合計金額</div>
                <div className="text-xl font-bold">{formatAmount(expenseTotalAmount)}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">未取引化</div>
                <div className="text-xl font-bold text-red-600">
                  {expenseData.summary.notCreated}件
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-gray-500">期限超過</div>
                <div className="text-xl font-bold text-red-600">{expenseData.summary.overdue}件</div>
              </Card>
            </div>
          )}

          {isExpenseLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">データを読み込み中...</span>
            </div>
          )}

          {expenseData && !isExpenseLoading && (
            <Tabs
              value={activeExpenseStatus}
              onValueChange={(v) => setActiveExpenseStatus(v as ExpenseLifecycleStatus)}
              className="w-full"
            >
              <TabsList className="flex flex-wrap h-auto gap-1">
                {EXPENSE_STATUS_ORDER.map((status) => {
                  const config = EXPENSE_STATUS_CONFIGS[status];
                  const count = (expenseData.summary as Record<string, number>)[config.summaryKey] ?? 0;
                  return (
                    <TabsTrigger key={status} value={status} className="text-xs gap-1">
                      {config.label}
                      <Badge variant="secondary" className={`text-xs ml-1 ${count > 0 ? config.badgeClassName : ""}`}>
                        {count}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {EXPENSE_STATUS_ORDER.map((status) => {
                const config = EXPENSE_STATUS_CONFIGS[status];
                const count = (expenseData.summary as Record<string, number>)[config.summaryKey] ?? 0;
                return (
                  <TabsContent key={status} value={status} className="mt-4">
                    {status === "not_created" && count > 0 && (
                      <div className="flex justify-end mb-3">
                        <Button size="sm" onClick={handleBulkCreateExpense} disabled={isCreating}>
                          {isCreating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          一括取引化（{count}件）
                        </Button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {getExpenseItems(status).length === 0 ? (
                        <div className="text-sm text-gray-500 py-8 text-center">該当する項目はありません</div>
                      ) : (
                        getExpenseItems(status).map((item) => (
                          <ExpenseItemRow
                            key={item.id}
                            item={item}
                            status={status}
                            onCreateTransaction={status === "not_created" ? handleCreateExpenseTransaction : undefined}
                            onCancelTransaction={status === "unconfirmed" ? handleCancelExpenseTransaction : undefined}
                            onOpenTransaction={handleOpenTransaction}
                            onCreatePaymentGroup={status === "confirmed" ? handleCreatePaymentGroup : undefined}
                            isCancelling={isCancelling}
                            isCreating={isCreating}
                            isCreatingGroup={
                              item.transactionId != null &&
                              groupCreatingKey === `payment-${item.transactionId}`
                            }
                          />
                        ))
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
