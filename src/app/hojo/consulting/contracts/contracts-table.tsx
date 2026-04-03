"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addContract, updateContract, deleteContract } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  vendorOptions: { value: string; label: string }[];
};

export function ContractsTable({ data, canEdit, vendorOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorId", header: "ベンダー", type: "select", options: vendorOptions, required: true, searchable: true, filterable: true },
    { key: "vendorName", header: "ベンダー名", editable: false, filterable: true },
    { key: "companyName", header: "企業名", type: "text", required: true, filterable: true },
    { key: "representativeName", header: "代表者名", type: "text" },
    { key: "mainContactName", header: "主担当者名", type: "text" },
    { key: "customerEmail", header: "メール", type: "text" },
    { key: "customerPhone", header: "電話番号", type: "text" },
    { key: "lineNumber", header: "LINE番号", type: "text" },
    { key: "lineName", header: "LINE名", type: "text" },
    { key: "referralUrl", header: "紹介URL", type: "text" },
    { key: "assignedAs", header: "担当区分", type: "text" },
    { key: "consultingStaff", header: "コンサル担当", type: "text" },
    { key: "contractDate", header: "契約日", type: "date" },
    { key: "contractPlan", header: "契約プラン", type: "text" },
    { key: "contractAmount", header: "契約金額", type: "number", currency: true },
    { key: "serviceType", header: "サービス種別", type: "text" },
    { key: "caseStatus", header: "案件ステータス", type: "text", filterable: true },
    { key: "hasScSales", header: "SC販売", type: "boolean" },
    { key: "hasSubsidyConsulting", header: "補助金コンサル", type: "boolean" },
    { key: "hasBpoSupport", header: "BPO支援", type: "boolean" },
    { key: "consultingPlan", header: "コンサルプラン", type: "text" },
    { key: "successFee", header: "成功報酬", type: "number", currency: true },
    { key: "startDate", header: "開始日", type: "date" },
    { key: "endDate", header: "終了日", type: "date" },
    { key: "billingStatus", header: "請求ステータス", type: "text" },
    { key: "paymentStatus", header: "入金ステータス", type: "text" },
    { key: "revenueRecordingDate", header: "売上計上日", type: "date" },
    { key: "grossProfit", header: "粗利", type: "number", currency: true },
    { key: "notes", header: "備考", type: "textarea" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="契約"
      onAdd={canEdit ? addContract : undefined}
      onUpdate={canEdit ? updateContract : undefined}
      onDelete={canEdit ? deleteContract : undefined}
      emptyMessage="契約が登録されていません"
    />
  );
}
