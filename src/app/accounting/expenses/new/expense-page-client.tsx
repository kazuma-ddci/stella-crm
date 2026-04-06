"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ClipboardList, Repeat, BarChart3, UserCheck } from "lucide-react";
import { ManualExpenseForm } from "./manual-expense-form";
import type {
  ExpenseFormData,
  ExpenseStatusItem,
  RecurringItem,
  MonthlySummary,
} from "./actions";

type Props = {
  formData: ExpenseFormData;
  mode: "accounting" | "project";
  backUrl: string;
  myExpenses: ExpenseStatusItem[];
  recurringTransactions: RecurringItem[];
  monthlySummary: MonthlySummary[];
  pendingApprovals: ExpenseStatusItem[];
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_approval: { label: "承認待ち", className: "bg-purple-100 text-purple-700" },
  awaiting_accounting: { label: "仕訳待ち", className: "bg-yellow-100 text-yellow-700" },
  before_request: { label: "請求前", className: "bg-gray-100 text-gray-700" },
  returned: { label: "差し戻し", className: "bg-red-100 text-red-700" },
  paid: { label: "完了", className: "bg-green-100 text-green-700" },
  confirmed: { label: "確定", className: "bg-blue-100 text-blue-700" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return <Badge variant="outline" className={`${s.className} text-xs`}>{s.label}</Badge>;
}

function formatAmount(n: number | null) {
  if (n == null) return "-";
  return `¥${n.toLocaleString()}`;
}

function formatDate(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
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
// 申請状況タブ
// ============================================
function ExpenseStatusTab({ items }: { items: ExpenseStatusItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-12">申請した経費はまだありません</p>;
  }
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>番号</TableHead>
            <TableHead>取引先</TableHead>
            <TableHead className="text-right">金額</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>承認者</TableHead>
            <TableHead>申請日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">{item.referenceCode ?? `-`}</TableCell>
              <TableCell>
                {item.customCounterpartyName ? (
                  <span>
                    {item.counterpartyName}
                    <Badge variant="outline" className="ml-1 text-xs bg-amber-50 text-amber-700 border-amber-200">手入力</Badge>
                  </span>
                ) : item.counterpartyName}
              </TableCell>
              <TableCell className="text-right">{formatAmount(item.totalAmount)}</TableCell>
              <TableCell><StatusBadge status={item.status} /></TableCell>
              <TableCell className="text-sm">{item.approverName ?? "-"}</TableCell>
              <TableCell className="text-sm">{formatDate(item.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================
// 定期取引タブ
// ============================================
function RecurringTab({ items }: { items: RecurringItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-12">定期取引は登録されていません</p>;
  }
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
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
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{m.month}</span>
              <span className="text-base font-bold">{formatAmount(m.totalAmount)}（{m.count}件）</span>
            </CardTitle>
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
  formData,
  mode,
  backUrl,
  myExpenses,
  recurringTransactions,
  monthlySummary,
  pendingApprovals,
}: Props) {
  const returnedCount = myExpenses.filter((e) => e.status === "returned").length;

  return (
    <Tabs defaultValue="new">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="new" className="gap-1">
          <PlusCircle className="h-3.5 w-3.5" />
          新規申請
        </TabsTrigger>
        <TabsTrigger value="status" className="gap-1">
          <ClipboardList className="h-3.5 w-3.5" />
          申請状況
          {returnedCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{returnedCount}</Badge>
          )}
          {myExpenses.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">{myExpenses.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="recurring" className="gap-1">
          <Repeat className="h-3.5 w-3.5" />
          定期取引
          {recurringTransactions.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">{recurringTransactions.length}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="monthly" className="gap-1">
          <BarChart3 className="h-3.5 w-3.5" />
          月別サマリー
        </TabsTrigger>
        {pendingApprovals.length > 0 && (
          <TabsTrigger value="approvals" className="gap-1">
            <UserCheck className="h-3.5 w-3.5" />
            承認待ち
            <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs bg-purple-600">{pendingApprovals.length}</Badge>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="new" className="mt-6">
        <ManualExpenseForm formData={formData} mode={mode} backUrl={backUrl} />
      </TabsContent>

      <TabsContent value="status" className="mt-6">
        <ExpenseStatusTab items={myExpenses} />
      </TabsContent>

      <TabsContent value="recurring" className="mt-6">
        <RecurringTab items={recurringTransactions} />
      </TabsContent>

      <TabsContent value="monthly" className="mt-6">
        <MonthlySummaryTab items={monthlySummary} />
      </TabsContent>

      {pendingApprovals.length > 0 && (
        <TabsContent value="approvals" className="mt-6">
          <ExpenseStatusTab items={pendingApprovals} />
        </TabsContent>
      )}
    </Tabs>
  );
}
