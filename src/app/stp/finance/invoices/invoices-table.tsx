"use client";

import { useState, useMemo, useRef } from "react";
import { CrudTable, ColumnDef, InlineEditConfig } from "@/components/crud-table";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { useRouter } from "next/navigation";
import { addInvoice, updateInvoice, deleteInvoice, createCreditNote } from "./actions";
import { calcDueDate } from "@/lib/finance/due-date";
import { toLocalDateString } from "@/lib/utils";

type PaymentTerms = {
  closingDay: number | null;
  paymentMonthOffset: number | null;
  paymentDay: number | null;
};

type Props = {
  data: Record<string, unknown>[];
  stpCompanyOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  paymentTermsByStpCompany: Record<string, PaymentTerms>;
  paymentTermsByAgent: Record<string, PaymentTerms>;
};

const invoiceTypeOptions = [
  { value: "standard", label: "通常" },
  { value: "credit_note", label: "赤伝" },
];

const directionOptions = [
  { value: "outgoing", label: "発行（自社→先方）" },
  { value: "incoming", label: "受領（先方→自社）" },
];

const outgoingStatusOptions = [
  { value: "draft", label: "下書き" },
  { value: "issued", label: "発行済" },
  { value: "sent", label: "送付済" },
  { value: "paid", label: "入金済" },
];

const incomingStatusOptions = [
  { value: "received", label: "受領" },
  { value: "approved", label: "承認済" },
  { value: "paid", label: "支払済" },
];

const allStatusOptions = [
  { value: "draft", label: "下書き" },
  { value: "issued", label: "発行済" },
  { value: "sent", label: "送付済" },
  { value: "received", label: "受領" },
  { value: "approved", label: "承認済" },
  { value: "paid", label: "入金/支払済" },
];

type DirectionTab = "all" | "outgoing" | "incoming";

const tabs: {
  key: DirectionTab;
  label: string;
  filter: (row: Record<string, unknown>) => boolean;
}[] = [
  { key: "all", label: "すべて", filter: () => true },
  { key: "outgoing", label: "発行請求書", filter: (r) => r.direction === "outgoing" },
  { key: "incoming", label: "受領請求書", filter: (r) => r.direction === "incoming" },
];

export function InvoicesTable({ data, stpCompanyOptions, agentOptions, paymentTermsByStpCompany, paymentTermsByAgent }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DirectionTab>("all");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
  const [creatingCreditNote, setCreatingCreditNote] = useState<number | null>(null);

  const handleCreateCreditNote = async (invoiceId: number) => {
    if (!confirm("この請求書に対する赤伝（クレジットノート）を作成しますか？")) return;
    setCreatingCreditNote(invoiceId);
    try {
      await createCreditNote(invoiceId);
      router.refresh();
    } catch {
      alert("赤伝の作成に失敗しました");
    } finally {
      setCreatingCreditNote(null);
    }
  };

  // 支払い条件から日付を自動計算するヘルパー
  const getPaymentTerms = (formData: Record<string, unknown>): PaymentTerms | null => {
    // 企業が選択されていればその支払い条件を使用
    const stpCompanyId = formData.stpCompanyId;
    if (stpCompanyId) {
      const terms = paymentTermsByStpCompany[String(stpCompanyId)];
      if (terms?.paymentMonthOffset != null) return terms;
    }
    // 代理店が選択されていればその支払い条件を使用
    const agentId = formData.agentId;
    if (agentId) {
      const terms = paymentTermsByAgent[String(agentId)];
      if (terms?.paymentMonthOffset != null) return terms;
    }
    return null;
  };

  const handleFieldChange = (fieldKey: string, newValue: unknown, formData: Record<string, unknown>, setFormData: (data: Record<string, unknown>) => void) => {
    // 企業 or 代理店が選択された場合 → invoiceDateとdueDateを自動セット
    if (fieldKey === "stpCompanyId" || fieldKey === "agentId") {
      const updatedFormData = { ...formData, [fieldKey]: newValue };
      const terms = getPaymentTerms(updatedFormData);
      if (terms) {
        const today = new Date();
        const invoiceDate = toLocalDateString(today);
        const dueDate = calcDueDate({
          invoiceDate: today,
          closingDay: terms.closingDay,
          paymentMonthOffset: terms.paymentMonthOffset,
          paymentDay: terms.paymentDay,
        });
        setFormData({
          ...updatedFormData,
          invoiceDate,
          dueDate: dueDate ? toLocalDateString(dueDate) : null,
        });
      }
    }

    // invoiceDateが変更された場合 → dueDateを再計算
    if (fieldKey === "invoiceDate" && newValue) {
      const terms = getPaymentTerms(formData);
      if (terms) {
        const dueDate = calcDueDate({
          invoiceDate: new Date(newValue as string),
          closingDay: terms.closingDay,
          paymentMonthOffset: terms.paymentMonthOffset,
          paymentDay: terms.paymentDay,
        });
        setFormData({
          ...formData,
          [fieldKey]: newValue,
          dueDate: dueDate ? toLocalDateString(dueDate) : null,
        });
      }
    }
  };

  const tabCounts = useMemo(() => {
    const counts: Record<DirectionTab, number> = { all: data.length, outgoing: 0, incoming: 0 };
    for (const row of data) {
      if (row.direction === "outgoing") counts.outgoing++;
      else if (row.direction === "incoming") counts.incoming++;
    }
    return counts;
  }, [data]);

  const filteredData = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab)!;
    return data.filter(tab.filter);
  }, [data, activeTab]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadTargetId == null) return;

    setUploading(true);
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
      await updateInvoice(uploadTargetId, { filePath, fileName });
      router.refresh();
    } catch {
      alert("アップロードに失敗しました");
    } finally {
      setUploading(false);
      setUploadTargetId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", type: "number", editable: false },
    {
      key: "direction",
      header: "種別",
      type: "select",
      options: directionOptions,
      required: true,
    },
    {
      key: "invoiceType",
      header: "種類",
      type: "select",
      options: invoiceTypeOptions,
      editable: false,
    },
    {
      key: "stpCompanyId",
      header: "企業",
      type: "select",
      options: stpCompanyOptions,
      searchable: true,
    },
    {
      key: "agentId",
      header: "代理店",
      type: "select",
      options: agentOptions,
      searchable: true,
    },
    { key: "invoiceNumber", header: "請求書番号", type: "text", editable: false },
    { key: "registrationNumber", header: "登録番号", type: "text", editable: false },
    { key: "invoiceDate", header: "請求日", type: "date" },
    { key: "dueDate", header: "支払期限", type: "date" },
    { key: "totalAmount", header: "金額", type: "number" },
    { key: "taxAmount", header: "消費税", type: "number" },
    { key: "subtotalByTaxRateDisplay", header: "税率別合計", type: "text", editable: false },
    {
      key: "status",
      header: "ステータス",
      type: "select",
      options: allStatusOptions,
    },
    { key: "linkedRecords", header: "紐づきレコード", type: "text", editable: false },
    { key: "creditNoteAction", header: "赤伝", type: "text", editable: false },
    { key: "fileName", header: "ファイル", type: "text", editable: false },
    { key: "note", header: "備考", type: "textarea" },
  ];

  const inlineEditConfig: InlineEditConfig = {
    columns: [
      "direction",
      "stpCompanyId",
      "agentId",
      "invoiceDate",
      "dueDate",
      "totalAmount",
      "taxAmount",
      "status",
    ],
    displayToEditMapping: {
      stpCompanyDisplay: "stpCompanyId",
      agentDisplay: "agentId",
    },
    getOptions: (row, columnKey) => {
      if (columnKey === "direction") return directionOptions;
      if (columnKey === "stpCompanyId") return stpCompanyOptions;
      if (columnKey === "agentId") return agentOptions;
      if (columnKey === "status") {
        return row?.direction === "incoming"
          ? incomingStatusOptions
          : outgoingStatusOptions;
      }
      return [];
    },
  };

  return (
    <div className="space-y-4">
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFileUpload}
      />

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

      <CrudTable
        data={filteredData}
        columns={columns}
        onAdd={async (formData) => {
          await addInvoice(formData);
        }}
        onUpdate={async (id, formData) => {
          await updateInvoice(id, formData);
        }}
        onDelete={async (id) => {
          await deleteInvoice(id);
        }}
        enableInlineEdit={true}
        inlineEditConfig={inlineEditConfig}
        onFieldChange={handleFieldChange}
        customRenderers={{
          invoiceType: (value: unknown) => {
            if (value === "credit_note") {
              return (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                  赤伝
                </span>
              );
            }
            return <span className="text-xs text-muted-foreground">通常</span>;
          },
          subtotalByTaxRateDisplay: (_value: unknown, row: Record<string, unknown>) => {
            const raw = row.subtotalByTaxRate;
            if (!raw || typeof raw !== "object") return "-";
            const rates = raw as Record<string, { subtotal: number; tax: number }>;
            return (
              <div className="space-y-0.5 text-xs">
                {Object.entries(rates).map(([rate, data]) => (
                  <div key={rate}>
                    {rate}%: ¥{data.subtotal.toLocaleString()} (税¥{data.tax.toLocaleString()})
                  </div>
                ))}
              </div>
            );
          },
          creditNoteAction: (_value: unknown, row: Record<string, unknown>) => {
            const invoiceType = row.invoiceType as string;
            if (invoiceType !== "standard") return "-";
            const invoiceId = row.id as number;
            return (
              <button
                onClick={() => handleCreateCreditNote(invoiceId)}
                disabled={creatingCreditNote === invoiceId}
                className="text-xs text-red-600 hover:underline whitespace-nowrap"
              >
                {creatingCreditNote === invoiceId ? "作成中..." : "赤伝作成"}
              </button>
            );
          },
          direction: (value: unknown) => {
            const isOutgoing = value === "outgoing";
            return (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  isOutgoing
                    ? "bg-blue-100 text-blue-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {isOutgoing ? "発行" : "受領"}
              </span>
            );
          },
          stpCompanyId: (_value: unknown, row: Record<string, unknown>) => {
            return (row.stpCompanyDisplay as string) || "-";
          },
          agentId: (_value: unknown, row: Record<string, unknown>) => {
            return (row.agentDisplay as string) || "-";
          },
          totalAmount: (value: unknown) => {
            return value != null ? `¥${Number(value).toLocaleString()}` : "-";
          },
          taxAmount: (value: unknown) => {
            return value != null ? `¥${Number(value).toLocaleString()}` : "-";
          },
          status: (value: unknown, row: Record<string, unknown>) => {
            const outgoingStyles: Record<string, string> = {
              draft: "bg-gray-100 text-gray-700",
              issued: "bg-blue-100 text-blue-700",
              sent: "bg-purple-100 text-purple-700",
              paid: "bg-green-100 text-green-700",
            };
            const incomingStyles: Record<string, string> = {
              received: "bg-yellow-100 text-yellow-700",
              approved: "bg-blue-100 text-blue-700",
              paid: "bg-green-100 text-green-700",
            };
            const allLabels: Record<string, string> = {
              draft: "下書き",
              issued: "発行済",
              sent: "送付済",
              received: "受領",
              approved: "承認済",
              paid: row.direction === "outgoing" ? "入金済" : "支払済",
            };
            const styles =
              row.direction === "incoming" ? incomingStyles : outgoingStyles;
            const cls = styles[value as string] || "bg-gray-100 text-gray-700";
            return (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
              >
                {allLabels[value as string] || (value as string) || "-"}
              </span>
            );
          },
          linkedRecords: (_value: unknown, row: Record<string, unknown>) => {
            const revenueCount = row.revenueRecordCount as number;
            const expenseCount = row.expenseRecordCount as number;
            const parts: string[] = [];
            if (revenueCount > 0) parts.push(`売上${revenueCount}件`);
            if (expenseCount > 0) parts.push(`経費${expenseCount}件`);
            return parts.length > 0 ? (
              <span className="text-xs text-muted-foreground">{parts.join(" / ")}</span>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            );
          },
          fileName: (value: unknown, row: Record<string, unknown>) => {
            if (!value) {
              return (
                <button
                  onClick={() => {
                    setUploadTargetId(row.id as number);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {uploading && uploadTargetId === (row.id as number)
                    ? "アップロード中..."
                    : "ファイルを添付"}
                </button>
              );
            }
            return (
              <div className="flex items-center gap-1">
                <span className="text-xs truncate max-w-[120px]" title={value as string}>
                  {value as string}
                </span>
                <button
                  onClick={() => {
                    setUploadTargetId(row.id as number);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  変更
                </button>
              </div>
            );
          },
          note: (value: unknown, row: Record<string, unknown>) => {
            return (
              <TextPreviewCell
                text={value as string | null}
                title="備考"
                onEdit={async (newValue) => {
                  await updateInvoice(row.id as number, { note: newValue });
                  router.refresh();
                }}
              />
            );
          },
        }}
      />
    </div>
  );
}
