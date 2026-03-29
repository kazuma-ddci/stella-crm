"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";

type Props = {
  data: Record<string, unknown>[];
};

export function CustomersTable({ data }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "lineFriendId",
      header: "LINE番号",
      editable: false,
      filterable: true,
    },
    {
      key: "lineName",
      header: "LINE名",
      editable: false,
      filterable: true,
    },
    {
      key: "referrer",
      header: "紹介者",
      editable: false,
      filterable: true,
    },
    {
      key: "vendorName",
      header: "ベンダー名",
      editable: false,
      filterable: true,
    },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="顧客"
      emptyMessage="顧客データが登録されていません"
    />
  );
}
