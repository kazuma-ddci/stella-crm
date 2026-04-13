"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { PlusCircle, ClipboardList, Repeat, BarChart3, UserCheck, Eye } from "lucide-react";
import { ManualExpenseForm } from "./manual-expense-form";
import {
  approveByProjectApprover,
  rejectByProjectApprover,
  type ExpenseFormData,
  type ExpenseStatusItem,
  type RecurringItem,
  type MonthlySummary,
} from "./actions";

type Props = {
  formData: ExpenseFormData;
  mode: "accounting" | "project";
  backUrl: string;
  myExpenses: ExpenseStatusItem[];
  recurringTransactions: RecurringItem[];
  monthlySummary: MonthlySummary[];
  pendingApprovals: ExpenseStatusItem[];
  showProject?: boolean; // 定期取引でプロジェクト名を表示するか
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_project_approval: { label: "承認者確認待ち", className: "bg-purple-100 text-purple-700" },
  pending_accounting_approval: { label: "経理確認待ち", className: "bg-yellow-100 text-yellow-700" },
  awaiting_accounting: { label: "仕訳待ち", className: "bg-blue-100 text-blue-700" },
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

function formatDate(d: Date | string | null) {
  if (!d) return "-";
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
// プレビューモーダル
// ============================================
function ExpensePreviewModal({ item, open, onClose }: { item: ExpenseStatusItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>経費申請詳細 {item.referenceCode ?? ""}</DialogTitle>
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

// ============================================
// 申請状況タブ
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
// 定期取引タブ
// ============================================
function RecurringTab({ items, showProject = false }: { items: RecurringItem[]; showProject?: boolean }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-12">定期取引は登録されていません</p>;
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
  formData, mode, backUrl,
  myExpenses, recurringTransactions, monthlySummary, pendingApprovals,
  showProject = false,
}: Props) {
  const returnedCount = myExpenses.filter((e) => e.status === "returned").length;

  return (
    <Tabs defaultValue={pendingApprovals.length > 0 ? "approvals" : "new"}>
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
        <RecurringTab items={recurringTransactions} showProject={showProject} />
      </TabsContent>

      <TabsContent value="monthly" className="mt-6">
        <MonthlySummaryTab items={monthlySummary} />
      </TabsContent>

      {pendingApprovals.length > 0 && (
        <TabsContent value="approvals" className="mt-6">
          <PendingApprovalsTab items={pendingApprovals} />
        </TabsContent>
      )}
    </Tabs>
  );
}
