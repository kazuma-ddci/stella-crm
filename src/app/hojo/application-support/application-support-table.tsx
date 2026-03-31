"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers, InlineEditConfig } from "@/components/crud-table";
import { updateApplicationSupport } from "./actions";
import { StatusManagementModal } from "./status-management-modal";
import { ExternalLink, Copy, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type Props = {
  data: Record<string, unknown>[];
  vendorOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  allStatusOptions: { value: string; label: string }[];
  bbsStatusOptions: { value: string; label: string }[];
  allBbsStatusOptions: { value: string; label: string }[];
};

function BbsUrlButton() {
  const [copied, setCopied] = useState(false);
  const bbsUrl = typeof window !== "undefined"
    ? `${window.location.origin}/hojo/bbs`
    : "/hojo/bbs";

  const handleCopy = () => {
    navigator.clipboard.writeText(bbsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "コピー済み" : "BBS社様専用URL"}
    </Button>
  );
}

export function ApplicationSupportTable({
  data,
  vendorOptions,
  statusOptions,
  allStatusOptions,
  bbsStatusOptions,
  allBbsStatusOptions,
}: Props) {
  const router = useRouter();
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [bbsStatusModalOpen, setBbsStatusModalOpen] = useState(false);

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "lineFriendId",
      header: "申請者番号",
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
      key: "vendorName",
      header: "ベンダー",
      editable: false,
      filterable: true,
    },
    {
      key: "vendorId",
      header: "ベンダー（編集用）",
      type: "select",
      options: vendorOptions,
      searchable: true,
      filterable: true,
      hidden: true,
    },
    {
      key: "applicantName",
      header: "申請者名",
      type: "text",
      filterable: true,
      inlineEditable: true,
    },
    {
      key: "statusId",
      header: "自社ステータス",
      type: "select",
      options: statusOptions,
      filterable: true,
      inlineEditable: true,
    },
    {
      key: "bbsStatusId",
      header: "BBSステータス",
      editable: false,
      filterable: true,
    },
    {
      key: "detailMemo",
      header: "詳細メモ",
      type: "textarea",
      inlineEditable: true,
    },
    {
      key: "formAnswerDate",
      header: "フォーム回答日",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "formTranscriptDate",
      header: "フォーム転記日",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "applicationFormDate",
      header: "申請フォーム入力",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "documentStorageUrl",
      header: "資料保管",
      type: "text",
      inlineEditable: true,
    },
    {
      key: "subsidyDesiredDate",
      header: "助成金着金希望日",
      editable: false,
    },
    {
      key: "subsidyAmount",
      header: "助成金額",
      editable: false,
    },
    {
      key: "paymentReceivedAmount",
      header: "原資金額",
      type: "number",
      currency: true,
      inlineEditable: true,
    },
    {
      key: "paymentReceivedDate",
      header: "原資着金日",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "bbsTransferAmount",
      header: "BBSへの振込額",
      type: "number",
      currency: true,
      inlineEditable: true,
    },
    {
      key: "bbsTransferDate",
      header: "BBSへの振込日",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "subsidyReceivedDate",
      header: "助成金着金日",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "alkesMemo",
      header: "ALKES備考",
      type: "textarea",
      inlineEditable: true,
    },
    {
      key: "bbsMemo",
      header: "BBS備考",
      editable: false,
    },
    {
      key: "bbsNo",
      header: "BBS No.",
      editable: false,
    },
    {
      key: "vendorMemo",
      header: "ベンダー備考",
      editable: false,
    },
  ];

  const customRenderers: CustomRenderers = {
    vendorId: (value) => {
      if (!value) return "-";
      const option = vendorOptions.find((opt) => opt.value === String(value));
      return option?.label || "-";
    },
    statusId: (value) => {
      if (!value) return "-";
      const activeOption = statusOptions.find((opt) => opt.value === String(value));
      if (activeOption) return activeOption.label;
      // 非アクティブ or 削除済みステータス → 赤色表示
      const allOption = allStatusOptions.find((opt) => opt.value === String(value));
      return (
        <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-xs font-medium">
          {allOption?.label || `不明(ID:${value})`}
        </span>
      );
    },
    bbsStatusId: (value) => {
      if (!value) return "-";
      const activeOption = bbsStatusOptions.find((opt) => opt.value === String(value));
      if (activeOption) return activeOption.label;
      const allOption = allBbsStatusOptions.find((opt) => opt.value === String(value));
      return (
        <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-xs font-medium">
          {allOption?.label || `不明(ID:${value})`}
        </span>
      );
    },
    bbsNo: (value) => {
      if (!value) return "-";
      return String(value);
    },
    subsidyAmount: (value) => {
      if (!value) return "-";
      return `¥${Number(value).toLocaleString()}`;
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

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    await updateApplicationSupport(id, formData);
    router.refresh();
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="申請者管理"
        onUpdate={handleUpdate}
        emptyMessage="申請者管理データがありません"
        customRenderers={customRenderers}
        customAddButton={<BbsUrlButton />}
        enableInlineEdit
        skipInlineConfirm
        customHeaderRenderers={{
          statusId: () => (
            <button
              type="button"
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              onClick={() => setStatusModalOpen(true)}
            >
              自社ステータス
              <Settings className="h-3.5 w-3.5" />
            </button>
          ),
          bbsStatusId: () => (
            <button
              type="button"
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              onClick={() => setBbsStatusModalOpen(true)}
            >
              BBSステータス
              <Settings className="h-3.5 w-3.5" />
            </button>
          ),
        }}
      />
      <StatusManagementModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
      />
      <StatusManagementModal
        open={bbsStatusModalOpen}
        onOpenChange={setBbsStatusModalOpen}
        type="bbs"
      />
    </>
  );
}
