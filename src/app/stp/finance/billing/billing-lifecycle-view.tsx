"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "./actions";
import { deleteTransaction } from "@/app/accounting/transactions/actions";
import type {
  BillingLifecycleData,
  BillingLifecycleItem,
  LifecycleStatus,
  BillingItemInput,
  ExpenseLifecycleData,
  ExpenseLifecycleItem,
  ExpenseLifecycleStatus,
} from "./actions";

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
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  agent_initial: "代理店初期費用",
  agent_monthly: "代理店月額",
  commission_initial: "初期費用紹介報酬",
  commission_monthly: "月額紹介報酬",
  commission_performance: "成果報酬紹介報酬",
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

// ============================================
// 売上アイテム行（展開式）
// ============================================

function RevenueItemRow({
  item,
  status,
  onCreateTransaction,
  onCancelTransaction,
  isCancelling,
  isCreating,
}: {
  item: BillingLifecycleItem;
  status: LifecycleStatus;
  onCreateTransaction?: (item: BillingLifecycleItem) => void;
  onCancelTransaction?: (transactionId: number) => void;
  isCancelling?: boolean;
  isCreating?: boolean;
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
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : "取引化する"}
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
                    この取引を削除し、未取引化の状態に戻します。再度「取引化する」ボタンで取引を作り直せます。
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
  isCancelling,
  isCreating,
}: {
  item: ExpenseLifecycleItem;
  status: ExpenseLifecycleStatus;
  onCreateTransaction?: (item: ExpenseLifecycleItem) => void;
  onCancelTransaction?: (transactionId: number) => void;
  isCancelling?: boolean;
  isCreating?: boolean;
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
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : "取引化する"}
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
                    この取引を削除し、未取引化の状態に戻します。再度「取引化する」ボタンで取引を作り直せます。
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
}: {
  availableMonths: string[];
}) {
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
    loadData(initialMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    loadData(month);
  };

  // 売上: 取引化
  const handleCreateRevenueTransaction = async (item: BillingLifecycleItem) => {
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
      toast.success(`取引を作成しました（ID: ${result.data.transactionId}）`);
      await loadRevenueData(selectedMonth);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取引化に失敗しました");
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkCreateRevenue = async () => {
    if (!revenueData) return;
    const notCreatedItems = revenueData.items.filter((i) => i.status === "not_created");
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

  // 経費: 取引化
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
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`経費取引を作成しました（ID: ${result.data.transactionId}）`);
      await loadExpenseData(selectedMonth);
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">売上・支払トラッカー</h1>
        <div className="flex items-center gap-3">
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
                            isCancelling={isCancelling}
                            isCreating={isCreating}
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
                            isCancelling={isCancelling}
                            isCreating={isCreating}
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
