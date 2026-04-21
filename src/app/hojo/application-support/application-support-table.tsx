"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers, InlineEditConfig } from "@/components/crud-table";
import {
  updateApplicationSupport,
  addApplicationSupportRecord,
  deleteApplicationSupportRecord,
  acceptResolvedVendor,
  resolveVendorMismatch,
} from "./actions";
import { StatusManagementModal } from "./status-management-modal";
import { ExternalLink, Copy, Check, Settings, Plus, Trash2, AlertTriangle, Eye, FolderOpen, Loader2 } from "lucide-react";
import { RPA_DOC_LABELS } from "@/lib/hojo/rpa-document-config";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormAnswerEditModal, type FormSubmissionDataForModal } from "./form-answer-edit-modal";
import { DocumentStorageModal, type DocumentInfo } from "./document-storage-modal";

type DataRow = Record<string, unknown> & {
  id: number;
  lineFriendId: number;
  lineFriendUid: string;
  lineName: string;
  applicantName: string;
  vendorName: string;
  vendorId: string;
  vendorIdManual: boolean;
  groupSize: number;
  groupIndex: number;
  hasMismatch: boolean;
  mismatchResolvedVendorName: string | null;
  mismatchResolvedVendorId: number | null;
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
  const bbsDomain = process.env.NEXT_PUBLIC_BBS_DOMAIN || "https://bbs.alkes.jp";
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
function FormUrlCopyBtn({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/form/hojo-business-plan?uid=${uid}`
    : `/form/hojo-business-plan?uid=${uid}`;
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
  const [mismatchDialog, setMismatchDialog] = useState<DataRow | null>(null);
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
    { key: "groupSize", header: "", editable: false, hidden: true },
    { key: "groupIndex", header: "", editable: false, hidden: true },
    { key: "vendorIdManual", header: "", editable: false, hidden: true },
    { key: "hasMismatch", header: "", editable: false, hidden: true },
    { key: "mismatchResolvedVendorName", header: "", editable: false, hidden: true },
    { key: "mismatchResolvedVendorId", header: "", editable: false, hidden: true },
    { key: "lineFriendUid", header: "", editable: false, hidden: true },
    { key: "formSubmission", header: "", editable: false, hidden: true },
    {
      key: "rowNo",
      header: "No.",
      editable: false,
      width: 1,
      cellClassName: "text-center",
    },
    {
      key: "lineFriendId",
      header: "申請者番号",
      editable: false,
      filterable: true,
      width: 1,
      cellClassName: "text-center",
    },
    {
      key: "lineName",
      header: "LINE名",
      editable: false,
      filterable: true,
    },
    {
      key: "vendorName",
      header: "紹介元ベンダー",
      editable: false,
      filterable: true,
      inlineEditable: true,
    },
    {
      key: "vendorId",
      header: "紹介元ベンダー（編集用）",
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
      key: "formUrl",
      header: "情報回収フォームURL",
      editable: false,
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
    {
      key: "_actions",
      header: "操作",
      editable: false,
      width: 1,
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

      return (
        <div className="flex items-center gap-1">
          <span>{name}</span>
          {r.vendorIdManual && (
            <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">手動</span>
          )}
          {r.hasMismatch && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMismatchDialog(r); }}
                    className="text-amber-600 hover:text-amber-800"
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>free1の紹介元ベンダーと異なります: {r.mismatchResolvedVendorName || "なし"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      );
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
      if (!value) return "-";
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
      return <FormUrlCopyBtn uid={r.lineFriendUid} />;
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
    _actions: (_value, row) => {
      const r = row as unknown as DataRow;
      return (
        <div className="flex items-center gap-1">
          {r.groupIndex === 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const result = await addApplicationSupportRecord(r.lineFriendId);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("レコードを追加しました");
                      router.refresh();
                    }}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>同じLINEアカウントでレコード追加</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {r.groupSize > 1 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("このレコードを削除しますか？")) return;
                      const result = await deleteApplicationSupportRecord(r.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("レコードを削除しました");
                      router.refresh();
                    }}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>このレコードを削除</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

  const handleAcceptMismatch = async () => {
    if (!mismatchDialog) return;
    const result = await acceptResolvedVendor(
      mismatchDialog.id,
      mismatchDialog.mismatchResolvedVendorId
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("紹介元ベンダーを更新しました");
    setMismatchDialog(null);
    router.refresh();
  };

  const handleKeepMismatch = async () => {
    if (!mismatchDialog) return;
    const result = await resolveVendorMismatch(mismatchDialog.id, "keep");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("現在のベンダーを維持します");
    setMismatchDialog(null);
    router.refresh();
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
        groupByKey="lineFriendId"
        groupedColumns={["lineFriendId", "lineName"]}
        rowClassName={(item) => {
          const r = item as unknown as DataRow;
          const classes: string[] = [];
          if (r.groupSize > 1) {
            classes.push("bg-blue-50/30");
          }
          if (r.hasMismatch) {
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

      {/* 紹介元ベンダー不一致ダイアログ */}
      <Dialog open={!!mismatchDialog} onOpenChange={() => setMismatchDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              紹介元ベンダーの不一致
            </DialogTitle>
            <DialogDescription>
              free1（LINE紹介元データ）から判定されるベンダーと、現在設定されているベンダーが異なります。
            </DialogDescription>
          </DialogHeader>
          {mismatchDialog && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex-1">
                  <div className="text-gray-500">現在のベンダー</div>
                  <div className="font-medium">{mismatchDialog.vendorName || "なし"}</div>
                  {mismatchDialog.vendorIdManual && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-1 rounded">手動設定</span>
                  )}
                </div>
                <div className="text-gray-400">→</div>
                <div className="flex-1">
                  <div className="text-gray-500">free1からの判定</div>
                  <div className="font-medium">{mismatchDialog.mismatchResolvedVendorName || "なし"}</div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-1 rounded">自動判定</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleKeepMismatch}>
              現在のベンダーを維持
            </Button>
            <Button onClick={handleAcceptMismatch}>
              free1のベンダーに変更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {documentRow && (
        <DocumentStorageModal
          open
          onClose={() => setDocumentRowId(null)}
          applicationSupportId={documentRow.id}
          applicantName={documentRow.applicantName || documentRow.lineName}
          documents={documentRow.documents}
          currentSharedDate={documentRow.formTranscriptDate}
          runningByDocType={documentRow.runningByDocType}
        />
      )}
    </>
  );
}
