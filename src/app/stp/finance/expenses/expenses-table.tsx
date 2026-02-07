"use client";

import { useState, useMemo, useCallback } from "react";
import { CrudTable, ColumnDef, InlineEditConfig } from "@/components/crud-table";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { AutoEditReasonDialog, AmountMismatchDialog, SourceDataChangeDialog } from "@/components/finance-edit-dialog";
import { useRouter } from "next/navigation";
import {
  addExpenseRecord,
  updateExpenseRecord,
  deleteExpenseRecord,
  logExpenseEdit,
  applyLatestExpenseAmount,
  dismissExpenseSourceChange,
} from "./actions";
import { CompanyCodeLabel } from "@/components/company-code-label";

type Props = {
  data: Record<string, unknown>[];
  agentOptions: { value: string; label: string }[];
  stpCompanyOptions: { value: string; label: string }[];
};

const expenseTypeOptions = [
  { value: "agent_initial", label: "代理店初期費用" },
  { value: "agent_monthly", label: "代理店月額費用" },
  { value: "commission_initial", label: "初期費用紹介報酬" },
  { value: "commission_performance", label: "成果報酬紹介報酬" },
  { value: "commission_monthly", label: "月額紹介報酬" },
];

const statusOptions = [
  { value: "pending", label: "未承認" },
  { value: "approved", label: "承認済" },
  { value: "paid", label: "支払済" },
  { value: "cancelled", label: "取消" },
];

const accountingStatusOptions = [
  { value: "unprocessed", label: "未処理" },
  { value: "processing", label: "処理中" },
  { value: "processed", label: "処理済" },
  { value: "skipped", label: "対象外" },
];

const taxTypeOptions = [
  { value: "tax_included", label: "内税" },
  { value: "tax_excluded", label: "外税" },
];

const taxRateOptions = [
  { value: "10", label: "10%" },
  { value: "8", label: "8%" },
  { value: "0", label: "0%(非課税)" },
];

type StatusTab = "all" | "pending" | "approved" | "paid" | "needs_review";

const tabs: { key: StatusTab; label: string; filter: (row: Record<string, unknown>) => boolean }[] = [
  { key: "all", label: "すべて", filter: () => true },
  { key: "needs_review", label: "要確認", filter: (r) => r.sourceDataChangedAt != null },
  { key: "pending", label: "未承認", filter: (r) => r.status === "pending" },
  { key: "approved", label: "承認済", filter: (r) => r.status === "approved" },
  { key: "paid", label: "支払済", filter: (r) => r.status === "paid" },
];

// グループキー: 代理店×月
function groupKey(row: Record<string, unknown>): string {
  const agentId = row.agentId as string;
  const month = (row.targetMonth as string)?.slice(0, 7) || "unknown";
  return `${agentId}__${month}`;
}

type GroupInfo = {
  key: string;
  agentId: string;
  agentDisplay: string;
  targetMonth: string;
  records: Record<string, unknown>[];
  totalAmount: number;
};

function calcDisplayAmount(row: Record<string, unknown>): number {
  const amount = Number(row.expectedAmount ?? 0);
  const taxType = (row.taxType as string) || "tax_included";
  const taxAmount = Number(row.taxAmount ?? 0);
  return taxType === "tax_excluded" ? amount + taxAmount : amount;
}

export function ExpensesTable({
  data,
  agentOptions,
  stpCompanyOptions,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // データから一意な対象年月リストを抽出（降順）
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    for (const row of data) {
      const tm = row.targetMonth as string | null;
      if (tm) months.add(tm.slice(0, 7));
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [data]);

  // 年月フィルタを適用したデータ
  const monthFilteredData = useMemo(() => {
    if (activeMonth === "all") return data;
    return data.filter((row) => {
      const tm = row.targetMonth as string | null;
      return tm ? tm.startsWith(activeMonth) : false;
    });
  }, [data, activeMonth]);

  // タブ別件数
  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      all: monthFilteredData.length,
      needs_review: 0,
      pending: 0,
      approved: 0,
      paid: 0,
    };
    for (const row of monthFilteredData) {
      const status = row.status as string;
      if (status === "pending") counts.pending++;
      else if (status === "approved") counts.approved++;
      else if (status === "paid") counts.paid++;
      if (row.sourceDataChangedAt != null) counts.needs_review++;
    }
    return counts;
  }, [monthFilteredData]);

  // フィルタリング
  const filteredData = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab)!;
    return monthFilteredData.filter(tab.filter);
  }, [monthFilteredData, activeTab]);

  // グルーピング（代理店×月）
  const groups = useMemo(() => {
    const map = new Map<string, GroupInfo>();
    for (const row of filteredData) {
      const key = groupKey(row);
      if (!map.has(key)) {
        map.set(key, {
          key,
          agentId: row.agentId as string,
          agentDisplay: row.agentDisplay as string,
          targetMonth: (row.targetMonth as string)?.slice(0, 7) || "",
          records: [],
          totalAmount: 0,
        });
      }
      const group = map.get(key)!;
      group.records.push(row);
      group.totalAmount += calcDisplayAmount(row);
    }
    // 月降順 → 代理店ID昇順（localeCompareは日本語でサーバー/クライアント間で結果が異なるためIDで比較）
    return Array.from(map.values()).sort((a, b) => {
      const monthCmp = b.targetMonth.localeCompare(a.targetMonth);
      if (monthCmp !== 0) return monthCmp;
      return Number(a.agentId) - Number(b.agentId);
    });
  }, [filteredData]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groups.map((g) => g.key)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  // 元データ変更確認ダイアログ
  const [sourceChangeDialog, setSourceChangeDialog] = useState<{
    id: number;
    currentAmount: number;
    latestAmount: number;
    changedAt: string;
  } | null>(null);

  // 自動生成レコード編集時の警告ダイアログ
  const [autoEditDialog, setAutoEditDialog] = useState<{
    id: number;
    fieldName: string;
    oldValue: string;
    newValue: string;
    updateData: Record<string, unknown>;
  } | null>(null);

  // 金額不一致ダイアログ
  const [mismatchDialog, setMismatchDialog] = useState<{
    id: number;
    expectedAmount: number;
    paidAmount: number;
    updateData: Record<string, unknown>;
  } | null>(null);

  const criticalFields = ["agentId", "stpCompanyId", "expenseType", "expectedAmount"];

  const fieldLabels: Record<string, string> = {
    agentId: "代理店",
    stpCompanyId: "対象企業",
    expenseType: "経費種別",
    expectedAmount: "支払予定額",
  };

  const formatFieldValue = useCallback((key: string, value: unknown): string => {
    if (value == null) return "-";
    if (key === "agentId") {
      const opt = agentOptions.find((o) => o.value === String(value));
      return opt?.label || String(value);
    }
    if (key === "stpCompanyId") {
      const opt = stpCompanyOptions.find((o) => o.value === String(value));
      return opt?.label || String(value);
    }
    if (key === "expenseType") {
      const map: Record<string, string> = {
        agent_initial: "代理店初期費用", agent_monthly: "代理店月額費用",
        commission_initial: "初期費用紹介報酬", commission_performance: "成果報酬紹介報酬",
        commission_monthly: "月額紹介報酬",
      };
      return map[value as string] || String(value);
    }
    if (key === "expectedAmount") return `¥${Number(value).toLocaleString()}`;
    return String(value);
  }, [agentOptions, stpCompanyOptions]);

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    const row = data.find((r) => r.id === id);
    if (!row) {
      await updateExpenseRecord(id, formData);
      return;
    }

    if (row.isAutoGenerated) {
      for (const field of criticalFields) {
        if (field in formData) {
          const oldVal = row[field];
          const newVal = formData[field];
          if (String(oldVal) !== String(newVal)) {
            setAutoEditDialog({
              id,
              fieldName: fieldLabels[field] || field,
              oldValue: formatFieldValue(field, oldVal),
              newValue: formatFieldValue(field, newVal),
              updateData: formData,
            });
            return;
          }
        }
      }
    }

    if ("paidAmount" in formData && formData.paidAmount != null) {
      const expectedAmount = Number(row.expectedAmount);
      const paidAmount = Number(formData.paidAmount);
      if (paidAmount !== expectedAmount && paidAmount > 0) {
        setMismatchDialog({
          id,
          expectedAmount,
          paidAmount,
          updateData: formData,
        });
        return;
      }
    }

    await updateExpenseRecord(id, formData);
  };

  // グループ内テーブル用のカラム定義（代理店カラムは非表示）
  const groupColumns: ColumnDef[] = [
    { key: "id", header: "ID", type: "number", editable: false },
    {
      key: "stpCompanyId",
      header: "対象企業",
      type: "select",
      options: stpCompanyOptions,
      searchable: true,
    },
    {
      key: "expenseType",
      header: "経費種別",
      type: "select",
      options: expenseTypeOptions,
      required: true,
    },
    {
      key: "expectedAmount",
      header: "支払予定額",
      type: "number",
      currency: true,
      required: true,
    },
    {
      key: "taxType",
      header: "税区分",
      type: "select",
      options: taxTypeOptions,
      defaultValue: "tax_included",
    },
    {
      key: "taxRate",
      header: "税率",
      type: "select",
      options: taxRateOptions,
      defaultValue: "10",
    },
    {
      key: "status",
      header: "ステータス",
      type: "select",
      options: statusOptions,
    },
    {
      key: "accountingStatus",
      header: "会計処理",
      type: "select",
      options: accountingStatusOptions,
    },
    { key: "isWithholdingTarget", header: "源泉対象", type: "text", editable: false },
    { key: "withholdingTaxAmount", header: "源泉税額", type: "number", editable: false },
    { key: "netPaymentAmount", header: "差引支払額", type: "number", editable: false },
    { key: "appliedCommissionRate", header: "適用報酬率", type: "text", editable: false },
    { key: "allocatedAmount", header: "消込状況", type: "text", editable: false },
    { key: "approvedDate", header: "承認日", type: "date" },
    { key: "paidDate", header: "支払日", type: "date" },
    { key: "paidAmount", header: "支払額", type: "number", currency: true },
    { key: "note", header: "備考", type: "textarea" },
  ];

  // 新規追加用カラム（代理店・対象年月含む）
  const addColumns: ColumnDef[] = [
    { key: "id", header: "ID", type: "number", editable: false },
    {
      key: "agentId",
      header: "代理店",
      type: "select",
      options: agentOptions,
      searchable: true,
      required: true,
    },
    {
      key: "stpCompanyId",
      header: "対象企業",
      type: "select",
      options: stpCompanyOptions,
      searchable: true,
    },
    {
      key: "expenseType",
      header: "経費種別",
      type: "select",
      options: expenseTypeOptions,
      required: true,
    },
    {
      key: "targetMonth",
      header: "対象年月",
      type: "month",
      required: true,
    },
    {
      key: "expectedAmount",
      header: "支払予定額",
      type: "number",
      currency: true,
      required: true,
    },
    {
      key: "taxType",
      header: "税区分",
      type: "select",
      options: taxTypeOptions,
      defaultValue: "tax_included",
    },
    {
      key: "taxRate",
      header: "税率",
      type: "select",
      options: taxRateOptions,
      defaultValue: "10",
    },
    {
      key: "status",
      header: "ステータス",
      type: "select",
      options: statusOptions,
    },
    {
      key: "accountingStatus",
      header: "会計処理",
      type: "select",
      options: accountingStatusOptions,
    },
    { key: "approvedDate", header: "承認日", type: "date" },
    { key: "paidDate", header: "支払日", type: "date" },
    { key: "paidAmount", header: "支払額", type: "number", currency: true },
    { key: "note", header: "備考", type: "textarea" },
  ];

  const inlineEditConfig: InlineEditConfig = {
    columns: [
      "stpCompanyId",
      "expenseType",
      "expectedAmount",
      "taxType",
      "taxRate",
      "status",
      "accountingStatus",
      "approvedDate",
      "paidDate",
      "paidAmount",
    ],
    displayToEditMapping: {
      stpCompanyDisplay: "stpCompanyId",
    },
    getOptions: (_row, columnKey) => {
      if (columnKey === "stpCompanyId") return stpCompanyOptions;
      if (columnKey === "expenseType") return expenseTypeOptions;
      if (columnKey === "status") return statusOptions;
      if (columnKey === "accountingStatus") return accountingStatusOptions;
      if (columnKey === "taxType") return taxTypeOptions;
      if (columnKey === "taxRate") return taxRateOptions;
      return [];
    },
  };

  const customRenderers = {
    stpCompanyId: (_value: unknown, row: Record<string, unknown>) => {
      const code = row.stpCompanyCode as string | null;
      const name = row.stpCompanyDisplay as string | null;
      if (!code || !name) return "-";
      return <CompanyCodeLabel code={code} name={name} />;
    },
    expenseType: (value: unknown) => {
      const map: Record<string, string> = {
        agent_initial: "代理店初期費用",
        agent_monthly: "代理店月額費用",
        commission_initial: "初期費用紹介報酬",
        commission_performance: "成果報酬紹介報酬",
        commission_monthly: "月額紹介報酬",
      };
      return map[value as string] || "-";
    },
    expectedAmount: (value: unknown, row: Record<string, unknown>) => {
      if (value == null) return "-";
      const amount = Number(value);
      const taxType = (row.taxType as string) || "tax_included";
      const taxRate = Number(row.taxRate ?? 10);
      const taxAmount = Number(row.taxAmount ?? 0);
      const hasSourceChange = row.sourceDataChangedAt != null;
      const latestCalc = row.latestCalculatedAmount as number | null;

      const taxInfo = taxType === "tax_excluded"
        ? <div className="text-xs text-muted-foreground">(税抜¥{amount.toLocaleString()} + {taxRate}% ¥{taxAmount.toLocaleString()})</div>
        : <div className="text-xs text-muted-foreground">(内{taxRate}% ¥{taxAmount.toLocaleString()})</div>;

      const displayAmount = taxType === "tax_excluded" ? amount + taxAmount : amount;

      return (
        <div className="text-right">
          <div className="font-medium">¥{displayAmount.toLocaleString()}</div>
          {taxInfo}
          {hasSourceChange && latestCalc != null && (
            <button
              onClick={() =>
                setSourceChangeDialog({
                  id: row.id as number,
                  currentAmount: amount,
                  latestAmount: latestCalc,
                  changedAt: row.sourceDataChangedAt as string,
                })
              }
              className="text-xs text-orange-600 flex items-center gap-1 ml-auto hover:underline"
            >
              <span>⚠</span> 最新: ¥{latestCalc.toLocaleString()}
            </button>
          )}
        </div>
      );
    },
    taxType: (value: unknown) => {
      const labels: Record<string, string> = {
        tax_included: "内税",
        tax_excluded: "外税",
      };
      return labels[value as string] || "-";
    },
    taxRate: (value: unknown) => {
      return value != null ? `${value}%` : "-";
    },
    paidAmount: (value: unknown) => {
      return value != null
        ? `¥${Number(value).toLocaleString()}`
        : "-";
    },
    status: (value: unknown) => {
      const styles: Record<string, string> = {
        pending: "bg-gray-100 text-gray-700",
        approved: "bg-blue-100 text-blue-700",
        paid: "bg-green-100 text-green-700",
        cancelled: "bg-gray-100 text-gray-500",
      };
      const labels: Record<string, string> = {
        pending: "未承認",
        approved: "承認済",
        paid: "支払済",
        cancelled: "取消",
      };
      const cls = styles[value as string] || "bg-gray-100 text-gray-700";
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
        >
          {labels[value as string] || (value as string) || "-"}
        </span>
      );
    },
    accountingStatus: (value: unknown) => {
      const styles: Record<string, string> = {
        unprocessed: "bg-gray-100 text-gray-700",
        processing: "bg-blue-100 text-blue-700",
        processed: "bg-green-100 text-green-700",
        skipped: "bg-gray-100 text-gray-500",
      };
      const labels: Record<string, string> = {
        unprocessed: "未処理",
        processing: "処理中",
        processed: "処理済",
        skipped: "対象外",
      };
      const cls = styles[value as string] || "bg-gray-100 text-gray-700";
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
        >
          {labels[value as string] || (value as string) || "-"}
        </span>
      );
    },
    isWithholdingTarget: (value: unknown) => {
      if (value === true) {
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
            対象
          </span>
        );
      }
      return <span className="text-muted-foreground">-</span>;
    },
    withholdingTaxAmount: (value: unknown) => {
      return value != null
        ? `¥${Number(value).toLocaleString()}`
        : "-";
    },
    netPaymentAmount: (value: unknown) => {
      return value != null
        ? `¥${Number(value).toLocaleString()}`
        : "-";
    },
    appliedCommissionRate: (value: unknown, row: Record<string, unknown>) => {
      const type = row.appliedCommissionType as string | null;
      if (value == null && !type) return "-";
      if (type === "fixed") {
        return "固定額";
      }
      return value != null ? `${Number(value)}%` : "-";
    },
    allocatedAmount: (_value: unknown, row: Record<string, unknown>) => {
      const totalAllocated = Number(row.totalAllocated ?? 0);
      const expectedAmount = Number(row.expectedAmount ?? 0);
      const taxType = (row.taxType as string) || "tax_included";
      const taxAmount = Number(row.taxAmount ?? 0);
      const displayAmount = taxType === "tax_excluded" ? expectedAmount + taxAmount : expectedAmount;

      if (totalAllocated === 0) {
        return <span className="text-xs text-muted-foreground">未配分</span>;
      }
      if (totalAllocated >= displayAmount) {
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            全額配分済
          </span>
        );
      }
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
          ¥{totalAllocated.toLocaleString()} / ¥{displayAmount.toLocaleString()}
        </span>
      );
    },
    note: (value: unknown, row: Record<string, unknown>) => {
      return (
        <TextPreviewCell
          text={value as string | null}
          title="備考"
          onEdit={async (newValue) => {
            await updateExpenseRecord(row.id as number, {
              note: newValue,
            });
            router.refresh();
          }}
        />
      );
    },
  };

  // グループのステータスサマリー
  const getGroupStatusSummary = (group: GroupInfo) => {
    const statuses: Record<string, number> = {};
    for (const r of group.records) {
      const s = r.status as string;
      statuses[s] = (statuses[s] || 0) + 1;
    }
    return statuses;
  };

  return (
    <div className="space-y-4">
      {/* ステータスタブ */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const isNeedsReview = tab.key === "needs_review";
          const hasItems = tabCounts[tab.key] > 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? isNeedsReview
                    ? "border-orange-500 text-orange-600"
                    : "border-primary text-primary"
                  : isNeedsReview && hasItems
                    ? "border-transparent text-orange-600 hover:border-orange-300"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs font-normal ${
                isNeedsReview && hasItems ? "text-orange-500" : "text-muted-foreground"
              }`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 対象年月フィルタ + 展開/折りたたみ */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">対象年月:</label>
          <select
            value={activeMonth}
            onChange={(e) => setActiveMonth(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">すべて</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"
          >
            すべて展開
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"
          >
            すべて折りたたみ
          </button>
        </div>
      </div>

      {/* グルーピング表示 */}
      <div className="space-y-2">
        {groups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            データがありません
          </div>
        )}
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.key);
          const statusSummary = getGroupStatusSummary(group);
          const statusLabels: Record<string, string> = {
            pending: "未承認",
            approved: "承認済",
            paid: "支払済",
            cancelled: "取消",
          };
          const statusColors: Record<string, string> = {
            pending: "text-gray-600",
            approved: "text-blue-600",
            paid: "text-green-600",
            cancelled: "text-gray-400",
          };

          return (
            <div key={group.key} className="border rounded-lg overflow-hidden">
              {/* グループヘッダー */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => toggleGroup(group.key)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-4">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {group.targetMonth}
                  </span>
                  <span className="font-medium">
                    {group.agentDisplay}
                  </span>
                  <span className="text-sm font-bold">
                    ¥{group.totalAmount.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({group.records.length}件)
                  </span>
                  {/* ステータスサマリー */}
                  <div className="flex items-center gap-2">
                    {Object.entries(statusSummary).map(([status, count]) => (
                      <span
                        key={status}
                        className={`text-xs ${statusColors[status] || "text-gray-500"}`}
                      >
                        {statusLabels[status] || status}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* グループ内テーブル */}
              {isExpanded && (
                <div className="p-2">
                  <CrudTable
                    data={group.records}
                    columns={groupColumns}
                    onAdd={async (formData) => {
                      await addExpenseRecord({
                        ...formData,
                        agentId: group.agentId,
                        targetMonth: group.targetMonth + "-01",
                      });
                    }}
                    onUpdate={handleUpdate}
                    onDelete={async (id) => {
                      await deleteExpenseRecord(id);
                    }}
                    enableInlineEdit={true}
                    inlineEditConfig={inlineEditConfig}
                    customRenderers={customRenderers}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 新規追加（グループ外）*/}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">新規経費レコード追加</h3>
        <CrudTable
          data={[]}
          columns={addColumns}
          onAdd={async (formData) => {
            await addExpenseRecord(formData);
          }}
          enableInlineEdit={false}
          customRenderers={{}}
        />
      </div>

      {/* 自動生成レコード編集時の理由入力ダイアログ */}
      <AutoEditReasonDialog
        open={!!autoEditDialog}
        fieldName={autoEditDialog?.fieldName || ""}
        oldValue={autoEditDialog?.oldValue || ""}
        newValue={autoEditDialog?.newValue || ""}
        onConfirm={async (reason) => {
          if (autoEditDialog) {
            await updateExpenseRecord(autoEditDialog.id, autoEditDialog.updateData);
            await logExpenseEdit({
              expenseRecordId: autoEditDialog.id,
              editType: "field_change",
              fieldName: autoEditDialog.fieldName,
              oldValue: autoEditDialog.oldValue,
              newValue: autoEditDialog.newValue,
              reason,
            });
            router.refresh();
          }
          setAutoEditDialog(null);
        }}
        onCancel={() => setAutoEditDialog(null)}
      />

      {/* 金額不一致ダイアログ */}
      <AmountMismatchDialog
        open={!!mismatchDialog}
        expectedAmount={mismatchDialog?.expectedAmount || 0}
        paidAmount={mismatchDialog?.paidAmount || 0}
        recordType="expense"
        onConfirm={async (paymentStatus, reason) => {
          if (mismatchDialog) {
            await updateExpenseRecord(mismatchDialog.id, {
              ...mismatchDialog.updateData,
              paymentStatus,
            });
            await logExpenseEdit({
              expenseRecordId: mismatchDialog.id,
              editType: "amount_mismatch",
              fieldName: "paidAmount",
              oldValue: `¥${mismatchDialog.expectedAmount.toLocaleString()}（支払予定額）`,
              newValue: `¥${mismatchDialog.paidAmount.toLocaleString()}（支払額）`,
              reason: `${paymentStatus === "partial" ? "一部支払" : "金額相違あり"}${reason ? `: ${reason}` : ""}`,
            });
            router.refresh();
          }
          setMismatchDialog(null);
        }}
        onCancel={() => setMismatchDialog(null)}
      />

      {/* 元データ変更確認ダイアログ */}
      <SourceDataChangeDialog
        open={!!sourceChangeDialog}
        currentAmount={sourceChangeDialog?.currentAmount || 0}
        latestAmount={sourceChangeDialog?.latestAmount || 0}
        changedAt={sourceChangeDialog?.changedAt || ""}
        onApply={async () => {
          if (sourceChangeDialog) {
            await applyLatestExpenseAmount(sourceChangeDialog.id);
            router.refresh();
          }
          setSourceChangeDialog(null);
        }}
        onDismiss={async () => {
          if (sourceChangeDialog) {
            await dismissExpenseSourceChange(sourceChangeDialog.id);
            router.refresh();
          }
          setSourceChangeDialog(null);
        }}
        onCancel={() => setSourceChangeDialog(null)}
      />
    </div>
  );
}
