"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { getChangeLogsForTransaction } from "./actions";
import type { ChangeLogEntry } from "./actions";

// ============================================
// 定数
// ============================================

const CHANGE_TYPE_LABELS: Record<string, string> = {
  create: "作成",
  update: "更新",
  delete: "削除",
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
};

const CHANGE_TYPE_ICONS: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const TABLE_NAME_LABELS: Record<string, string> = {
  Transaction: "取引",
  JournalEntry: "仕訳",
  AllocationTemplateLine: "按分テンプレート明細",
};

const FIELD_LABELS: Record<string, string> = {
  type: "種別",
  counterpartyId: "取引先",
  expenseCategoryId: "費目",
  amount: "金額",
  taxAmount: "消費税額",
  taxRate: "税率",
  taxType: "税区分",
  periodFrom: "発生期間（開始）",
  periodTo: "発生期間（終了）",
  allocationTemplateId: "按分テンプレート",
  costCenterId: "按分先",
  contractId: "契約",
  projectId: "プロジェクト",
  paymentMethodId: "決済手段",
  paymentDueDate: "支払期日",
  note: "備考",
  status: "ステータス",
  isWithholdingTarget: "源泉徴収対象",
  withholdingTaxRate: "源泉徴収税率",
  withholdingTaxAmount: "源泉徴収税額",
  netPaymentAmount: "差引支払額",
  journalDate: "仕訳日",
  description: "摘要",
  transactionId: "取引ID",
  invoiceGroupId: "請求グループID",
  paymentGroupId: "支払グループID",
  templateId: "テンプレートID",
  allocationRate: "按分率",
  label: "ラベル",
};

const STATUS_LABELS: Record<string, string> = {
  unconfirmed: "未確定",
  confirmed: "確定済み",
  awaiting_accounting: "経理処理待ち",
  returned: "差し戻し",
  resubmitted: "再提出",
  journalized: "仕訳済み",
  partially_paid: "一部入金",
  paid: "入金完了",
  hidden: "非表示",
  draft: "下書き",
};

const TYPE_LABELS: Record<string, string> = {
  revenue: "売上",
  expense: "経費",
  tax_included: "税込",
  tax_excluded: "税抜",
};

// ============================================
// Props
// ============================================

type ChangeLogSectionProps = {
  transactionId: number;
};

// ============================================
// メインコンポーネント
// ============================================

export function ChangeLogSection({ transactionId }: ChangeLogSectionProps) {
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getChangeLogsForTransaction(transactionId);
      setLogs(data);
    } catch {
      // エラー時は空配列のまま
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        変更履歴を読み込み中...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          変更履歴はありません
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4" />
        変更履歴（{logs.length}件）
      </h3>
      <div className="space-y-2">
        {logs.map((log) => (
          <ChangeLogItem
            key={log.id}
            log={log}
            expanded={expandedIds.has(log.id)}
            onToggle={() => toggleExpand(log.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// 個別の変更履歴アイテム
// ============================================

function ChangeLogItem({
  log,
  expanded,
  onToggle,
}: {
  log: ChangeLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = CHANGE_TYPE_ICONS[log.changeType] || Pencil;
  const hasDetails =
    (log.changeType === "update" && log.oldData && log.newData) ||
    (log.changeType === "create" && log.newData) ||
    (log.changeType === "delete" && log.oldData);

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
        onClick={onToggle}
        disabled={!hasDetails}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={CHANGE_TYPE_COLORS[log.changeType] || "bg-gray-100"}
            >
              {CHANGE_TYPE_LABELS[log.changeType] || log.changeType}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {TABLE_NAME_LABELS[log.tableName] || log.tableName}
              {log.tableName !== "Transaction" && ` #${log.recordId}`}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{log.changer.name}</span>
            <span>·</span>
            <span>{formatDateTime(log.changedAt)}</span>
          </div>
        </div>
        {hasDetails && (
          <span className="shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      {expanded && hasDetails && (
        <div className="px-3 pb-3 border-t">
          <div className="mt-2">
            {log.changeType === "update" && log.oldData && log.newData && (
              <DiffView oldData={log.oldData} newData={log.newData} />
            )}
            {log.changeType === "create" && log.newData && (
              <CreateView data={log.newData} />
            )}
            {log.changeType === "delete" && log.oldData && (
              <DeleteView data={log.oldData} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 差分表示コンポーネント
// ============================================

function DiffView({
  oldData,
  newData,
}: {
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
}) {
  const fields = Object.keys(newData);
  if (fields.length === 0) return null;

  return (
    <div className="space-y-1">
      {fields.map((field) => (
        <div
          key={field}
          className="flex items-start gap-2 text-xs py-1 border-b border-dashed last:border-b-0"
        >
          <span className="font-medium text-muted-foreground w-28 shrink-0">
            {FIELD_LABELS[field] || field}
          </span>
          <span className="text-red-600 line-through">
            {formatValue(field, oldData[field])}
          </span>
          <ArrowRight className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
          <span className="text-green-700 font-medium">
            {formatValue(field, newData[field])}
          </span>
        </div>
      ))}
    </div>
  );
}

function CreateView({ data }: { data: Record<string, unknown> }) {
  const fields = Object.keys(data);
  if (fields.length === 0) return null;

  return (
    <div className="space-y-1">
      {fields.map((field) => (
        <div
          key={field}
          className="flex items-start gap-2 text-xs py-1 border-b border-dashed last:border-b-0"
        >
          <span className="font-medium text-muted-foreground w-28 shrink-0">
            {FIELD_LABELS[field] || field}
          </span>
          <span className="text-green-700">{formatValue(field, data[field])}</span>
        </div>
      ))}
    </div>
  );
}

function DeleteView({ data }: { data: Record<string, unknown> }) {
  const fields = Object.keys(data);
  if (fields.length === 0) return null;

  return (
    <div className="space-y-1">
      {fields.map((field) => (
        <div
          key={field}
          className="flex items-start gap-2 text-xs py-1 border-b border-dashed last:border-b-0"
        >
          <span className="font-medium text-muted-foreground w-28 shrink-0">
            {FIELD_LABELS[field] || field}
          </span>
          <span className="text-red-600 line-through">
            {formatValue(field, data[field])}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// フォーマッター
// ============================================

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "（なし）";

  // ステータスの翻訳
  if (field === "status") {
    return STATUS_LABELS[value as string] || String(value);
  }

  // type / taxType の翻訳
  if (field === "type" || field === "taxType") {
    return TYPE_LABELS[value as string] || String(value);
  }

  // boolean
  if (field === "isWithholdingTarget") {
    return value ? "対象" : "対象外";
  }

  // 金額フィールド
  if (
    field === "amount" ||
    field === "taxAmount" ||
    field === "withholdingTaxAmount" ||
    field === "netPaymentAmount"
  ) {
    return `¥${Number(value).toLocaleString()}`;
  }

  // パーセンテージ
  if (field === "taxRate" || field === "withholdingTaxRate") {
    return `${value}%`;
  }

  if (field === "allocationRate") {
    return `${value}%`;
  }

  // 日付フィールド
  if (
    field === "periodFrom" ||
    field === "periodTo" ||
    field === "paymentDueDate" ||
    field === "journalDate"
  ) {
    return formatDate(value);
  }

  return String(value);
}

function formatDate(value: unknown): string {
  if (!value) return "（なし）";
  try {
    const d = new Date(value as string);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function formatDateTime(date: Date): string {
  try {
    const d = new Date(date);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
}
