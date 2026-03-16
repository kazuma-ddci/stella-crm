"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Filter, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  getContractStatusMatrix,
  getContractHistoryTransactionSummary,
  type ContractTransactionStatus,
  type AggregateStatus,
  type ContractTransaction,
  type MonthlyTransactionStatus,
} from "./actions";

// ============================================
// 定数
// ============================================

const AGGREGATE_STATUS_CONFIG: Record<
  AggregateStatus,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  no_transactions: {
    label: "未生成",
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    dotColor: "bg-gray-400",
  },
  unconfirmed: {
    label: "未確認",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    dotColor: "bg-orange-500",
  },
  confirmed: {
    label: "確認済",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    dotColor: "bg-blue-500",
  },
  grouped: {
    label: "処理中",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    dotColor: "bg-indigo-500",
  },
  awaiting_payment: {
    label: "入金待ち",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    dotColor: "bg-yellow-500",
  },
  partially_paid: {
    label: "一部完了",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    dotColor: "bg-amber-500",
  },
  completed: {
    label: "完了",
    color: "text-green-700",
    bgColor: "bg-green-100",
    dotColor: "bg-green-500",
  },
};

const TX_STATUS_LABELS: Record<string, string> = {
  unconfirmed: "未確認",
  confirmed: "確認済",
  awaiting_accounting: "経理待ち",
  returned: "差戻し",
  resubmitted: "再提出",
  journalized: "仕訳済",
  partially_paid: "一部入金",
  paid: "完了",
  hidden: "非表示",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  pdf_created: "PDF作成済",
  sent: "送付済",
  awaiting_accounting: "経理確認中",
  partially_paid: "一部入金",
  paid: "入金済",
  returned: "差戻し",
  corrected: "訂正済",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  before_request: "請求前",
  requested: "請求済",
  invoice_received: "請求書受領",
  confirmed: "確認済",
  awaiting_accounting: "経理確認中",
  paid: "支払済",
  returned: "差戻し",
  rejected: "却下",
  re_requested: "再請求",
  unprocessed: "未処理",
};

const PLAN_LABELS: Record<string, string> = {
  monthly: "月額",
  performance: "成果報酬",
};

const INDUSTRY_LABELS: Record<string, string> = {
  general: "一般",
  dispatch: "派遣",
};

const REVENUE_TYPE_LABELS: Record<string, string> = {
  initial: "初期費用",
  monthly: "月額",
  performance: "成果報酬",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  agent_initial: "代理店初期",
  agent_monthly: "代理店月額",
  commission_initial: "手数料(初期)",
  commission_monthly: "手数料(月額)",
  commission_performance: "手数料(成果)",
};

// ============================================
// コンポーネント
// ============================================

function StatusBadge({ status }: { status: AggregateStatus }) {
  const config = AGGREGATE_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

function StatusCell({
  monthStatus,
  onClick,
}: {
  monthStatus: MonthlyTransactionStatus;
  onClick: () => void;
}) {
  const config = AGGREGATE_STATUS_CONFIG[monthStatus.aggregateStatus];
  const txCount = monthStatus.transactions.length;

  return (
    <button
      className={`w-full h-full min-h-[40px] flex flex-col items-center justify-center gap-0.5 rounded transition-colors hover:ring-2 hover:ring-primary/30 cursor-pointer ${config.bgColor}`}
      onClick={onClick}
    >
      <span className={`text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
      {txCount > 0 && (
        <span className="text-[10px] text-gray-500">{txCount}件</span>
      )}
    </button>
  );
}

function TransactionDetailModal({
  open,
  onOpenChange,
  contractHistoryId,
  companyName,
  contractLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractHistoryId: number;
  companyName: string;
  contractLabel: string;
}) {
  const [data, setData] = useState<{
    transactions: ContractTransaction[];
    monthlyStatuses: MonthlyTransactionStatus[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !contractHistoryId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetching pattern: set loading before fetch
    setLoading(true);
    getContractHistoryTransactionSummary(contractHistoryId)
      .then(setData)
      .catch(() => toast.error("取引データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [open, contractHistoryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="datagrid" className="p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>
            取引ステータス - {companyName} ({contractLabel})
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              読み込み中...
            </div>
          ) : !data || data.transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              この契約に紐づく取引はありません
            </div>
          ) : (
            <div className="space-y-6">
              {/* サマリーカード */}
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(
                  data.transactions.reduce(
                    (acc, tx) => {
                      acc[tx.status] = (acc[tx.status] || 0) + 1;
                      return acc;
                    },
                    {} as Record<string, number>
                  )
                ).map(([status, count]) => (
                  <div
                    key={status}
                    className="border rounded-lg p-3 text-center"
                  >
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">
                      {TX_STATUS_LABELS[status] || status}
                    </div>
                  </div>
                ))}
              </div>

              {/* 月別セクション */}
              {data.monthlyStatuses.map((ms) => (
                <div key={ms.month} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold">
                      {ms.month.replace("-", "/")}
                    </h3>
                    <StatusBadge status={ms.aggregateStatus} />
                  </div>

                  <Table containerClassName="border rounded-lg">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">ID</TableHead>
                        <TableHead>種別</TableHead>
                        <TableHead>取引先</TableHead>
                        <TableHead className="text-right">金額(税抜)</TableHead>
                        <TableHead>取引ステータス</TableHead>
                        <TableHead>請求/支払グループ</TableHead>
                        <TableHead>グループステータス</TableHead>
                        <TableHead>摘要</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ms.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs">
                            {tx.id}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Badge
                                variant={
                                  tx.type === "revenue"
                                    ? "default"
                                    : "secondary"
                                }
                                className="w-fit text-[10px]"
                              >
                                {tx.type === "revenue" ? "売上" : "経費"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {tx.stpRevenueType
                                  ? REVENUE_TYPE_LABELS[tx.stpRevenueType] ||
                                    tx.stpRevenueType
                                  : tx.stpExpenseType
                                    ? EXPENSE_TYPE_LABELS[tx.stpExpenseType] ||
                                      tx.stpExpenseType
                                    : ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {tx.counterpartyName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {tx.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                tx.status === "paid"
                                  ? "default"
                                  : tx.status === "unconfirmed"
                                    ? "destructive"
                                    : "outline"
                              }
                              className="text-[10px]"
                            >
                              {TX_STATUS_LABELS[tx.status] || tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {tx.invoiceNumber && (
                              <a
                                href={`/stp/finance/invoices`}
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                {tx.invoiceNumber}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {tx.paymentGroupRef && (
                              <a
                                href={`/stp/finance/payment-groups`}
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                {tx.paymentGroupRef}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {!tx.invoiceNumber && !tx.paymentGroupRef && (
                              <span className="text-muted-foreground">
                                未グループ
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {tx.invoiceGroupStatus && (
                              <Badge variant="outline" className="text-[10px]">
                                {INVOICE_STATUS_LABELS[tx.invoiceGroupStatus] ||
                                  tx.invoiceGroupStatus}
                              </Badge>
                            )}
                            {tx.paymentGroupStatus && (
                              <Badge variant="outline" className="text-[10px]">
                                {PAYMENT_STATUS_LABELS[
                                  tx.paymentGroupStatus
                                ] || tx.paymentGroupStatus}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {tx.note || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// メインページ
// ============================================

export default function ContractStatusPage() {
  const [data, setData] = useState<ContractTransactionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 詳細モーダル
  const [detailModal, setDetailModal] = useState<{
    contractHistoryId: number;
    companyName: string;
    contractLabel: string;
  } | null>(null);

  // 表示月を計算
  const getTargetMonths = useCallback(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = -2 + monthOffset; i < 4 + monthOffset; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }
    return months;
  }, [monthOffset]);

  const targetMonths = getTargetMonths();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getContractStatusMatrix({
        targetMonths,
        statusFilter:
          statusFilter !== "all"
            ? (statusFilter as AggregateStatus)
            : undefined,
      });
      setData(result);
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [targetMonths, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 今月
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // サマリー集計
  const summary = data.reduce(
    (acc, row) => {
      for (const ms of row.monthlyStatuses) {
        if (ms.month === currentMonth) {
          acc[ms.aggregateStatus] = (acc[ms.aggregateStatus] || 0) + 1;
        }
      }
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">契約別取引ステータス</h1>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-7 gap-2">
        {(Object.keys(AGGREGATE_STATUS_CONFIG) as AggregateStatus[]).map(
          (status) => {
            const config = AGGREGATE_STATUS_CONFIG[status];
            const count = summary[status] || 0;
            return (
              <button
                key={status}
                onClick={() =>
                  setStatusFilter(
                    statusFilter === status ? "all" : status
                  )
                }
                className={`border rounded-lg p-3 text-center transition-all ${
                  statusFilter === status
                    ? "ring-2 ring-primary"
                    : "hover:border-gray-400"
                }`}
              >
                <div className={`text-2xl font-bold ${config.color}`}>
                  {count}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {config.label}
                </div>
              </button>
            );
          }
        )}
      </div>

      {/* フィルター＆ナビ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {(
                Object.entries(AGGREGATE_STATUS_CONFIG) as [
                  AggregateStatus,
                  (typeof AGGREGATE_STATUS_CONFIG)[AggregateStatus],
                ][]
              ).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthOffset((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthOffset(0)}
            disabled={monthOffset === 0}
          >
            今月
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthOffset((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* マトリクステーブル */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12">
          読み込み中...
        </div>
      ) : data.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {statusFilter !== "all"
            ? "該当するデータがありません"
            : "アクティブな契約がありません"}
        </div>
      ) : (
        <Table containerClassName="border rounded-lg" containerStyle={{ overflow: "auto", maxHeight: "calc(100vh - 320px)" }}>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-white whitespace-nowrap min-w-[180px]">
                企業名
              </TableHead>
              <TableHead className="whitespace-nowrap min-w-[80px]">
                プラン
              </TableHead>
              <TableHead className="whitespace-nowrap min-w-[80px]">
                媒体
              </TableHead>
              {targetMonths.map((month) => (
                <TableHead
                  key={month}
                  className={`text-center whitespace-nowrap min-w-[90px] ${
                    month === currentMonth
                      ? "bg-primary/5 font-bold"
                      : ""
                  }`}
                >
                  {month.replace("-", "/")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const contractLabel = `${INDUSTRY_LABELS[row.industryType] || row.industryType}/${PLAN_LABELS[row.contractPlan] || row.contractPlan}${row.jobMedia ? `/${row.jobMedia}` : ""}`;
              return (
                <TableRow key={row.contractHistoryId} className="group/row">
                  <TableCell className="sticky left-0 z-10 bg-white group-hover/row:bg-gray-50 font-medium whitespace-nowrap">
                    {row.companyName}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <span>
                        {INDUSTRY_LABELS[row.industryType]}/
                        {PLAN_LABELS[row.contractPlan]}
                      </span>
                      <span className="text-muted-foreground">
                        {row.contractPlan === "monthly"
                          ? `${row.monthlyFee.toLocaleString()}円/月`
                          : `${row.performanceFee.toLocaleString()}円/件`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.jobMedia || "-"}
                  </TableCell>
                  {row.monthlyStatuses.map((ms) => (
                    <TableCell
                      key={ms.month}
                      className={`p-1 ${
                        ms.month === currentMonth ? "bg-primary/5" : ""
                      }`}
                    >
                      <StatusCell
                        monthStatus={ms}
                        onClick={() =>
                          setDetailModal({
                            contractHistoryId: row.contractHistoryId,
                            companyName: row.companyName,
                            contractLabel,
                          })
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* 詳細モーダル */}
      {detailModal && (
        <TransactionDetailModal
          open={!!detailModal}
          onOpenChange={(open) => !open && setDetailModal(null)}
          contractHistoryId={detailModal.contractHistoryId}
          companyName={detailModal.companyName}
          contractLabel={detailModal.contractLabel}
        />
      )}
    </div>
  );
}
