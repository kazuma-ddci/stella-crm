"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers, InlineEditConfig } from "@/components/crud-table";
import {
  updateApplicationSupport,
  approveGrantUsageChange,
  rejectGrantUsageChange,
  applyPendingBusinessPlanSubmission,
  rejectPendingBusinessPlanSubmission,
} from "./actions";
import { StatusManagementModal } from "./status-management-modal";
import { ExternalLink, Copy, Check, Settings, Eye, FolderOpen, Loader2 } from "lucide-react";
import { RPA_DOC_LABELS } from "@/lib/hojo/rpa-document-config";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FormAnswerEditModal, type FormSubmissionDataForModal } from "./form-answer-edit-modal";
import { DocumentStorageModal, type DocumentInfo } from "./document-storage-modal";
import { FormAnswerViewerModal } from "@/components/hojo/form-answer-viewer-modal";
import type { FileInfo } from "@/components/hojo/form-answer-editor";

type DataRow = Record<string, unknown> & {
  id: number;
  wholesaleAccountId: number;
  formToken: string;
  formUpdateStatus: string;
  hasPendingAnswers: boolean;
  pendingAnswers: Record<string, unknown> | null;
  pendingFileUrls: Record<string, FileInfo> | null;
  grantUsagePending: string;
  grantUsageApproved: string;
  grantUsageCurrent: string;
  applicantName: string;
  vendorName: string;
  vendorId: string;
  formSubmission: FormSubmissionDataForModal | null;
  documents: DocumentInfo[];
  subsidyAmount: number | null;
  formTranscriptDate: string | null;
  existingDocTypes: { trainingReport: boolean; supportApplication: boolean; businessPlan: boolean };
  runningByDocType: {
    trainingReport: string | null;
    supportApplication: string | null;
    businessPlan: string | null;
  };
};

type Props = {
  data: Record<string, unknown>[];
  vendorOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  allStatusOptions: { value: string; label: string }[];
  bbsStatusOptions: { value: string; label: string }[];
  allBbsStatusOptions: { value: string; label: string }[];
  canEditAnswers?: boolean;
};

function BbsUrlButton() {
  const [copied, setCopied] = useState(false);
  const bbsDomain = process.env.NEXT_PUBLIC_BBS_DOMAIN || "https://bbs.support-hubs.com";
  const bbsUrl = `${bbsDomain}/hojo/bbs`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bbsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "コピー済み" : "BBS共有用URL"}
      </Button>
      <Button variant="outline" size="sm" asChild className="gap-2">
        <a href="/hojo/bbs">
          <ExternalLink className="h-4 w-4" />
          BBS社内用
        </a>
      </Button>
    </div>
  );
}

// --- フォームURLコピーボタン ---
function FormUrlCopyBtn({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState(
    process.env.NEXT_PUBLIC_HOJO_CUSTOMER_DOMAIN || "",
  );
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_HOJO_CUSTOMER_DOMAIN) {
      queueMicrotask(() => setOrigin(window.location.origin));
    }
  }, []);
  const url = `${origin}/form/hojo-business-plan?t=${token}`;
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      }}
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
    >
      {copied ? <><Check className="h-3 w-3 text-green-500" />コピー済</> : <><Copy className="h-3 w-3" />コピー</>}
    </button>
  );
}

export function ApplicationSupportTable({
  data,
  vendorOptions,
  statusOptions,
  allStatusOptions,
  bbsStatusOptions,
  allBbsStatusOptions,
  canEditAnswers,
}: Props) {
  const router = useRouter();
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [bbsStatusModalOpen, setBbsStatusModalOpen] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<DataRow | null>(null);
  const [viewSubmission, setViewSubmission] = useState<{
    data: FormSubmissionDataForModal;
    applicationSupportId: number;
  } | null>(null);
  const [documentRowId, setDocumentRowId] = useState<number | null>(null);
  // 再生成などで documents が更新されたとき、モーダルに最新の行を渡すため毎レンダリング参照し直す
  const documentRow =
    documentRowId != null
      ? (data as DataRow[]).find((r) => r.id === documentRowId) ?? null
      : null;

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "formToken", header: "", editable: false, hidden: true },
    { key: "formSubmission", header: "", editable: false, hidden: true },
    {
      key: "rowNo",
      header: "No.",
      editable: false,
      width: 1,
      cellClassName: "text-center",
    },
    {
      key: "wholesaleAccountId",
      header: "顧客リストNo.",
      editable: false,
      filterable: true,
      width: 1,
      cellClassName: "text-center",
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
      editable: false,
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
      key: "formUrl",
      header: "情報回収フォームURL",
      editable: false,
    },
    {
      key: "formUpdateStatus",
      header: "フォーム更新状況",
      editable: false,
      filterable: true,
    },
    {
      key: "formAnswerDate",
      header: "情報回収フォーム回答日",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "formAnswerData",
      header: "回答データ",
      editable: false,
    },
    {
      key: "documentStorageUrl",
      header: "資料保管",
      editable: false,
    },
    {
      key: "formTranscriptDate",
      header: "フォーム内容確定日",
      type: "date",
      inlineEditable: true,
    },
    {
      key: "applicationFormDate",
      header: "支援制度申請フォーム回答日",
      editable: false,
    },
    {
      key: "subsidyDesiredDate",
      header: "助成金着金希望日",
      editable: false,
    },
    {
      key: "subsidyAmount",
      header: "助成金額",
      type: "number",
      currency: true,
      inlineEditable: true,
    },
    {
      key: "paymentReceivedAmount",
      header: "原資金額",
      type: "number",
      currency: true,
      editable: false,
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
      editable: false,
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
      editable: false,
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

  const inlineEditConfig: InlineEditConfig = {
    displayToEditMapping: {
      vendorName: "vendorId",
    },
  };

  const customRenderers: CustomRenderers = {
    rowNo: (value) => {
      return <span className="text-gray-500 text-xs">{String(value)}</span>;
    },
    vendorName: (_value, row) => {
      const r = row as unknown as DataRow;
      const name = r.vendorName || "-";
      return <span>{name}</span>;
    },
    vendorId: (value) => {
      if (!value) return "-";
      const option = vendorOptions.find((opt) => opt.value === String(value));
      return option?.label || "-";
    },
    statusId: (value) => {
      if (!value) return "-";
      const activeOption = statusOptions.find((opt) => opt.value === String(value));
      if (activeOption) return activeOption.label;
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
      if (value == null || value === "") return "-";
      return `¥${Number(value).toLocaleString()}`;
    },
    paymentReceivedAmount: (value) => {
      if (value == null || value === "") return "-";
      return `¥${Number(value).toLocaleString()}`;
    },
    bbsTransferAmount: (value) => {
      if (value == null || value === "") return "-";
      return `¥${Number(value).toLocaleString()}`;
    },
    formAnswerData: (_value, row) => {
      const r = row as unknown as DataRow;
      if (!r.formSubmission) return <span className="text-gray-400">-</span>;
      const sub = r.formSubmission;
      const isConfirmed = !!sub.confirmedAt;
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setViewSubmission({ data: sub, applicationSupportId: r.id });
          }}
          className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${
            isConfirmed
              ? "text-green-700 hover:text-green-900"
              : "text-blue-600 hover:text-blue-800"
          }`}
        >
          <Eye className="h-3 w-3" />
          {isConfirmed ? "確定済・編集" : "回答を編集"}
        </button>
      );
    },
    formUrl: (_value, row) => {
      const r = row as unknown as DataRow;
      return r.formToken ? <FormUrlCopyBtn token={r.formToken} /> : <span className="text-gray-400">-</span>;
    },
    formUpdateStatus: (value, row) => {
      const r = row as unknown as DataRow;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>{String(value || "未送信")}</span>
          {r.hasPendingAnswers && canEditAnswers && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPendingPreview(r); }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                内容確認
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  const result = await applyPendingBusinessPlanSubmission(r.id);
                  if (!result.ok) toast.error(result.error);
                  else { toast.success("修正申請を反映しました"); router.refresh(); }
                }}
                className="text-xs text-green-700 hover:text-green-900"
              >
                反映
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  const result = await rejectPendingBusinessPlanSubmission(r.id);
                  if (!result.ok) toast.error(result.error);
                  else { toast.success("修正申請を却下しました"); router.refresh(); }
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                却下
              </button>
            </>
          )}
          {r.grantUsagePending && canEditAnswers && (
            <>
              <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                助成金利用 {r.grantUsageApproved || "-"} → {r.grantUsagePending} 承認待ち
              </span>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  const result = await approveGrantUsageChange(r.id);
                  if (!result.ok) toast.error(result.error);
                  else { toast.success("助成金利用の変更を承認しました"); router.refresh(); }
                }}
                className="text-xs text-green-700 hover:text-green-900"
              >
                承認
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  const result = await rejectGrantUsageChange(r.id);
                  if (!result.ok) toast.error(result.error);
                  else { toast.success("助成金利用の変更を却下しました"); router.refresh(); }
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                却下
              </button>
            </>
          )}
        </div>
      );
    },
    documentStorageUrl: (value, row) => {
      const r = row as unknown as DataRow;
      const url = value ? String(value) : "";
      const hasDocuments = r.documents.length > 0;
      // 走っている資料を全部ピックアップ（複数同時実行対応）
      const runningLabels: string[] = [];
      if (r.runningByDocType.trainingReport) runningLabels.push(RPA_DOC_LABELS.trainingReport);
      if (r.runningByDocType.supportApplication) runningLabels.push(RPA_DOC_LABELS.supportApplication);
      if (r.runningByDocType.businessPlan) runningLabels.push(RPA_DOC_LABELS.businessPlan);
      const runningLabel = runningLabels.length > 0 ? runningLabels.join("・") : null;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDocumentRowId(r.id);
            }}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <FolderOpen className="h-3 w-3" />
            資料保管
            {hasDocuments && (
              <span className="ml-0.5 text-[10px] bg-blue-100 text-blue-800 px-1 rounded">
                {r.documents.length}
              </span>
            )}
          </button>
          {runningLabel && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    生成中
                  </span>
                </TooltipTrigger>
                <TooltipContent>{runningLabel}を生成中です</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              外部URL
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
    },
  };

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    const result = await updateApplicationSupport(id, formData);
    if (result.ok) router.refresh();
    return result;
  };

  return (
    <>
      <CrudTable
        tableId="hojo.application-support"
        data={data}
        columns={columns}
        title="申請者管理"
        onUpdate={handleUpdate}
        emptyMessage="申請者管理データがありません"
        customRenderers={customRenderers}
        customAddButton={<BbsUrlButton />}
        enableInlineEdit
        skipInlineConfirm
        inlineEditConfig={inlineEditConfig}
        rowClassName={(item) => {
          const r = item as unknown as DataRow;
          const classes: string[] = [];
          if (r.grantUsagePending) {
            classes.push("!bg-amber-50");
          }
          return classes.length > 0 ? classes.join(" ") : undefined;
        }}
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

      {viewSubmission && (() => {
        const row = (data as DataRow[]).find((r) => r.id === viewSubmission.applicationSupportId);
        return (
          <FormAnswerEditModal
            data={viewSubmission.data}
            thisApplicationSupportId={viewSubmission.applicationSupportId}
            canEdit={!!canEditAnswers}
            open={true}
            onClose={() => setViewSubmission(null)}
            subsidyAmount={row?.subsidyAmount ?? null}
            existingDocTypes={
              row?.existingDocTypes ?? {
                trainingReport: false,
                supportApplication: false,
                businessPlan: false,
              }
            }
          />
        );
      })()}

      {pendingPreview?.pendingAnswers && (
        <FormAnswerViewerModal
          open
          onClose={() => setPendingPreview(null)}
          size="form"
          answers={pendingPreview.pendingAnswers}
          modifiedAnswers={null}
          fileUrls={pendingPreview.pendingFileUrls}
          description="お客様から再送信された修正申請内容です。正式回答へ反映する場合は、フォーム更新状況列の「反映」を押してください。"
        />
      )}

      {documentRow && (
        <DocumentStorageModal
          open
          onClose={() => setDocumentRowId(null)}
          applicationSupportId={documentRow.id}
          applicantName={documentRow.applicantName || `顧客リストNo.${documentRow.wholesaleAccountId}`}
          documents={documentRow.documents}
          currentSharedDate={documentRow.formTranscriptDate}
          runningByDocType={documentRow.runningByDocType}
        />
      )}
    </>
  );
}
