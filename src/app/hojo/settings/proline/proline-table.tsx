"use client";

import { CrudTable, ColumnDef } from "@/components/crud-table";
import { updateProlineAccount } from "./actions";

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

export function ProlineTable({ data, canEdit }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "lineType", header: "LINE種別", editable: false, hidden: true },
    { key: "label", header: "公式LINE名", type: "text", required: true },
    { key: "email", header: "メールアドレス", type: "text" },
    { key: "password", header: "パスワード", type: "password" },
  ];

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="プロラインアカウント"
      onUpdate={canEdit ? updateProlineAccount : undefined}
      emptyMessage="プロラインアカウントが登録されていません"
    />
  );
}
