"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PlusCircle, ClipboardList, Repeat, BarChart3, UserCheck, Eye, Wallet } from "lucide-react";
import { ManualExpenseForm } from "./manual-expense-form";
import {
  approveByProjectApprover,
  rejectByProjectApprover,
  type ExpenseFormData,
  type ExpenseStatusItem,
  type MyExpenseDashboard,
  type RecurringItem,
  type MonthlySummary,
} from "./actions";

type Props = {
  formData: ExpenseFormData;
  mode: "accounting" | "project";
  backUrl: string;
  myExpenses: ExpenseStatusItem[];
  myExpenseDashboard?: MyExpenseDashboard;
  recurringTransactions: RecurringItem[];
  monthlySummary: MonthlySummary[];
  pendingApprovals: ExpenseStatusItem[];
  showProject?: boolean; // 定期取引でプロジェクト名を表示するか
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_project_approval: { label: "承認者確認待ち", className: "bg-purple-100 text-purple-700" },
  pending_accounting_approval: { label: "承認済み・支払対応待ち", className: "bg-yellow-100 text-yellow-700" },
  awaiting_accounting: { label: "経理処理中", className: "bg-blue-100 text-blue-700" },
  returned: { label: "差し戻し", className: "bg-red-100 text-red-700" },
  paid: { label: "完了", className: "bg-green-100 text-green-700" },
  confirmed: { label: "確定", className: "bg-blue-100 text-blue-700" },
  before_request: { label: "請求前", className: "bg-gray-100 text-gray-700" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return <Badge variant="outline" className={`${s.className} text-xs`}>{s.label}</Badge>;
}

function formatAmount(n: number | null) {
  if (n == null) return "-";
  return `¥${n.toLocaleString()}`;
}

function formatRecurringAmount(item: DashboardRecurringItem) {
  if (item.amountType !== "fixed" || item.amount == null) return "変動";
  if (item.occurrenceCount > 1) return `${formatAmount(item.amount)} × ${item.occurrenceCount}回`;
  return formatAmount(item.amount);
}

function formatRecurringMonthlyAmount(item: DashboardRecurringItem) {
  if (item.monthlyEstimatedAmount == null) return "変動";
  if (item.occurrenceCount > 1) return `${formatAmount(item.monthlyEstimatedAmount)} / 月`;
  return formatAmount(item.monthlyEstimatedAmount);
}

function formatDate(d: Date | string | null) {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatMonthLabel(month: string) {
  const [year, monthPart] = month.split("-");
  return `${year}年${Number(monthPart)}月`;
}

function getMonthOptions(targetMonth: string) {
  const [year, monthPart] = targetMonth.split("-").map(Number);
  const base = new Date(year, monthPart - 1, 1);
  return Array.from({ length: 13 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() + index - 6, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: formatMonthLabel(value) };
  });
}

function formatFrequency(f: string, interval: number) {
  if (f === "once") return "一度限り";
  if (f === "monthly" && interval === 1) return "毎月";
  if (f === "monthly") return `${interval}ヶ月ごと`;
  if (f === "yearly" && interval === 1) return "毎年";
  if (f === "yearly") return `${interval}年ごと`;
  if (f === "weekly") return "毎週";
  return f;
}

// ============================================
// プレビューモーダル
// ============================================
function ExpensePreviewModal({ item, open, onClose }: { item: ExpenseStatusItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>社内経費申請詳細 {item.referenceCode ?? ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <StatusBadge status={item.status} />
            <span className="text-muted-foreground">{formatDate(item.createdAt)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">申請者:</span> {item.createdByName}</div>
            <div><span className="text-muted-foreground">承認者:</span> {item.approverName ?? "-"}</div>
            <div>
              <span className="text-muted-foreground">取引先:</span>{" "}
              {item.customCounterpartyName ? (
                <span>{item.customCounterpartyName} <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">手入力</Badge></span>
              ) : item.counterpartyName}
            </div>
            <div><span className="text-muted-foreground">金額:</span> {formatAmount(item.totalAmount)}</div>
            <div><span className="text-muted-foreground">勘定科目:</span> {item.expenseCategoryName ?? "未設定"}</div>
            <div><span className="text-muted-foreground">支払方法:</span> {item.paymentMethodName ?? "未設定"}</div>
            {item.periodFrom && (
              <div className="col-span-2">
                <span className="text-muted-foreground">発生期間:</span> {formatDate(item.periodFrom)} 〜 {formatDate(item.periodTo)}
              </div>
            )}
            {item.expenseOwners.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">担当者:</span> {item.expenseOwners.join(", ")}
              </div>
            )}
            {item.allocationTemplateName && (
              <div className="col-span-2 rounded border bg-muted/40 p-2">
                <div className="text-muted-foreground mb-1">プロジェクト按分: <span className="text-foreground">{item.allocationTemplateName}</span></div>
                <div className="space-y-1">
                  {item.allocationLines.map((line, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{line.costCenterName ?? line.label ?? "未確定"}</span>
                      <span className="font-mono">{line.allocationRate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {item.note && (
            <div>
              <span className="text-muted-foreground">摘要:</span>
              <p className="mt-1 whitespace-pre-wrap bg-muted/50 rounded p-2">{item.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type DashboardRecurringItem = MyExpenseDashboard["recurringItems"][number];

function RecurringPreviewModal({
  item,
  open,
  onClose,
}: {
  item: DashboardRecurringItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>サブスク・定期経費詳細</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <span className="text-muted-foreground">名称:</span> {item.name}
            </div>
            <div><span className="text-muted-foreground">取引先:</span> {item.counterpartyName}</div>
            <div><span className="text-muted-foreground">プロジェクト:</span> {item.projectName ?? "-"}</div>
            <div>
              <span className="text-muted-foreground">金額:</span>{" "}
              {formatRecurringAmount(item)}
            </div>
            <div><span className="text-muted-foreground">月見込み:</span> {formatRecurringMonthlyAmount(item)}</div>
            <div><span className="text-muted-foreground">サイクル:</span> {formatFrequency(item.frequency, item.intervalCount)}</div>
            <div><span className="text-muted-foreground">開始日:</span> {formatDate(item.startDate)}</div>
            <div><span className="text-muted-foreground">終了日:</span> {item.endDate ? formatDate(item.endDate) : "無期限"}</div>
            <div><span className="text-muted-foreground">次回予定:</span> {formatDate(item.nextOccurrenceDate)}</div>
            <div><span className="text-muted-foreground">対象月の回数:</span> {item.occurrenceCount}回</div>
            <div><span className="text-muted-foreground">申請者:</span> {item.creatorName}</div>
            <div><span className="text-muted-foreground">承認者:</span> {item.approverName ?? "-"}</div>
            {item.expenseOwners.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">担当者:</span> {item.expenseOwners.join(", ")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseTypeBadge({ sourceType }: { sourceType: string | null }) {
  if (sourceType === "recurring") {
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">サブスク</Badge>;
  }
  return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">単発</Badge>;
}

function RecurringTypeBadge({ item }: { item: DashboardRecurringItem }) {
  if (item.amountType !== "fixed") {
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">変動</Badge>;
  }
  if (item.frequency === "yearly") {
    return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">年額</Badge>;
  }
  return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">サブスク</Badge>;
}

function MyExpenseDashboardTab({
  dashboard,
  onMonthChange,
}: {
  dashboard: MyExpenseDashboard;
  onMonthChange: (month: string) => void;
}) {
  const [previewItem, setPreviewItem] = useState<MyExpenseDashboard["items"][number] | null>(null);
  const [previewRecurring, setPreviewRecurring] = useState<DashboardRecurringItem | null>(null);
  const monthOptions = getMonthOptions(dashboard.targetMonth);

  const previewExpense = previewItem
    ? {
        id: previewItem.id,
        groupType: "payment" as const,
        referenceCode: null,
        counterpartyName: previewItem.counterpartyName,
        customCounterpartyName: null,
        totalAmount: previewItem.amount,
        status: previewItem.status,
        approverName: previewItem.approverName,
        createdAt: previewItem.createdAt,
        createdByName: previewItem.creatorName,
        note: previewItem.note,
        expenseCategoryName: previewItem.expenseCategoryName,
        paymentMethodName: previewItem.paymentMethodName,
        periodFrom: previewItem.periodFrom,
        periodTo: previewItem.periodTo,
        expenseOwners: previewItem.expenseOwners,
        allocationTemplateName: previewItem.allocationTemplateName,
        allocationLines: previewItem.allocationLines,
      }
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">自分の経費</h2>
          <p className="text-sm text-muted-foreground">
            申請者・担当者・承認者として関係する経費を月別に確認できます。
          </p>
        </div>
        <select
          value={dashboard.targetMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm shadow-sm"
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">承認済み合計</p>
            <p className="text-xl font-bold">{formatAmount(dashboard.summary.approvedAmount)}</p>
            <p className="text-xs text-muted-foreground">{dashboard.summary.approvedCount}件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">承認待ち</p>
            <p className="text-xl font-bold">{formatAmount(dashboard.summary.pendingApprovalAmount)}</p>
            <p className="text-xs text-muted-foreground">{dashboard.summary.pendingApprovalCount}件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">支払対応中</p>
            <p className="text-xl font-bold">{formatAmount(dashboard.summary.inProgressAmount)}</p>
            <p className="text-xs text-muted-foreground">{dashboard.summary.inProgressCount}件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">完了</p>
            <p className="text-xl font-bold">{formatAmount(dashboard.summary.completedAmount)}</p>
            <p className="text-xs text-muted-foreground">{dashboard.summary.completedCount}件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">毎月かかる経費</p>
            <p className="text-xl font-bold">{formatAmount(dashboard.summary.recurringAmount)}</p>
            <p className="text-xs text-muted-foreground">{dashboard.summary.recurringCount}件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">差し戻し</p>
            <p className="text-xl font-bold text-red-600">{dashboard.summary.returnedCount}件</p>
            {dashboard.summary.hiddenCount > 0 && (
              <p className="text-xs text-muted-foreground">機密非表示 {dashboard.summary.hiddenCount}件</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">この月の経費</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {dashboard.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">この月の経費はありません</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>種類</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>取引先</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>対象期間</TableHead>
                    <TableHead>プロジェクト</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>申請者</TableHead>
                    <TableHead>承認者</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><ExpenseTypeBadge sourceType={item.sourceType} /></TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate">{item.note ?? item.expenseCategoryName ?? "-"}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{item.counterpartyName}</TableCell>
                      <TableCell className="text-right">{formatAmount(item.amount)}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.periodFrom)} - {formatDate(item.periodTo)}</TableCell>
                      <TableCell className="text-sm">{item.projectName ?? "-"}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-sm">{item.creatorName}</TableCell>
                      <TableCell className="text-sm">{item.approverName ?? "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewItem(item)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">毎月かかる経費</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {dashboard.recurringItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">この月に有効なサブスク・定期経費はありません</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>種類</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>取引先</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="text-right">月見込み</TableHead>
                    <TableHead>サイクル</TableHead>
                    <TableHead>次回予定</TableHead>
                    <TableHead>プロジェクト</TableHead>
                    <TableHead>申請者</TableHead>
                    <TableHead>承認者</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recurringItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><RecurringTypeBadge item={item} /></TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate">{item.name}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{item.counterpartyName}</TableCell>
                      <TableCell className="text-right">
                        {formatRecurringAmount(item)}
                      </TableCell>
                      <TableCell className="text-right">{formatRecurringMonthlyAmount(item)}</TableCell>
                      <TableCell>{formatFrequency(item.frequency, item.intervalCount)}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.nextOccurrenceDate)}</TableCell>
                      <TableCell className="text-sm">{item.projectName ?? "-"}</TableCell>
                      <TableCell className="text-sm">{item.creatorName}</TableCell>
                      <TableCell className="text-sm">{item.approverName ?? "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewRecurring(item)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExpensePreviewModal item={previewExpense} open={!!previewItem} onClose={() => setPreviewItem(null)} />
      <RecurringPreviewModal item={previewRecurring} open={!!previewRecurring} onClose={() => setPreviewRecurring(null)} />
    </div>
  );
}

// ============================================
// 自分の申請タブ
// ============================================
function ExpenseStatusTab({ items }: { items: ExpenseStatusItem[] }) {
  const [previewItem, setPreviewItem] = useState<ExpenseStatusItem | null>(null);

  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-12">申請した経費はまだありません</p>;
  }
  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>番号</TableHead>
              <TableHead>申請者</TableHead>
              <TableHead>取引先</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>承認者</TableHead>
              <TableHead>申請日</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="group/row">
                <TableCell className="font-mono text-sm">{item.referenceCode ?? "-"}</TableCell>
                <TableCell className="text-sm">{item.createdByName}</TableCell>
                <TableCell>
                  {item.customCounterpartyName ? (
                    <span className="text-sm">
                      {item.customCounterpartyName}
                      <Badge variant="outline" className="ml-1 text-xs bg-amber-50 text-amber-700 border-amber-200">手入力</Badge>
                    </span>
                  ) : <span className="text-sm">{item.counterpartyName}</span>}
                </TableCell>
                <TableCell className="text-right">{formatAmount(item.totalAmount)}</TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
                <TableCell className="text-sm">{item.approverName ?? "-"}</TableCell>
                <TableCell className="text-sm">{formatDate(item.createdAt)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewItem(item)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ExpensePreviewModal item={previewItem} open={!!previewItem} onClose={() => setPreviewItem(null)} />
    </>
  );
}

// ============================================
// 承認待ちタブ（プロジェクト承認者用）
// ============================================
function PendingApprovalsTab({ items }: { items: ExpenseStatusItem[] }) {
  const [previewItem, setPreviewItem] = useState<ExpenseStatusItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const router = useRouter();

  const handleApprove = (id: number) => {
    if (!confirm("この経費を承認して経理へ引き渡しますか？")) return;
    startTransition(async () => {
      const result = await approveByProjectApprover(id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleReject = () => {
    if (rejectId === null) return;
    startTransition(async () => {
      const result = await rejectByProjectApprover(rejectId, rejectReason.trim() || undefined);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setRejectId(null);
      setRejectReason("");
      router.refresh();
    });
  };

  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-12">承認待ちの経費はありません</p>;
  }

  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>番号</TableHead>
              <TableHead>申請者</TableHead>
              <TableHead>取引先</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>摘要</TableHead>
              <TableHead>按分</TableHead>
              <TableHead>申請日</TableHead>
              <TableHead className="w-[200px]">アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="group/row">
                <TableCell className="font-mono text-sm">{item.referenceCode ?? "-"}</TableCell>
                <TableCell className="text-sm">{item.createdByName}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">
                  {item.customCounterpartyName ?? item.counterpartyName}
                </TableCell>
                <TableCell className="text-right">{formatAmount(item.totalAmount)}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">{item.note ?? "-"}</TableCell>
                <TableCell className="text-sm">
                  {item.allocationTemplateName ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {item.allocationTemplateName}
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-sm">{formatDate(item.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewItem(item)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700"
                      disabled={isPending}
                      onClick={() => handleApprove(item.id)}
                    >
                      承認
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={isPending}
                      onClick={() => setRejectId(item.id)}
                    >
                      差し戻し
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 差し戻し理由モーダル */}
      <Dialog open={rejectId !== null} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>差し戻し理由</DialogTitle></DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="差し戻し理由（任意）"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRejectId(null)}>キャンセル</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleReject} disabled={isPending}>
              差し戻す
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExpensePreviewModal item={previewItem} open={!!previewItem} onClose={() => setPreviewItem(null)} />
    </>
  );
}

// ============================================
// サブスク・定期経費タブ
// ============================================
function RecurringTab({ items, showProject = false }: { items: RecurringItem[]; showProject?: boolean }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-12">サブスク・定期経費は登録されていません</p>;
  }
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showProject && <TableHead>プロジェクト</TableHead>}
            <TableHead>名称</TableHead>
            <TableHead>取引先</TableHead>
            <TableHead className="text-right">金額</TableHead>
            <TableHead>サイクル</TableHead>
            <TableHead>開始日</TableHead>
            <TableHead>終了日</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              {showProject && (
                <TableCell>
                  <Badge variant="outline" className="text-xs">{item.projectName ?? "-"}</Badge>
                </TableCell>
              )}
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.counterpartyName}</TableCell>
              <TableCell className="text-right">
                {item.amountType === "fixed" ? formatAmount(item.amount) : "変動"}
              </TableCell>
              <TableCell>{formatFrequency(item.frequency, item.intervalCount)}</TableCell>
              <TableCell className="text-sm">{formatDate(item.startDate)}</TableCell>
              <TableCell className="text-sm">{item.endDate ? formatDate(item.endDate) : "無期限"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={item.isActive ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                  {item.isActive ? "有効" : "無効"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================
// 月別サマリータブ
// ============================================
function MonthlySummaryTab({ items }: { items: MonthlySummary[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-12">直近6ヶ月のデータはありません</p>;
  }
  return (
    <div className="space-y-4">
      {items.map((m) => (
        <Card key={m.month}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between gap-4">
              <span>{m.month}</span>
              <span className="text-base font-bold">承認済み {formatAmount(m.totalAmount)}（{m.count}件）</span>
            </CardTitle>
            {(m.pendingCount > 0 || m.hiddenCount > 0) && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {m.pendingCount > 0 && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    承認待ち {formatAmount(m.pendingAmount)}（{m.pendingCount}件）
                  </Badge>
                )}
                {m.hiddenCount > 0 && (
                  <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                    権限外の機密経費 {m.hiddenCount}件は明細非表示
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border rounded overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>取引先</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>日付</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.counterpartyName}</TableCell>
                      <TableCell className="text-right">{formatAmount(item.amount)}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{item.note ?? "-"}</TableCell>
                      <TableCell className="text-sm">{formatDate(item.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// メインコンポーネント
// ============================================
export function ExpensePageClient({
  formData, mode, backUrl,
  myExpenses, myExpenseDashboard, recurringTransactions, monthlySummary, pendingApprovals,
  showProject = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnedCount = myExpenses.filter((e) => e.status === "returned").length;
  const requestedTab = searchParams.get("tab");
  const defaultTab =
    (requestedTab === "dashboard" && myExpenseDashboard) || requestedTab === "status" || requestedTab === "recurring" || requestedTab === "monthly" || requestedTab === "approvals"
      ? requestedTab
      : pendingApprovals.length > 0
        ? "approvals"
        : "new";
  const handleDashboardMonthChange = (month: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "dashboard");
    params.set("month", month);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="new" className="gap-1">
          <PlusCircle className="h-3.5 w-3.5" />
          新規申請
        </TabsTrigger>
        {myExpenseDashboard && (
          <TabsTrigger value="dashboard" className="gap-1">
            <Wallet className="h-3.5 w-3.5" />
            自分の経費
          </TabsTrigger>
        )}
        <TabsTrigger value="status" className="gap-1">
          <ClipboardList className="h-3.5 w-3.5" />
          自分の申請
          {returnedCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{returnedCount}</Badge>
          )}
          {myExpenses.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">{myExpenses.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="recurring" className="gap-1">
          <Repeat className="h-3.5 w-3.5" />
          サブスク・定期経費
          {recurringTransactions.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">{recurringTransactions.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="monthly" className="gap-1">
          <BarChart3 className="h-3.5 w-3.5" />
          月別サマリー
        </TabsTrigger>
        <TabsTrigger value="approvals" className="gap-1">
          <UserCheck className="h-3.5 w-3.5" />
          承認待ち
          {pendingApprovals.length > 0 ? (
            <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs bg-purple-600">{pendingApprovals.length}</Badge>
          ) : (
            <span className="ml-1 text-xs text-muted-foreground">0</span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="new" className="mt-6">
        <ManualExpenseForm formData={formData} mode={mode} backUrl={backUrl} />
      </TabsContent>

      {myExpenseDashboard && (
        <TabsContent value="dashboard" className="mt-6">
          <MyExpenseDashboardTab dashboard={myExpenseDashboard} onMonthChange={handleDashboardMonthChange} />
        </TabsContent>
      )}

      <TabsContent value="status" className="mt-6">
        <ExpenseStatusTab items={myExpenses} />
      </TabsContent>

      <TabsContent value="recurring" className="mt-6">
        <RecurringTab items={recurringTransactions} showProject={showProject} />
      </TabsContent>

      <TabsContent value="monthly" className="mt-6">
        <MonthlySummaryTab items={monthlySummary} />
      </TabsContent>

      <TabsContent value="approvals" className="mt-6">
        <PendingApprovalsTab items={pendingApprovals} />
      </TabsContent>
    </Tabs>
  );
}
