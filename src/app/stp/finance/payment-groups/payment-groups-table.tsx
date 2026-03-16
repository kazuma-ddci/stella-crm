"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Send, Lock } from "lucide-react";
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
import type { PaymentGroupListItem } from "./actions";
import { submitPaymentGroupToAccounting } from "./actions";
import { toLocalDateString } from "@/lib/utils";
import { CreatePaymentGroupModal } from "./create-payment-group-modal";
import { PaymentGroupDetailModal } from "./payment-group-detail-modal";

type StatusTab =
  | "all"
  | "pending_approval"
  | "before_request"
  | "requested"
  | "invoice_received"
  | "rejected"
  | "confirmed"
  | "awaiting_accounting"
  | "paid";

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "承認待ち",
  before_request: "依頼前",
  requested: "発行依頼済み",
  invoice_received: "請求書受領",
  rejected: "差し戻し",
  re_requested: "再依頼済み",
  confirmed: "確認済み",
  unprocessed: "未処理",
  awaiting_accounting: "経理引渡済み",
  paid: "支払済み",
};

const STATUS_STYLES: Record<string, string> = {
  pending_approval: "bg-amber-100 text-amber-700",
  before_request: "bg-gray-100 text-gray-700",
  requested: "bg-blue-100 text-blue-700",
  invoice_received: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
  re_requested: "bg-indigo-100 text-indigo-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  unprocessed: "bg-orange-100 text-orange-700",
  awaiting_accounting: "bg-purple-100 text-purple-700",
  paid: "bg-green-100 text-green-700",
};

type TabDef = {
  key: StatusTab;
  label: string;
  filter: (row: PaymentGroupListItem) => boolean;
};

const TAB_DEFS: TabDef[] = [
  { key: "all", label: "すべて", filter: () => true },
  {
    key: "pending_approval",
    label: "承認待ち",
    filter: (r) => r.status === "pending_approval",
  },
  {
    key: "before_request",
    label: "依頼前",
    filter: (r) => r.status === "before_request",
  },
  {
    key: "requested",
    label: "依頼済み",
    filter: (r) => r.status === "requested" || r.status === "re_requested",
  },
  {
    key: "invoice_received",
    label: "請求書受領",
    filter: (r) => r.status === "invoice_received",
  },
  {
    key: "rejected",
    label: "差し戻し",
    filter: (r) => r.status === "rejected",
  },
  {
    key: "confirmed",
    label: "確認済み",
    filter: (r) => r.status === "confirmed",
  },
  {
    key: "awaiting_accounting",
    label: "経理引渡済み",
    filter: (r) => r.status === "awaiting_accounting",
  },
  { key: "paid", label: "支払済み", filter: (r) => r.status === "paid" },
];

type SortConfig = {
  field: keyof PaymentGroupListItem;
  direction: "asc" | "desc";
};

type Props = {
  data: PaymentGroupListItem[];
  counterpartyOptions: { value: string; label: string; isStellaCustomer: boolean }[];
  operatingCompanyOptions: { value: string; label: string }[];
  expenseCategories: { id: number; name: string; type: string }[];
  projectId?: number;
  canEditAccounting?: boolean;
};

export function PaymentGroupsTable({
  data,
  counterpartyOptions,
  operatingCompanyOptions,
  expenseCategories,
  projectId,
  canEditAccounting,
}: Props) {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "createdAt",
    direction: "desc",
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] =
    useState<PaymentGroupListItem | null>(null);

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<StatusTab, number>> = {};
    for (const tab of TAB_DEFS) {
      if (tab.key === "all") {
        counts[tab.key] = data.length;
      } else {
        counts[tab.key] = data.filter((row) => tab.filter(row)).length;
      }
    }
    return counts;
  }, [data]);

  const filteredData = useMemo(() => {
    const tab = TAB_DEFS.find((t) => t.key === activeTab) ?? TAB_DEFS[0];
    return data.filter((row) => {
      if (!tab.filter(row)) return false;
      if (
        counterpartyFilter !== "all" &&
        String(row.counterpartyId) !== counterpartyFilter
      )
        return false;
      return true;
    });
  }, [data, activeTab, counterpartyFilter]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const handleSort = (field: keyof PaymentGroupListItem) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortIndicator = (field: keyof PaymentGroupListItem) => {
    if (sortConfig.field !== field) return null;
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">取引先:</label>
            <select
              value={counterpartyFilter}
              onChange={(e) => setCounterpartyFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">すべて</option>
              {counterpartyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          新規作成
        </Button>
      </div>

      {/* タブ */}
      <div className="flex gap-1 border-b">
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {tabCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* テーブル */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-16 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("id")}
              >
                ID{sortIndicator("id")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("counterpartyName")}
              >
                取引先名{sortIndicator("counterpartyName")}
              </TableHead>
              <TableHead>支払元法人</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("paymentDueDate")}
              >
                支払期限{sortIndicator("paymentDueDate")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("expectedPaymentDate")}
              >
                支払予定日{sortIndicator("expectedPaymentDate")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("actualPaymentDate")}
              >
                実際の支払日{sortIndicator("actualPaymentDate")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("totalAmount")}
              >
                金額（税込）{sortIndicator("totalAmount")}
              </TableHead>
              <TableHead className="text-center">明細数</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("createdAt")}
              >
                作成日{sortIndicator("createdAt")}
              </TableHead>
              <TableHead className="sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center py-8 text-muted-foreground"
                >
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row) => (
                <TableRow
                  key={row.id}
                  className="group/row cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedGroup(row)}
                >
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    #{row.id}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      {row.counterpartyName}
                      {row.isConfidential && (
                        <Lock className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.operatingCompanyName}
                  </TableCell>
                  <TableCell className={
                    row.paymentDueDate &&
                    !row.actualPaymentDate &&
                    !["paid"].includes(row.status) &&
                    row.paymentDueDate < toLocalDateString(new Date())
                      ? "text-red-600 font-medium"
                      : ""
                  }>
                    {row.paymentDueDate ?? "-"}
                  </TableCell>
                  <TableCell>{row.expectedPaymentDate ?? "-"}</TableCell>
                  <TableCell>
                    {row.actualPaymentDate
                      ? row.actualPaymentDate
                      : row.status === "paid"
                      ? "—"
                      : <span className="text-orange-600 font-medium">未支払</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {row.totalAmount != null
                      ? `¥${row.totalAmount.toLocaleString()}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.transactionCount}件
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[row.status] ??
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {row.createdAt}
                    {row.createdByName && (
                      <div className="text-xs">作成: {row.createdByName}</div>
                    )}
                  </TableCell>
                  <TableCell
                    className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.status === "confirmed" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                          >
                            <Send className="mr-1 h-3 w-3" />
                            経理へ引渡
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              経理へ引渡しますか？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              「{row.counterpartyName}」の支払を経理部門へ引渡します。按分確定が完了していない取引が含まれている場合はエラーになります。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await submitPaymentGroupToAccounting(row.id);
                                } catch (e) {
                                  alert(
                                    e instanceof Error
                                      ? e.message
                                      : "エラーが発生しました"
                                  );
                                }
                              }}
                            >
                              引渡する
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedGroup(row)}
                      >
                        詳細
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <CreatePaymentGroupModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          counterpartyOptions={counterpartyOptions}
          operatingCompanyOptions={operatingCompanyOptions}
          expenseCategories={expenseCategories}
          projectId={projectId}
        />
      )}

      {/* 詳細モーダル */}
      {selectedGroup && (
        <PaymentGroupDetailModal
          open={!!selectedGroup}
          onClose={() => setSelectedGroup(null)}
          group={selectedGroup}
          counterpartyOptions={counterpartyOptions}
          operatingCompanyOptions={operatingCompanyOptions}
          expenseCategories={expenseCategories}
          canEditAccounting={canEditAccounting}
        />
      )}
    </div>
  );
}
