"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";

type Props = {
  data: Record<string, unknown>[];
};

export function AccountsTable({ data }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "supportProviderName",
      header: "支援事業者名",
      editable: false,
      filterable: true,
    },
    {
      key: "companyName",
      header: "会社名(補助事業社、納品先）",
      editable: false,
      filterable: true,
    },
    {
      key: "email",
      header: "メールアドレス(アカウント)",
      editable: false,
      filterable: true,
    },
    {
      key: "recruitmentRound",
      header: "募集回",
      editable: false,
      filterable: true,
    },
    {
      key: "adoptionDate",
      header: "採択日",
      type: "date",
      editable: false,
    },
    {
      key: "issueRequestDate",
      header: "発行依頼日",
      type: "date",
      editable: false,
    },
    {
      key: "accountApprovalDate",
      header: "アカウント承認日",
      type: "date",
      editable: false,
    },
    {
      key: "grantDate",
      header: "交付日",
      type: "date",
      editable: false,
    },
    {
      key: "toolCost",
      header: "ツール代(税別)万円",
      type: "number",
      editable: false,
    },
    {
      key: "billingPaymentStatus",
      header: "請求入金状況",
      editable: false,
      filterable: true,
    },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="アカウント"
      emptyMessage="アカウントデータが登録されていません"
    />
  );
}
