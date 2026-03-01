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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ArrowRight } from "lucide-react";
import { toLocalDateString } from "@/lib/utils";
import type { InvoiceGroupListItem } from "./actions";
import { submitInvoiceGroupToAccounting, getInvoiceGroupById } from "./actions";
import { CreateInvoiceGroupModal } from "./create-invoice-group-modal";
import { InvoiceGroupDetailModal } from "./invoice-group-detail-modal";

type StatusTab =
  | "all"
  | "draft"
  | "pdf_created"
  | "sent"
  | "awaiting_accounting"
  | "paid"
  | "corrected";

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  pdf_created: "PDF作成済み",
  sent: "送付済み",
  awaiting_accounting: "経理処理待ち",
  partially_paid: "一部入金",
  paid: "入金完了",
  returned: "差し戻し",
  corrected: "訂正済み",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pdf_created: "bg-blue-100 text-blue-700",
  sent: "bg-indigo-100 text-indigo-700",
  awaiting_accounting: "bg-yellow-100 text-yellow-700",
  partially_paid: "bg-orange-100 text-orange-700",
  paid: "bg-emerald-100 text-emerald-700",
  returned: "bg-red-100 text-red-700",
  corrected: "bg-purple-100 text-purple-700",
};

const CORRECTION_LABELS: Record<string, string> = {
  replacement: "差し替え",
  additional: "追加請求",
};

const tabs: {
  key: StatusTab;
  label: string;
  filter: (row: InvoiceGroupListItem) => boolean;
}[] = [
  { key: "all", label: "すべて", filter: () => true },
  { key: "draft", label: "下書き", filter: (r) => r.status === "draft" },
  {
    key: "pdf_created",
    label: "PDF作成済み",
    filter: (r) => r.status === "pdf_created",
  },
  { key: "sent", label: "送付済み", filter: (r) => r.status === "sent" },
  {
    key: "awaiting_accounting",
    label: "経理処理待ち",
    filter: (r) => r.status === "awaiting_accounting",
  },
  {
    key: "paid",
    label: "入金完了",
    filter: (r) => r.status === "paid" || r.status === "partially_paid",
  },
  {
    key: "corrected",
    label: "訂正済み",
    filter: (r) => r.status === "corrected",
  },
];

type SortConfig = {
  field: keyof InvoiceGroupListItem;
  direction: "asc" | "desc";
};

type Props = {
  data: InvoiceGroupListItem[];
  counterpartyOptions: { value: string; label: string; isStellaCustomer: boolean }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
  defaultBankAccountByCompany: Record<string, string>;
  expenseCategories: { id: number; name: string; type: string }[];
  projectId?: number;
};

export function InvoiceGroupsTable({
  data,
  counterpartyOptions,
  operatingCompanyOptions,
  bankAccountsByCompany,
  defaultBankAccountByCompany,
  expenseCategories,
  projectId,
}: Props) {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "createdAt",
    direction: "desc",
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] =
    useState<InvoiceGroupListItem | null>(null);
  const [submitToAccountingTarget, setSubmitToAccountingTarget] =
    useState<InvoiceGroupListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleInvoiceCreated = async (groupId: number) => {
    const group = await getInvoiceGroupById(groupId);
    if (group) {
      setSelectedGroup(group);
    }
  };

  const handleSubmitToAccounting = async () => {
    if (!submitToAccountingTarget) return;
    setSubmitting(true);
    try {
      await submitInvoiceGroupToAccounting(submitToAccountingTarget.id);
      setSubmitToAccountingTarget(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      all: data.length,
      draft: 0,
      pdf_created: 0,
      sent: 0,
      awaiting_accounting: 0,
      paid: 0,
      corrected: 0,
    };
    for (const row of data) {
      for (const tab of tabs) {
        if (tab.key !== "all" && tab.filter(row)) {
          counts[tab.key]++;
        }
      }
    }
    return counts;
  }, [data]);

  const filteredData = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab)!;
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

  const handleSort = (field: keyof InvoiceGroupListItem) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortIndicator = (field: keyof InvoiceGroupListItem) => {
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
        {tabs.map((tab) => (
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
              {tabCounts[tab.key]}
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
                onClick={() => handleSort("invoiceNumber")}
              >
                請求書番号{sortIndicator("invoiceNumber")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("counterpartyName")}
              >
                取引先{sortIndicator("counterpartyName")}
              </TableHead>
              <TableHead>請求元</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("invoiceDate")}
              >
                請求日{sortIndicator("invoiceDate")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("paymentDueDate")}
              >
                入金期限{sortIndicator("paymentDueDate")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("expectedPaymentDate")}
              >
                入金予定日{sortIndicator("expectedPaymentDate")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("actualPaymentDate")}
              >
                実際の入金日{sortIndicator("actualPaymentDate")}
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
                  colSpan={13}
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
                  <TableCell className="font-mono text-sm">
                    {row.invoiceNumber || (
                      <span className="text-muted-foreground">未採番</span>
                    )}
                    {row.correctionType && (
                      <span className="ml-1 text-xs text-purple-600">
                        ({CORRECTION_LABELS[row.correctionType]})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{row.counterpartyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.operatingCompanyName}
                  </TableCell>
                  <TableCell>{row.invoiceDate ?? "-"}</TableCell>
                  <TableCell className={
                    row.paymentDueDate &&
                    !row.actualPaymentDate &&
                    !["paid", "corrected"].includes(row.status) &&
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
                      : ["paid", "corrected"].includes(row.status)
                      ? "—"
                      : <span className="text-orange-600 font-medium">未入金</span>}
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
                        STATUS_STYLES[row.status] ?? "bg-gray-100 text-gray-700"
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedGroup(row)}
                      >
                        詳細
                      </Button>
                      {row.status === "sent" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSubmitToAccountingTarget(row)}
                        >
                          <ArrowRight className="mr-1 h-3 w-3" />
                          経理へ引渡
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <CreateInvoiceGroupModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          counterpartyOptions={counterpartyOptions}
          operatingCompanyOptions={operatingCompanyOptions}
          bankAccountsByCompany={bankAccountsByCompany}
          defaultBankAccountByCompany={defaultBankAccountByCompany}
          expenseCategories={expenseCategories}
          projectId={projectId}
          onCreated={handleInvoiceCreated}
        />
      )}

      {/* 詳細モーダル */}
      {selectedGroup && (
        <InvoiceGroupDetailModal
          open={!!selectedGroup}
          onClose={() => setSelectedGroup(null)}
          group={selectedGroup}
          counterpartyOptions={counterpartyOptions}
          operatingCompanyOptions={operatingCompanyOptions}
          bankAccountsByCompany={bankAccountsByCompany}
          expenseCategories={expenseCategories}
          projectId={projectId}
        />
      )}

      {/* 経理引渡確認ダイアログ */}
      <AlertDialog
        open={!!submitToAccountingTarget}
        onOpenChange={(open) => {
          if (!open) setSubmitToAccountingTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>経理へ引き渡しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              請求（{submitToAccountingTarget?.invoiceNumber ?? `#${submitToAccountingTarget?.id}`}）を経理処理待ちに変更します。
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitToAccounting} disabled={submitting}>
              引き渡す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
