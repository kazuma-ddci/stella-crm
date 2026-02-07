"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { CrudTable, ColumnDef, InlineEditConfig } from "@/components/crud-table";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { AutoEditReasonDialog, AmountMismatchDialog, SourceDataChangeDialog } from "@/components/finance-edit-dialog";
import { useRouter } from "next/navigation";
import {
  addRevenueRecord,
  updateRevenueRecord,
  deleteRevenueRecord,
  createInvoiceFromRevenue,
  createBatchInvoice,
  updateInvoiceFromRevenue,
  logRevenueEdit,
  applyLatestRevenueAmount,
  dismissRevenueSourceChange,
} from "./actions";
import { CompanyCodeLabel } from "@/components/company-code-label";

type Props = {
  data: Record<string, unknown>[];
  stpCompanyOptions: { value: string; label: string }[];
  contractHistoryOptions: { value: string; label: string }[];
  candidateOptions: { value: string; label: string }[];
};

const revenueTypeOptions = [
  { value: "initial", label: "初期費用" },
  { value: "monthly", label: "月額費用" },
  { value: "performance", label: "成果報酬" },
];

const statusOptions = [
  { value: "pending", label: "未請求" },
  { value: "approved", label: "承認済" },
  { value: "invoiced", label: "請求済" },
  { value: "paid", label: "入金済" },
  { value: "overdue", label: "未入金(期限超過)" },
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

type StatusTab = "all" | "pending" | "approved" | "invoiced" | "overdue" | "paid" | "needs_review";

const tabs: { key: StatusTab; label: string; filter: (row: Record<string, unknown>) => boolean }[] = [
  { key: "all", label: "すべて", filter: () => true },
  { key: "needs_review", label: "要確認", filter: (r) => r.sourceDataChangedAt != null },
  { key: "pending", label: "未請求", filter: (r) => r.status === "pending" },
  { key: "approved", label: "承認済", filter: (r) => r.status === "approved" },
  { key: "invoiced", label: "請求済", filter: (r) => r.status === "invoiced" },
  { key: "overdue", label: "期限超過", filter: (r) => r.status === "overdue" },
  { key: "paid", label: "入金済", filter: (r) => r.status === "paid" },
];

// グループキー生成
function groupKey(row: Record<string, unknown>): string {
  const companyId = row.stpCompanyId as string;
  const month = (row.targetMonth as string)?.slice(0, 7) || "unknown";
  return `${companyId}__${month}`;
}

// グループ情報の型
type GroupInfo = {
  key: string;
  stpCompanyId: string;
  stpCompanyCode: string;
  stpCompanyDisplay: string;
  targetMonth: string;
  records: Record<string, unknown>[];
  totalAmount: number;
  uninvoicedCount: number;
  hasInvoice: boolean;
};

function calcDisplayAmount(row: Record<string, unknown>): number {
  const amount = Number(row.expectedAmount ?? 0);
  const taxType = (row.taxType as string) || "tax_included";
  const taxAmount = Number(row.taxAmount ?? 0);
  return taxType === "tax_excluded" ? amount + taxAmount : amount;
}

export function RevenueTable({
  data,
  stpCompanyOptions,
  contractHistoryOptions,
  candidateOptions,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [creatingInvoice, setCreatingInvoice] = useState<number | null>(null);
  const [creatingBatchInvoice, setCreatingBatchInvoice] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      invoiced: 0,
      overdue: 0,
      paid: 0,
    };
    for (const row of monthFilteredData) {
      const status = row.status as string;
      if (status === "pending") counts.pending++;
      else if (status === "approved") counts.approved++;
      else if (status === "invoiced") counts.invoiced++;
      else if (status === "overdue") counts.overdue++;
      else if (status === "paid") counts.paid++;
      if (row.sourceDataChangedAt != null) counts.needs_review++;
    }
    return counts;
  }, [monthFilteredData]);

  // フィルタリング
  const filteredData = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab)!;
    const filtered = monthFilteredData.filter(tab.filter);
    return filtered.sort((a, b) => {
      const aOverdue = a.status === "overdue" ? 0 : 1;
      const bOverdue = b.status === "overdue" ? 0 : 1;
      return aOverdue - bOverdue;
    });
  }, [monthFilteredData, activeTab]);

  // グルーピング（企業×月）
  const groups = useMemo(() => {
    const map = new Map<string, GroupInfo>();
    for (const row of filteredData) {
      const key = groupKey(row);
      if (!map.has(key)) {
        map.set(key, {
          key,
          stpCompanyId: row.stpCompanyId as string,
          stpCompanyCode: row.stpCompanyCode as string,
          stpCompanyDisplay: row.stpCompanyDisplay as string,
          targetMonth: (row.targetMonth as string)?.slice(0, 7) || "",
          records: [],
          totalAmount: 0,
          uninvoicedCount: 0,
          hasInvoice: false,
        });
      }
      const group = map.get(key)!;
      group.records.push(row);
      group.totalAmount += calcDisplayAmount(row);
      if (!row.invoiceId && row.status !== "cancelled") {
        group.uninvoicedCount++;
      }
      if (row.invoiceId) {
        group.hasInvoice = true;
      }
    }
    // 月降順 → 企業コード昇順（localeCompareは日本語でサーバー/クライアント間で結果が異なるためASCIIのコードで比較）
    return Array.from(map.values()).sort((a, b) => {
      const monthCmp = b.targetMonth.localeCompare(a.targetMonth);
      if (monthCmp !== 0) return monthCmp;
      return a.stpCompanyCode < b.stpCompanyCode ? -1 : a.stpCompanyCode > b.stpCompanyCode ? 1 : 0;
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

  const handleCreateInvoice = async (revenueId: number) => {
    setCreatingInvoice(revenueId);
    try {
      await createInvoiceFromRevenue(revenueId);
      router.refresh();
    } catch {
      alert("請求書の作成に失敗しました");
    } finally {
      setCreatingInvoice(null);
    }
  };

  const handleCreateBatchInvoice = async (stpCompanyId: string, targetMonth: string) => {
    const key = `${stpCompanyId}__${targetMonth}`;
    setCreatingBatchInvoice(key);
    try {
      const result = await createBatchInvoice(Number(stpCompanyId), targetMonth);
      if (result) {
        router.refresh();
      } else {
        alert("請求書を生成する対象がありません");
      }
    } catch {
      alert("一括請求書の作成に失敗しました");
    } finally {
      setCreatingBatchInvoice(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingInvoice == null) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/stp/invoices/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "アップロードに失敗しました");
        return;
      }

      const { filePath, fileName } = await res.json();
      await updateInvoiceFromRevenue(uploadingInvoice, { filePath, fileName });
      router.refresh();
    } catch {
      alert("アップロードに失敗しました");
    } finally {
      setUploadingInvoice(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  const criticalFields = ["stpCompanyId", "revenueType", "expectedAmount"];

  const fieldLabels: Record<string, string> = {
    stpCompanyId: "企業",
    revenueType: "売上種別",
    expectedAmount: "請求金額",
  };

  const formatFieldValue = useCallback((key: string, value: unknown): string => {
    if (value == null) return "-";
    if (key === "stpCompanyId") {
      const opt = stpCompanyOptions.find((o) => o.value === String(value));
      return opt?.label || String(value);
    }
    if (key === "revenueType") {
      const map: Record<string, string> = { initial: "初期費用", monthly: "月額費用", performance: "成果報酬" };
      return map[value as string] || String(value);
    }
    if (key === "expectedAmount") return `¥${Number(value).toLocaleString()}`;
    return String(value);
  }, [stpCompanyOptions]);

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    const row = data.find((r) => r.id === id);
    if (!row) {
      await updateRevenueRecord(id, formData);
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

    await updateRevenueRecord(id, formData);
  };

  // グループ内テーブル用のカラム定義（企業カラムは非表示）
  const groupColumns: ColumnDef[] = [
    { key: "id", header: "ID", type: "number", editable: false },
    {
      key: "revenueType",
      header: "売上種別",
      type: "select",
      options: revenueTypeOptions,
      required: true,
    },
    {
      key: "expectedAmount",
      header: "請求金額",
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
    { key: "invoiceDate", header: "請求日", type: "date" },
    { key: "dueDate", header: "支払期限", type: "date" },
    { key: "paidDate", header: "着金日", type: "date" },
    { key: "paidAmount", header: "着金額", type: "number", currency: true },
    { key: "allocatedAmount", header: "消込状況", type: "text", editable: false },
    { key: "invoiceInfo", header: "請求書", type: "text", editable: false },
    { key: "note", header: "備考", type: "textarea" },
  ];

  // 新規追加用のカラム定義（企業・対象年月含む）
  const addColumns: ColumnDef[] = [
    { key: "id", header: "ID", type: "number", editable: false },
    {
      key: "stpCompanyId",
      header: "企業",
      type: "select",
      options: stpCompanyOptions,
      searchable: true,
      required: true,
    },
    {
      key: "revenueType",
      header: "売上種別",
      type: "select",
      options: revenueTypeOptions,
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
      header: "請求金額",
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
    { key: "invoiceDate", header: "請求日", type: "date" },
    { key: "dueDate", header: "支払期限", type: "date" },
    { key: "paidDate", header: "着金日", type: "date" },
    { key: "paidAmount", header: "着金額", type: "number", currency: true },
    {
      key: "contractHistoryId",
      header: "契約履歴",
      type: "select",
      options: contractHistoryOptions,
      searchable: true,
      hidden: true,
      editable: false,
    },
    {
      key: "candidateId",
      header: "求職者",
      type: "select",
      options: candidateOptions,
      searchable: true,
      hidden: true,
      visibleWhen: { field: "revenueType", value: "performance" },
    },
    { key: "note", header: "備考", type: "textarea" },
  ];

  const inlineEditConfig: InlineEditConfig = {
    columns: [
      "revenueType",
      "expectedAmount",
      "taxType",
      "taxRate",
      "status",
      "accountingStatus",
      "invoiceDate",
      "dueDate",
      "paidDate",
      "paidAmount",
    ],
    displayToEditMapping: {},
    getOptions: (_row, columnKey) => {
      if (columnKey === "revenueType") return revenueTypeOptions;
      if (columnKey === "status") return statusOptions;
      if (columnKey === "accountingStatus") return accountingStatusOptions;
      if (columnKey === "taxType") return taxTypeOptions;
      if (columnKey === "taxRate") return taxRateOptions;
      return [];
    },
  };

  const customRenderers = {
    revenueType: (value: unknown) => {
      const map: Record<string, string> = {
        initial: "初期費用",
        monthly: "月額費用",
        performance: "成果報酬",
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
    status: (value: unknown) => {
      const styles: Record<string, string> = {
        pending: "bg-gray-100 text-gray-700",
        approved: "bg-purple-100 text-purple-700",
        invoiced: "bg-blue-100 text-blue-700",
        paid: "bg-green-100 text-green-700",
        overdue: "bg-red-100 text-red-700",
        cancelled: "bg-gray-100 text-gray-500",
      };
      const labels: Record<string, string> = {
        pending: "未請求",
        approved: "承認済",
        invoiced: "請求済",
        paid: "入金済",
        overdue: "未入金(期限超過)",
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
    invoiceInfo: (_value: unknown, row: Record<string, unknown>) => {
      const invoiceId = row.invoiceId as number | null;
      const invoiceStatus = row.invoiceStatus as string | null;
      const invoiceFileName = row.invoiceFileName as string | null;
      const revenueId = row.id as number;

      if (!invoiceId) {
        return (
          <button
            onClick={() => handleCreateInvoice(revenueId)}
            disabled={creatingInvoice === revenueId}
            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          >
            {creatingInvoice === revenueId ? "作成中..." : "個別生成"}
          </button>
        );
      }

      const statusLabels: Record<string, string> = {
        draft: "下書き",
        issued: "発行済",
        sent: "送付済",
        paid: "入金済",
      };
      const statusStyles: Record<string, string> = {
        draft: "bg-gray-100 text-gray-600",
        issued: "bg-blue-100 text-blue-600",
        sent: "bg-purple-100 text-purple-600",
        paid: "bg-green-100 text-green-600",
      };

      return (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              statusStyles[invoiceStatus || ""] || "bg-gray-100 text-gray-600"
            }`}
          >
            {statusLabels[invoiceStatus || ""] || invoiceStatus || "-"}
          </span>
          {invoiceFileName ? (
            <span
              className="text-xs text-gray-500 truncate max-w-[100px]"
              title={invoiceFileName}
            >
              {invoiceFileName}
            </span>
          ) : (
            <button
              onClick={() => {
                setUploadingInvoice(invoiceId);
                fileInputRef.current?.click();
              }}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              ファイル添付
            </button>
          )}
        </div>
      );
    },
    note: (value: unknown, row: Record<string, unknown>) => {
      return (
        <TextPreviewCell
          text={value as string | null}
          title="備考"
          onEdit={async (newValue) => {
            await updateRevenueRecord(row.id as number, {
              note: newValue,
            });
            router.refresh();
          }}
        />
      );
    },
  };

  // グループのステータスサマリーを計算
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
      {/* hidden file input for invoice upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFileUpload}
      />

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
            pending: "未請求",
            approved: "承認済",
            invoiced: "請求済",
            paid: "入金済",
            overdue: "期限超過",
            cancelled: "取消",
          };
          const statusColors: Record<string, string> = {
            pending: "text-gray-600",
            approved: "text-purple-600",
            invoiced: "text-blue-600",
            paid: "text-green-600",
            overdue: "text-red-600",
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
                  <CompanyCodeLabel code={group.stpCompanyCode} name={group.stpCompanyDisplay} />
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
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {group.uninvoicedCount > 0 && (
                    <button
                      onClick={() => handleCreateBatchInvoice(group.stpCompanyId, group.targetMonth)}
                      disabled={creatingBatchInvoice === group.key}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {creatingBatchInvoice === group.key
                        ? "作成中..."
                        : `一括請求書生成 (${group.uninvoicedCount}件)`}
                    </button>
                  )}
                </div>
              </div>

              {/* グループ内テーブル */}
              {isExpanded && (
                <div className="p-2">
                  <CrudTable
                    data={group.records}
                    columns={groupColumns}
                    onAdd={async (formData) => {
                      // グループから企業と月を自動セット
                      await addRevenueRecord({
                        ...formData,
                        stpCompanyId: group.stpCompanyId,
                        targetMonth: group.targetMonth + "-01",
                      });
                    }}
                    onUpdate={handleUpdate}
                    onDelete={async (id) => {
                      await deleteRevenueRecord(id);
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

      {/* 新規追加（グループ外）- 全カラム表示 */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">新規売上レコード追加</h3>
        <CrudTable
          data={[]}
          columns={addColumns}
          onAdd={async (formData) => {
            await addRevenueRecord(formData);
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
            await updateRevenueRecord(autoEditDialog.id, autoEditDialog.updateData);
            await logRevenueEdit({
              revenueRecordId: autoEditDialog.id,
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
        recordType="revenue"
        onConfirm={async (paymentStatus, reason) => {
          if (mismatchDialog) {
            await updateRevenueRecord(mismatchDialog.id, {
              ...mismatchDialog.updateData,
              paymentStatus,
            });
            await logRevenueEdit({
              revenueRecordId: mismatchDialog.id,
              editType: "amount_mismatch",
              fieldName: "paidAmount",
              oldValue: `¥${mismatchDialog.expectedAmount.toLocaleString()}（請求金額）`,
              newValue: `¥${mismatchDialog.paidAmount.toLocaleString()}（着金額）`,
              reason: `${paymentStatus === "partial" ? "一部入金" : "金額相違あり"}${reason ? `: ${reason}` : ""}`,
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
            await applyLatestRevenueAmount(sourceChangeDialog.id);
            router.refresh();
          }
          setSourceChangeDialog(null);
        }}
        onDismiss={async () => {
          if (sourceChangeDialog) {
            await dismissRevenueSourceChange(sourceChangeDialog.id);
            router.refresh();
          }
          setSourceChangeDialog(null);
        }}
        onCancel={() => setSourceChangeDialog(null)}
      />
    </div>
  );
}
