"use client";

import { useState, useMemo } from "react";
import { CrudTable, ColumnDef, InlineEditConfig } from "@/components/crud-table";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { useRouter } from "next/navigation";
import {
  addPaymentTransaction,
  updatePaymentTransaction,
  deletePaymentTransaction,
} from "./actions";
import { AllocationModal } from "./allocation-modal";

type AllocationInfo = {
  id: number;
  allocatedAmount: number;
  note: string | null;
  revenueRecordId: number | null;
  expenseRecordId: number | null;
  revenueCompanyName: string | null;
  expenseAgentName: string | null;
};

type RevenueOption = {
  id: number;
  companyName: string;
  revenueType: string;
  targetMonth: string | null;
  expectedAmount: number;
  status: string;
};

type ExpenseOption = {
  id: number;
  agentName: string;
  expenseType: string;
  targetMonth: string | null;
  expectedAmount: number;
  status: string;
};

type Props = {
  data: Record<string, unknown>[];
  revenueOptions: RevenueOption[];
  expenseOptions: ExpenseOption[];
};

const directionOptions = [
  { value: "incoming", label: "入金" },
  { value: "outgoing", label: "出金" },
];

const statusOptions = [
  { value: "unmatched", label: "未消込" },
  { value: "partial", label: "一部消込" },
  { value: "matched", label: "消込済" },
  { value: "excluded", label: "対象外" },
];

type PaymentTab = "all" | "incoming" | "outgoing" | "unmatched" | "matched";

const tabs: {
  key: PaymentTab;
  label: string;
  filter: (row: Record<string, unknown>) => boolean;
}[] = [
  { key: "all", label: "すべて", filter: () => true },
  { key: "incoming", label: "入金", filter: (r) => r.direction === "incoming" },
  { key: "outgoing", label: "出金", filter: (r) => r.direction === "outgoing" },
  {
    key: "unmatched",
    label: "未消込",
    filter: (r) => r.status === "unmatched" || r.status === "partial",
  },
  {
    key: "matched",
    label: "消込済",
    filter: (r) => r.status === "matched",
  },
];

export function PaymentsTable({ data, revenueOptions, expenseOptions }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PaymentTab>("all");
  const [allocationTarget, setAllocationTarget] = useState<Record<
    string,
    unknown
  > | null>(null);

  const tabCounts = useMemo(() => {
    const counts: Record<PaymentTab, number> = {
      all: data.length,
      incoming: 0,
      outgoing: 0,
      unmatched: 0,
      matched: 0,
    };
    for (const row of data) {
      if (row.direction === "incoming") counts.incoming++;
      if (row.direction === "outgoing") counts.outgoing++;
      if (row.status === "unmatched" || row.status === "partial")
        counts.unmatched++;
      if (row.status === "matched") counts.matched++;
    }
    return counts;
  }, [data]);

  const filteredData = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab)!;
    return data.filter(tab.filter);
  }, [data, activeTab]);

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", type: "number", editable: false },
    {
      key: "direction",
      header: "方向",
      type: "select",
      options: directionOptions,
      required: true,
    },
    { key: "transactionDate", header: "取引日", type: "date", required: true },
    {
      key: "amount",
      header: "金額",
      type: "number",
      currency: true,
      required: true,
    },
    { key: "counterpartyName", header: "取引先名", type: "text" },
    { key: "bankAccountName", header: "口座名", type: "text" },
    { key: "accountCode", header: "勘定科目コード", type: "text" },
    { key: "accountName", header: "勘定科目名", type: "text" },
    {
      key: "withholdingTaxAmount",
      header: "源泉徴収税額",
      type: "number",
      currency: true,
    },
    {
      key: "status",
      header: "ステータス",
      type: "select",
      options: statusOptions,
    },
    {
      key: "allocationInfo",
      header: "消込状況",
      type: "text",
      editable: false,
    },
    { key: "note", header: "備考", type: "textarea" },
  ];

  const inlineEditConfig: InlineEditConfig = {
    columns: [
      "direction",
      "transactionDate",
      "amount",
      "counterpartyName",
      "bankAccountName",
      "accountCode",
      "accountName",
      "withholdingTaxAmount",
      "status",
    ],
    displayToEditMapping: {},
    getOptions: (_row, columnKey) => {
      if (columnKey === "direction") return directionOptions;
      if (columnKey === "status") return statusOptions;
      return [];
    },
  };

  const customRenderers = {
    direction: (value: unknown) => {
      const isIncoming = value === "incoming";
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            isIncoming
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {isIncoming ? "入金" : "出金"}
        </span>
      );
    },
    amount: (value: unknown) => {
      return value != null ? `¥${Number(value).toLocaleString()}` : "-";
    },
    withholdingTaxAmount: (value: unknown) => {
      return value != null ? `¥${Number(value).toLocaleString()}` : "-";
    },
    status: (value: unknown) => {
      const styles: Record<string, string> = {
        unmatched: "bg-gray-100 text-gray-700",
        partial: "bg-yellow-100 text-yellow-700",
        matched: "bg-green-100 text-green-700",
        excluded: "bg-purple-100 text-purple-700",
      };
      const labels: Record<string, string> = {
        unmatched: "未消込",
        partial: "一部消込",
        matched: "消込済",
        excluded: "対象外",
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
    allocationInfo: (_value: unknown, row: Record<string, unknown>) => {
      const allocations = (row.allocations as AllocationInfo[]) || [];
      const totalAllocated = row.totalAllocated as number;
      const amount = row.amount as number;

      if (allocations.length === 0) {
        return (
          <button
            onClick={() => setAllocationTarget(row)}
            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          >
            消込
          </button>
        );
      }

      const names = allocations
        .map(
          (a) =>
            a.revenueCompanyName || a.expenseAgentName || "-"
        )
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 3);

      return (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setAllocationTarget(row)}
            className="text-xs text-blue-600 hover:underline whitespace-nowrap text-left"
          >
            {names.join(", ")}
            {allocations.length > 3 ? ` 他${allocations.length - 3}件` : ""}
          </button>
          <span className="text-xs text-muted-foreground">
            ¥{totalAllocated.toLocaleString()} / ¥{amount.toLocaleString()}
          </span>
        </div>
      );
    },
    note: (value: unknown, row: Record<string, unknown>) => {
      return (
        <TextPreviewCell
          text={value as string | null}
          title="備考"
          onEdit={async (newValue) => {
            await updatePaymentTransaction(row.id as number, {
              note: newValue,
            });
            router.refresh();
          }}
        />
      );
    },
  };

  return (
    <div className="space-y-4">
      {/* Tab navigation */}
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

      <CrudTable
        data={filteredData}
        columns={columns}
        onAdd={async (formData) => {
          await addPaymentTransaction(formData);
        }}
        onUpdate={async (id, formData) => {
          await updatePaymentTransaction(id, formData);
        }}
        onDelete={async (id) => {
          await deletePaymentTransaction(id);
        }}
        enableInlineEdit={true}
        inlineEditConfig={inlineEditConfig}
        customRenderers={customRenderers}
      />

      {/* Allocation Modal */}
      {allocationTarget && (
        <AllocationModal
          open={!!allocationTarget}
          onClose={() => {
            setAllocationTarget(null);
            router.refresh();
          }}
          transaction={allocationTarget}
          revenueOptions={revenueOptions}
          expenseOptions={expenseOptions}
        />
      )}
    </div>
  );
}
