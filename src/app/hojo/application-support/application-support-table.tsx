"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { addApplicationSupport, updateApplicationSupport, deleteApplicationSupport } from "./actions";
import { ExternalLink } from "lucide-react";

type Props = {
  data: Record<string, unknown>[];
  lineFriendOptions: { value: string; label: string }[];
  vendorOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  lineFriendNameMap: Record<string, string>;
  lineFriendFree1Map: Record<string, string>;
};

export function ApplicationSupportTable({
  data,
  lineFriendOptions,
  vendorOptions,
  statusOptions,
  lineFriendNameMap,
  lineFriendFree1Map,
}: Props) {
  const router = useRouter();

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "lineFriendId",
      header: "LINE番号",
      type: "select",
      options: lineFriendOptions,
      required: true,
      searchable: true,
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
      key: "vendorId",
      header: "ベンダー名",
      type: "select",
      options: vendorOptions,
      searchable: true,
      filterable: true,
    },
    {
      key: "applicantName",
      header: "申請者名",
      type: "text",
      filterable: true,
    },
    {
      key: "statusId",
      header: "ステータス",
      type: "select",
      options: statusOptions,
      filterable: true,
    },
    {
      key: "detailMemo",
      header: "詳細メモ",
      type: "textarea",
    },
    {
      key: "formAnswerDate",
      header: "フォーム回答日",
      type: "date",
    },
    {
      key: "formTranscriptDate",
      header: "フォーム転記日",
      type: "date",
    },
    {
      key: "applicationFormDate",
      header: "申請フォーム入力",
      type: "date",
    },
    {
      key: "documentStorageUrl",
      header: "資料保管",
      type: "text",
    },
    {
      key: "paymentReceivedDate",
      header: "着金日",
      type: "date",
    },
    {
      key: "paymentReceivedAmount",
      header: "着金額",
      type: "number",
      currency: true,
    },
    {
      key: "bbsTransferAmount",
      header: "BBSへの振込額",
      type: "number",
      currency: true,
    },
    {
      key: "bbsTransferDate",
      header: "BBSへの振込日",
      type: "date",
    },
    {
      key: "subsidyReceivedDate",
      header: "助成金着金日",
      type: "date",
    },
    {
      key: "vendorMemo",
      header: "ベンダー側メモ",
      editable: false,
    },
  ];

  const customRenderers: CustomRenderers = {
    lineFriendId: (value) => {
      const option = lineFriendOptions.find((opt) => opt.value === String(value));
      return option?.label || "-";
    },
    lineName: (_, row) => {
      const friendId = String(row.lineFriendId);
      return lineFriendNameMap[friendId] || (row.lineName as string) || "-";
    },
    referrer: (_, row) => {
      const friendId = String(row.lineFriendId);
      return lineFriendFree1Map[friendId] || "-";
    },
    vendorId: (value) => {
      if (!value) return "-";
      const option = vendorOptions.find((opt) => opt.value === String(value));
      return option?.label || "-";
    },
    statusId: (value) => {
      if (!value) return "-";
      const option = statusOptions.find((opt) => opt.value === String(value));
      return option?.label || "-";
    },
    documentStorageUrl: (value) => {
      if (!value) return "-";
      const url = String(value);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          リンク
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    },
  };

  const handleAdd = async (formData: Record<string, unknown>) => {
    await addApplicationSupport(formData);
    router.refresh();
  };

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    await updateApplicationSupport(id, formData);
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteApplicationSupport(id);
    router.refresh();
  };

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="申請管理"
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      emptyMessage="申請管理データが登録されていません"
      customRenderers={customRenderers}
    />
  );
}
