"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  addMasterContract,
  updateMasterContract,
  deleteMasterContract,
  getNextContractNumber,
  getMasterContracts,
} from "@/app/stp/master-contract-actions";
import {
  syncContractCloudsignStatus,
  toggleCloudsignAutoSync,
  linkCloudsignDocument,
  getCloudsignModalData,
  getDraftsForCompany,
  deleteDraftContract,
  remindCloudsignDocument,
  getCloudsignSelfSigningUrl,
} from "@/app/stp/cloudsign-actions";
import {
  getContractHistories,
  addContractHistory,
  updateContractHistory,
  deleteContractHistory,
  linkContractHistoryToContract,
  getStaffList,
  ContractHistoryData,
} from "@/app/stp/companies/contract-history-actions";
import { Plus, Pencil, Trash2, X, FileText, ExternalLink, Send, Loader2, Play, RotateCcw, Link2, PenTool, MoreVertical, Copy, RefreshCw, Pause, ChevronDown, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { FileUpload } from "@/components/file-upload";
import { toLocalDateString } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { useTimedFormCache } from "@/hooks/use-timed-form-cache";
import { ContractSendModal } from "@/components/contract-send-modal";
import { JOB_MEDIA_OPTIONS, isInvalidJobMedia } from "@/lib/stp/job-media";

// 日本語ロケールを登録
registerLocale("ja", ja);

type ContractHistory = {
  id: number;
  industryType: string;
  contractPlan: string;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
  salesStaffId: number | null;
  salesStaffName: string | null;
  operationStaffId: number | null;
  operationStaffName: string | null;
  status: string;
  operationStatus: string | null;
  accountId: string | null;
  accountPass: string | null;
  note: string | null;
  masterContractId: number | null;
  contractDate: string | null;
};

type Contract = {
  id: number;
  contractType: string;
  title: string;
  contractNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currentStatusId?: number | null;
  currentStatusName?: string | null;
  signedDate?: string | null;
  signingMethod?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  assignedTo?: string | null;
  note?: string | null;
  cloudsignDocumentId?: string | null;
  cloudsignStatus?: string | null;
  cloudsignUrl?: string | null;
  cloudsignAutoSync?: boolean;
  cloudsignLastRemindedAt?: string | null;
  cloudsignExpectedStatusName?: string | null;
  cloudsignSelfSigningEmailId?: number | null;
  cloudsignSelfSignedAt?: string | null;
  cloudsignSelfSigningUrl?: string | null;
  parentContractId?: number | null;
  parentContract?: {
    id: number;
    contractNumber: string | null;
    title: string;
    contractType: string;
  } | null;
  contractHistories: ContractHistory[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  contractStatusOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  contractTypeOptions: { value: string; label: string }[];
};

const signingMethodOptions = [
  { value: "cloudsign", label: "クラウドサイン" },
  { value: "paper", label: "紙" },
  { value: "other", label: "その他" },
];

type FormData = {
  contractType: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  currentStatusId: string;
  signedDate: Date | null;
  signingMethod: string;
  filePath: string;
  fileName: string;
  assignedTo: string;
  note: string;
  cloudsignDocumentId: string;
  parentContractId: string;
};

const EMPTY_FORM_DATA: FormData = {
  contractType: "",
  title: "",
  startDate: null,
  endDate: null,
  currentStatusId: "",
  signedDate: null,
  signingMethod: "",
  filePath: "",
  fileName: "",
  assignedTo: "",
  note: "",
  cloudsignDocumentId: "",
  parentContractId: "",
};

// 契約履歴フォーム
type HistoryFormData = {
  industryType: string;
  contractPlan: string;
  jobMedia: string;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  contractDate: Date | null;
  initialFee: string;
  monthlyFee: string;
  performanceFee: string;
  salesStaffId: string;
  operationStaffId: string;
  status: string;
  note: string;
  operationStatus: string;
  accountId: string;
  accountPass: string;
  masterContractId: string;
};

const EMPTY_HISTORY_FORM: HistoryFormData = {
  industryType: "general",
  contractPlan: "monthly",
  jobMedia: "",
  contractStartDate: null,
  contractEndDate: null,
  contractDate: null,
  initialFee: "0",
  monthlyFee: "150000",
  performanceFee: "0",
  salesStaffId: "",
  operationStaffId: "",
  status: "active",
  note: "",
  operationStatus: "",
  accountId: "",
  accountPass: "",
  masterContractId: "",
};

// 選択肢定義
const industryTypeOptions = [
  { value: "general", label: "一般" },
  { value: "dispatch", label: "派遣" },
];

const contractPlanOptions = [
  { value: "monthly", label: "月額" },
  { value: "performance", label: "成果報酬" },
];


const statusOptions = [
  { value: "active", label: "契約中" },
  { value: "scheduled", label: "契約予定" },
  { value: "cancelled", label: "解約" },
  { value: "dormant", label: "休眠" },
];

const operationStatusOptions = [
  { value: "テスト1", label: "テスト1" },
  { value: "テスト2", label: "テスト2" },
];

const jobMediaOptions = JOB_MEDIA_OPTIONS;

function calculateMonthlyFee(industryType: string, contractPlan: string): number {
  if (contractPlan === "performance") return 0;
  if (industryType === "dispatch") return 300000;
  return 150000;
}

function calculatePerformanceFee(contractPlan: string): number {
  if (contractPlan === "performance") return 150000;
  return 0;
}

function formatCurrency(value: number): string {
  return value.toLocaleString() + "円";
}

// --- 共通ラベル定義 ---
const planLabels: Record<string, string> = { monthly: "月額", performance: "成果報酬" };
const industryLabels: Record<string, string> = { general: "一般", dispatch: "派遣" };
const statusLabels: Record<string, string> = { active: "契約中", scheduled: "契約予定", cancelled: "解約", dormant: "休眠" };

// --- 契約履歴の詳細表示 ---
function ContractHistoryDetail({
  history,
  onEdit,
  onDelete,
}: {
  history: ContractHistory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs px-1">
        <div>
          <span className="text-gray-400">業種区分:</span>{" "}
          <span className="text-gray-700">{industryLabels[history.industryType] || history.industryType}</span>
        </div>
        <div>
          <span className="text-gray-400">契約プラン:</span>{" "}
          <span className="text-gray-700">{planLabels[history.contractPlan] || history.contractPlan}</span>
        </div>
        <div>
          <span className="text-gray-400">求人媒体:</span>{" "}
          <span className="text-gray-700">{history.jobMedia || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">ステータス:</span>{" "}
          <span className="text-gray-700">{statusLabels[history.status] || history.status}</span>
        </div>
        <div>
          <span className="text-gray-400">契約開始日:</span>{" "}
          <span className="text-gray-700">{new Date(history.contractStartDate).toLocaleDateString("ja-JP")}</span>
        </div>
        <div>
          <span className="text-gray-400">契約終了日:</span>{" "}
          <span className="text-gray-700">{history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">契約日:</span>{" "}
          <span className="text-gray-700">{history.contractDate ? new Date(history.contractDate).toLocaleDateString("ja-JP") : "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">初期費用:</span>{" "}
          <span className="text-gray-700">{history.initialFee.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-gray-400">月額:</span>{" "}
          <span className="text-gray-700">{history.monthlyFee.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-gray-400">成果報酬単価:</span>{" "}
          <span className="text-gray-700">{history.performanceFee.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-gray-400">担当営業:</span>{" "}
          <span className="text-gray-700">{history.salesStaffName || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">担当運用:</span>{" "}
          <span className="text-gray-700">{history.operationStaffName || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">運用ステータス:</span>{" "}
          <span className="text-gray-700">{history.operationStatus || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">アカウントID:</span>{" "}
          <span className="text-gray-700">{history.accountId || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">アカウントPASS:</span>{" "}
          <span className="text-gray-700">{history.accountPass || "-"}</span>
        </div>
        {history.note && (
          <div className="col-span-2">
            <span className="text-gray-400">備考:</span>{" "}
            <span className="text-gray-700 whitespace-pre-wrap">{history.note}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1" />
          編集
        </Button>
        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          削除
        </Button>
      </div>
    </div>
  );
}

// --- ContractHistoryRow ---
function ContractHistoryRow({
  history,
  onEdit,
  onDelete,
}: {
  history: ContractHistory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 group cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button type="button" className="w-4 shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{industryLabels[history.industryType] || history.industryType}</Badge>
            <Badge variant="outline" className="text-[10px]">{planLabels[history.contractPlan] || history.contractPlan}</Badge>
            {history.jobMedia && <Badge variant="outline" className="text-[10px]">{history.jobMedia}</Badge>}
            <span className="text-xs text-gray-500">
              {new Date(history.contractStartDate).toLocaleDateString("ja-JP")}〜
              {history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : ""}
            </span>
            <Badge variant={history.status === "active" ? "default" : "secondary"} className="text-[10px]">
              {statusLabels[history.status] || history.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            {history.initialFee > 0 && <span>初期: {history.initialFee.toLocaleString()}円</span>}
            {history.monthlyFee > 0 && <span>月額: {history.monthlyFee.toLocaleString()}円</span>}
            {history.performanceFee > 0 && <span>成果: {history.performanceFee.toLocaleString()}円</span>}
            {history.salesStaffName && <span>営業: {history.salesStaffName}</span>}
            {history.operationStaffName && <span>運用: {history.operationStaffName}</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 pt-1 ml-7 border-l-2 border-gray-100">
          <ContractHistoryDetail history={history} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

// --- ContractHistoryCard (for unlinked histories) ---
function ContractHistoryCard({
  history,
  onEdit,
  onDelete,
  contracts,
  onLink,
}: {
  history: ContractHistory & { companyId?: number };
  onEdit: () => void;
  onDelete: () => void;
  contracts: Contract[];
  onLink: (historyId: number, contractId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg hover:bg-gray-50 group">
      <div
        className="p-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button type="button" className="w-4 shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{industryLabels[history.industryType] || history.industryType}</Badge>
            <Badge variant="outline" className="text-[10px]">{planLabels[history.contractPlan] || history.contractPlan}</Badge>
            {history.jobMedia && <Badge variant="outline" className="text-[10px]">{history.jobMedia}</Badge>}
            <span className="text-xs text-gray-500">
              {new Date(history.contractStartDate).toLocaleDateString("ja-JP")}〜
              {history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : ""}
            </span>
            <Badge variant={history.status === "active" ? "default" : "secondary"} className="text-[10px]">
              {statusLabels[history.status] || history.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            {history.initialFee > 0 && <span>初期: {history.initialFee.toLocaleString()}円</span>}
            {history.monthlyFee > 0 && <span>月額: {history.monthlyFee.toLocaleString()}円</span>}
            {history.performanceFee > 0 && <span>成果: {history.performanceFee.toLocaleString()}円</span>}
            {history.salesStaffName && <span>営業: {history.salesStaffName}</span>}
            {history.operationStaffName && <span>運用: {history.operationStaffName}</span>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {contracts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" title="契約書に紐づける">
                  <Link2 className="h-3.5 w-3.5 text-blue-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500">契約書に紐づける</div>
                <DropdownMenuSeparator />
                {contracts.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => onLink(history.id, c.id)}
                  >
                    <FileText className="h-3.5 w-3.5 mr-2 text-gray-400" />
                    <span className="truncate">{c.contractNumber} {c.contractType} - {c.title}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 ml-7 border-t border-gray-100">
          <ContractHistoryDetail history={history} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

// --- ContractCard ---
function ContractCard({
  contract,
  contracts,
  onEdit,
  onDelete,
  onEditHistory,
  onDeleteHistory,
  onAddHistoryForContract,
  formatDate,
  // CloudSign related
  cloudsignData,
  setCloudsignData,
  loadingCloudsign,
  setLoadingCloudsign,
  loadingDrafts,
  setLoadingDrafts,
  syncingContractId,
  setSyncingContractId,
  togglingAutoSyncId,
  setTogglingAutoSyncId,
  linkingContractId,
  setLinkingContractId,
  remindingContractId,
  setRemindingContractId,
  fetchingSigningUrlId,
  setFetchingSigningUrlId,
  deletingDraftId,
  setDeletingDraftId,
  loadContracts,
  companyId,
  setResumeDraft,
  setSendModalOpen,
  setDrafts,
  setDraftSelectOpen,
  router,
}: {
  contract: Contract;
  contracts: Contract[];
  onEdit: () => void;
  onDelete: () => void;
  onEditHistory: (history: ContractHistory) => void;
  onDeleteHistory: (historyId: number) => void;
  onAddHistoryForContract: (contractId: number) => void;
  formatDate: (dateStr: string | null | undefined) => string;
  cloudsignData: {
    contractTypes: { id: number; name: string; templates: { id: number; cloudsignTemplateId: string; name: string; description: string | null }[] }[];
    contacts: { id: number; name: string; email: string | null; position: string | null }[];
    operatingCompany: { id: number; companyName: string; cloudsignClientId: string | null } | null;
    projectId: number;
  } | null;
  setCloudsignData: (data: {
    contractTypes: { id: number; name: string; templates: { id: number; cloudsignTemplateId: string; name: string; description: string | null }[] }[];
    contacts: { id: number; name: string; email: string | null; position: string | null }[];
    operatingCompany: { id: number; companyName: string; cloudsignClientId: string | null } | null;
    projectId: number;
  } | null) => void;
  loadingCloudsign: boolean;
  setLoadingCloudsign: (v: boolean) => void;
  loadingDrafts: boolean;
  setLoadingDrafts: (v: boolean) => void;
  syncingContractId: number | null;
  setSyncingContractId: (v: number | null) => void;
  togglingAutoSyncId: number | null;
  setTogglingAutoSyncId: (v: number | null) => void;
  linkingContractId: number | null;
  setLinkingContractId: (v: number | null) => void;
  remindingContractId: number | null;
  setRemindingContractId: (v: number | null) => void;
  fetchingSigningUrlId: number | null;
  setFetchingSigningUrlId: (v: number | null) => void;
  deletingDraftId: number | null;
  setDeletingDraftId: (v: number | null) => void;
  loadContracts: () => Promise<void>;
  companyId: number;
  setResumeDraft: (v: {
    contractId: number;
    contractNumber: string;
    cloudsignDocumentId: string;
    contractType: string;
    title: string;
    cloudsignTitle?: string | null;
    assignedTo?: string | null;
    note?: string | null;
  } | undefined) => void;
  setSendModalOpen: (v: boolean) => void;
  setDrafts: (v: {
    id: number;
    contractNumber: string;
    title: string;
    contractType: string;
    cloudsignDocumentId: string | null;
    cloudsignTitle: string | null;
    assignedTo: string | null;
    note: string | null;
    createdAt: string;
  }[]) => void;
  setDraftSelectOpen: (v: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border rounded-lg">
      {/* ヘッダー（契約書情報） */}
      <div className="p-3 flex items-start gap-3 bg-gray-50/50">
        <button onClick={() => setExpanded(!expanded)} className="mt-0.5">
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-500">{contract.contractNumber}</span>
            <Badge variant="outline" className="text-xs">{contract.contractType}</Badge>
            <span className="font-medium text-sm truncate">{contract.title}</span>
            {contract.currentStatusName && (
              <Badge variant="secondary" className="text-xs">{contract.currentStatusName}</Badge>
            )}
            {/* CloudSign status badge */}
            {contract.cloudsignDocumentId && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium cursor-pointer hover:opacity-80 ${
                  contract.cloudsignStatus === "completed"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : contract.cloudsignStatus === "sent"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : contract.cloudsignStatus?.startsWith("canceled")
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-gray-50 text-gray-600 border border-gray-200"
                }`}
                onClick={() => window.open(contract.cloudsignUrl || `https://www.cloudsign.jp/documents/${contract.cloudsignDocumentId}`, "_blank")}
                title="CloudSignで開く"
              >
                {contract.cloudsignStatus === "sent" ? "送付済" :
                 contract.cloudsignStatus === "completed" ? "締結済" :
                 contract.cloudsignStatus === "draft" ? "下書き" :
                 contract.cloudsignStatus?.startsWith("canceled") ? "破棄" :
                 contract.cloudsignStatus || "-"}
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </span>
            )}
            {contract.cloudsignDocumentId && contract.cloudsignAutoSync === false && (
              <span className="inline-flex items-center rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 border border-orange-200">
                停止中
              </span>
            )}
            {contract.cloudsignSelfSigningEmailId && contract.cloudsignSelfSignedAt && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 border border-green-200">
                <PenTool className="h-2.5 w-2.5" />
                自社署名済
              </span>
            )}
          </div>
          {contract.parentContract && (
            <p className="text-xs text-gray-500 mt-0.5">
              親契約: {contract.parentContract.contractNumber} {contract.parentContract.contractType}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {contract.signedDate && <span>締結日: {formatDate(contract.signedDate)}</span>}
            {contract.signingMethod && <span>方法: {signingMethodOptions.find(o => o.value === contract.signingMethod)?.label}</span>}
            {contract.filePath && contract.fileName && (
              <button
                className="text-blue-600 hover:underline flex items-center gap-0.5"
                onClick={() => window.open(contract.filePath!, "_blank")}
              >
                <FileText className="h-3 w-3" />
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {/* CloudSign actions for sent status */}
          {contract.cloudsignStatus === "sent" && (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-40"
                disabled={remindingContractId === contract.id}
                onClick={async () => {
                  if (!confirm("先方にリマインドメールを送信しますか？")) return;
                  setRemindingContractId(contract.id);
                  try {
                    const result = await remindCloudsignDocument(contract.id);
                    if (result.success) {
                      toast.success("リマインドを送信しました");
                      await loadContracts();
                    } else {
                      toast.error(result.error ?? "リマインドの送信に失敗しました");
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error("リマインドの送信に失敗しました");
                  } finally {
                    setRemindingContractId(null);
                  }
                }}
              >
                {remindingContractId === contract.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                催促
              </button>
              {contract.cloudsignSelfSigningEmailId && !contract.cloudsignSelfSignedAt && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-40"
                  disabled={fetchingSigningUrlId === contract.id}
                  title="CloudSignに送信者アカウントでログイン中の場合は、シークレットウィンドウで開くか、メールのリンクから署名してください。"
                  onClick={async () => {
                    if (contract.cloudsignSelfSigningUrl) {
                      window.open(contract.cloudsignSelfSigningUrl, "_blank");
                      return;
                    }
                    setFetchingSigningUrlId(contract.id);
                    try {
                      const result = await getCloudsignSelfSigningUrl(contract.id);
                      if (result.url) {
                        window.open(result.url, "_blank");
                        await loadContracts();
                      } else {
                        toast.info("署名用URLがまだ届いていません。しばらく経ってからお試しください。");
                      }
                    } catch (error) {
                      console.error(error);
                      toast.error("署名用URLの取得に失敗しました");
                    } finally {
                      setFetchingSigningUrlId(null);
                    }
                  }}
                >
                  {fetchingSigningUrlId === contract.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PenTool className="h-3 w-3" />
                  )}
                  署名
                </button>
              )}
            </>
          )}
          {/* CloudSign menu */}
          {contract.cloudsignDocumentId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  disabled={syncingContractId === contract.id}
                  onClick={async () => {
                    setSyncingContractId(contract.id);
                    try {
                      const result = await syncContractCloudsignStatus(contract.id);
                      if (result.previousStatus === result.newStatus) {
                        toast.info("ステータスに変更はありません");
                      } else {
                        toast.success(`ステータスを同期しました: ${result.previousStatus} → ${result.newStatus}`);
                      }
                      await loadContracts();
                      router.refresh();
                    } catch (error) {
                      console.error(error);
                      toast.error("同期に失敗しました");
                    } finally {
                      setSyncingContractId(null);
                    }
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  {syncingContractId === contract.id ? "同期中..." : "手動で同期"}
                </DropdownMenuItem>
                {contract.cloudsignStatus !== "completed" &&
                 !contract.cloudsignStatus?.startsWith("canceled") && (
                  <DropdownMenuItem
                    disabled={togglingAutoSyncId === contract.id}
                    onClick={async () => {
                      const newState = !contract.cloudsignAutoSync;
                      if (!newState) {
                        if (!confirm("CloudSign側のステータス変更がCRMに反映されなくなります。よろしいですか？")) return;
                      }
                      setTogglingAutoSyncId(contract.id);
                      try {
                        await toggleCloudsignAutoSync(contract.id, newState);
                        toast.success(newState ? "自動同期をONにしました" : "自動同期をOFFにしました");
                        await loadContracts();
                        router.refresh();
                      } catch (error) {
                        console.error(error);
                        toast.error("切替に失敗しました");
                      } finally {
                        setTogglingAutoSyncId(null);
                      }
                    }}
                  >
                    <Pause className="h-3.5 w-3.5 mr-2" />
                    {togglingAutoSyncId === contract.id
                      ? "切替中..."
                      : contract.cloudsignAutoSync
                      ? "自動同期を停止"
                      : "自動同期を再開"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(contract.cloudsignDocumentId || "");
                    toast.success("ドキュメントIDをコピーしました");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  <span className="truncate">ID: {contract.cloudsignDocumentId?.slice(0, 12)}...</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Draft resume button */}
          {contract.cloudsignStatus === "draft" && contract.cloudsignDocumentId && (
            <Button
              variant="ghost"
              size="sm"
              title="送付を再開"
              onClick={async () => {
                if (!cloudsignData) {
                  setLoadingCloudsign(true);
                  try {
                    const data = await getCloudsignModalData(companyId);
                    setCloudsignData(data);
                    if (!data.operatingCompany?.cloudsignClientId) {
                      toast.error("クラウドサインのクライアントIDが未設定です");
                      return;
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error("クラウドサイン情報の取得に失敗しました");
                    return;
                  } finally {
                    setLoadingCloudsign(false);
                  }
                }
                setResumeDraft({
                  contractId: contract.id,
                  contractNumber: contract.contractNumber || "",
                  cloudsignDocumentId: contract.cloudsignDocumentId!,
                  contractType: contract.contractType,
                  title: contract.title,
                });
                setSendModalOpen(true);
              }}
            >
              <Play className="h-4 w-4 text-blue-500" />
            </Button>
          )}
          {/* Edit/Delete buttons */}
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          {contract.cloudsignStatus === "draft" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingDraftId === contract.id}
              onClick={async () => {
                if (!confirm("この下書きを削除しますか？CloudSign側のドラフトも削除されます。")) return;
                setDeletingDraftId(contract.id);
                try {
                  await deleteDraftContract(contract.id);
                  toast.success("下書きを削除しました");
                  await loadContracts();
                  router.refresh();
                } catch (error) {
                  console.error(error);
                  toast.error("削除に失敗しました");
                } finally {
                  setDeletingDraftId(null);
                }
              }}
            >
              {deletingDraftId === contract.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              )}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
          )}
          {/* Link CloudSign by ID */}
          {!contract.cloudsignDocumentId && (
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:text-blue-600 underline decoration-dotted underline-offset-2 disabled:opacity-50"
              disabled={linkingContractId === contract.id}
              onClick={async () => {
                const docId = prompt("CloudSignのドキュメントIDを入力してください");
                if (!docId?.trim()) return;
                if (!confirm(`ドキュメントID「${docId.trim()}」で同期しますか？`)) return;
                setLinkingContractId(contract.id);
                try {
                  const result = await linkCloudsignDocument(contract.id, docId.trim());
                  toast.success(`CloudSignと紐付けました（ステータス: ${result.newStatus}）`);
                  await loadContracts();
                  router.refresh();
                } catch (error) {
                  console.error(error);
                  toast.error("紐付けに失敗しました。ドキュメントIDが正しいか確認してください。");
                } finally {
                  setLinkingContractId(null);
                }
              }}
            >
              {linkingContractId === contract.id ? (
                <span className="flex items-center gap-0.5"><Loader2 className="h-2.5 w-2.5 animate-spin" /> 紐付け中...</span>
              ) : (
                <Link2 className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 展開部分（契約履歴） */}
      {expanded && (
        <div className="border-t">
          {contract.contractHistories.length > 0 ? (
            <div className="divide-y">
              {contract.contractHistories.map((history) => (
                <ContractHistoryRow
                  key={history.id}
                  history={history}
                  onEdit={() => onEditHistory(history)}
                  onDelete={() => onDeleteHistory(history.id)}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-2 text-xs text-gray-400">紐づく契約履歴なし</div>
          )}
          <div className="px-4 py-2 border-t bg-gray-50/30">
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              onClick={() => onAddHistoryForContract(contract.id)}
            >
              <Plus className="h-3 w-3" />
              この契約書に契約履歴を追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
export function MasterContractModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  contractStatusOptions,
  staffOptions,
  contractTypeOptions,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM_DATA);
  const [localContracts, setLocalContracts] = useState<Contract[]>([]);
  const [nextContractNumber, setNextContractNumber] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [syncingContractId, setSyncingContractId] = useState<number | null>(null);
  const [togglingAutoSyncId, setTogglingAutoSyncId] = useState<number | null>(null);
  const [linkingContractId, setLinkingContractId] = useState<number | null>(null);
  const [remindingContractId, setRemindingContractId] = useState<number | null>(null);
  const [fetchingSigningUrlId, setFetchingSigningUrlId] = useState<number | null>(null);

  // 契約履歴フォーム
  const historyFormRef = useRef<HTMLDivElement>(null);
  const [historyFormOpen, setHistoryFormOpen] = useState(false);
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [historyFormData, setHistoryFormData] = useState<HistoryFormData>(EMPTY_HISTORY_FORM);
  const [historyStaffOptions, setHistoryStaffOptions] = useState<{
    salesOptions: { value: string; label: string }[];
    operationOptions: { value: string; label: string }[];
  }>({ salesOptions: [], operationOptions: [] });
  const [isManualMonthlyFee, setIsManualMonthlyFee] = useState(false);
  const [isManualPerformanceFee, setIsManualPerformanceFee] = useState(false);

  // 紐づかない契約履歴
  const [unlinkedHistories, setUnlinkedHistories] = useState<(ContractHistory & { companyId?: number })[]>([]);

  // 下書き管理
  const [draftSelectOpen, setDraftSelectOpen] = useState(false);
  const [drafts, setDrafts] = useState<{
    id: number;
    contractNumber: string;
    title: string;
    contractType: string;
    cloudsignDocumentId: string | null;
    cloudsignTitle: string | null;
    assignedTo: string | null;
    note: string | null;
    createdAt: string;
  }[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null);
  const [resumeDraft, setResumeDraft] = useState<{
    contractId: number;
    contractNumber: string;
    cloudsignDocumentId: string;
    contractType: string;
    title: string;
    cloudsignTitle?: string | null;
    assignedTo?: string | null;
    note?: string | null;
  } | undefined>(undefined);

  // CloudSign送付モーダル用のデータ（遅延ロード）
  const [cloudsignData, setCloudsignData] = useState<{
    contractTypes: { id: number; name: string; templates: { id: number; cloudsignTemplateId: string; name: string; description: string | null }[] }[];
    contacts: { id: number; name: string; email: string | null; position: string | null }[];
    operatingCompany: { id: number; companyName: string; cloudsignClientId: string | null } | null;
    projectId: number;
  } | null>(null);
  const [loadingCloudsign, setLoadingCloudsign] = useState(false);

  type CachedState = {
    formData: FormData;
    editingId: number | null;
    formOpen: boolean;
    nextContractNumber: string;
  };
  const { restore, save, clear } = useTimedFormCache<CachedState>(
    `master-contract-${companyId}`
  );
  const formStateRef = useRef<CachedState>({
    formData: EMPTY_FORM_DATA,
    editingId: null,
    formOpen: false,
    nextContractNumber: "",
  });
  formStateRef.current = { formData, editingId, formOpen, nextContractNumber };

  // クローズ時にキャッシュ保存
  useEffect(() => {
    if (!open) return;
    return () => {
      save(formStateRef.current);
    };
  }, [open, save]);

  // モーダルが開くたびにサーバーから最新データを取得
  const loadContracts = useCallback(async () => {
    setInitialLoading(true);
    try {
      const [contracts, allHistories] = await Promise.all([
        getMasterContracts(companyId),
        getContractHistories(companyId),
      ]);
      setLocalContracts(contracts);
      // masterContractId が null の契約履歴 = 紐づかない履歴
      setUnlinkedHistories(allHistories.filter((h) => !h.masterContractId));
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setInitialLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) {
      loadContracts();
      const cached = restore();
      if (cached) {
        setFormData(cached.formData);
        setEditingId(cached.editingId);
        setFormOpen(cached.formOpen);
        setNextContractNumber(cached.nextContractNumber);
      } else {
        setFormData(EMPTY_FORM_DATA);
        setEditingId(null);
        setFormOpen(false);
        setNextContractNumber("");
      }
      // 契約履歴フォームはリセット
      setHistoryFormOpen(false);
      setEditingHistoryId(null);
      setHistoryFormData(EMPTY_HISTORY_FORM);
    }
  }, [open, loadContracts, restore]);

  // 契約履歴フォームが開いたらスクロールして表示
  useEffect(() => {
    if (historyFormOpen && historyFormRef.current) {
      setTimeout(() => {
        historyFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [historyFormOpen]);

  const resetForm = () => {
    setFormData(EMPTY_FORM_DATA);
    setEditingId(null);
    setFormOpen(false);
    setNextContractNumber("");
  };

  const handleAdd = async () => {
    resetForm();
    setHistoryFormOpen(false);
    setFormOpen(true);
    try {
      const number = await getNextContractNumber();
      setNextContractNumber(number);
    } catch (error) {
      console.error("Error fetching next contract number:", error);
    }
  };

  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    return new Date(dateStr);
  };

  const handleEdit = (contract: Contract) => {
    setHistoryFormOpen(false);
    setFormData({
      contractType: contract.contractType || "",
      title: contract.title || "",
      startDate: parseDate(contract.startDate),
      endDate: parseDate(contract.endDate),
      currentStatusId: contract.currentStatusId ? String(contract.currentStatusId) : "",
      signedDate: parseDate(contract.signedDate),
      signingMethod: contract.signingMethod || "",
      filePath: contract.filePath || "",
      fileName: contract.fileName || "",
      assignedTo: contract.assignedTo || "",
      note: contract.note || "",
      cloudsignDocumentId: contract.cloudsignDocumentId || "",
      parentContractId: contract.parentContractId ? String(contract.parentContractId) : "",
    });
    setEditingId(contract.id);
    setFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この契約書を削除してもよろしいですか？")) return;

    try {
      await deleteMasterContract(id);
      setLocalContracts((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch (error) {
      console.error("Error deleting contract:", error);
      alert("削除に失敗しました");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.contractType || !formData.title) {
      alert("契約種別とタイトルは必須です");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        contractType: formData.contractType,
        title: formData.title,
        startDate: formData.startDate ? toLocalDateString(formData.startDate) : null,
        endDate: formData.endDate ? toLocalDateString(formData.endDate) : null,
        currentStatusId: formData.currentStatusId ? Number(formData.currentStatusId) : null,
        signedDate: formData.signedDate ? toLocalDateString(formData.signedDate) : null,
        signingMethod: formData.signingMethod || null,
        filePath: formData.filePath || null,
        fileName: formData.fileName || null,
        assignedTo: formData.assignedTo || null,
        note: formData.note || null,
        parentContractId: formData.parentContractId && formData.parentContractId !== "none" ? Number(formData.parentContractId) : null,
      };

      let savedId: number | null = editingId;

      if (editingId) {
        await updateMasterContract(editingId, data);
        toast.success("契約書を更新しました");
      } else {
        const result = await addMasterContract(companyId, data);
        savedId = result.contractId;
        toast.success(`契約書番号「${result.contractNumber}」で保存しました。`);
      }

      // ドキュメントIDが新たに入力された場合、紐付け＆同期
      const docId = formData.cloudsignDocumentId.trim();
      if (docId && savedId) {
        const existingContract = localContracts.find(c => c.id === savedId);
        if (!existingContract?.cloudsignDocumentId) {
          if (confirm(`CloudSignドキュメントID「${docId}」で同期しますか？\nCloudSign側のステータスがCRMに反映されます。`)) {
            try {
              const syncResult = await linkCloudsignDocument(savedId, docId);
              toast.success(`CloudSignと紐付けました（ステータス: ${syncResult.newStatus}）`);
            } catch (error) {
              console.error(error);
              toast.error("CloudSign紐付けに失敗しました。ドキュメントIDを確認してください。");
            }
          }
        }
      }

      resetForm();
      await loadContracts();
      router.refresh();
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  const datePickerClassName = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  // --- 契約履歴ハンドラ ---
  const handleAddHistory = (masterContractId?: number) => {
    setFormOpen(false);
    const defaultMonthly = calculateMonthlyFee("general", "monthly");
    const defaultPerformance = calculatePerformanceFee("monthly");
    setHistoryFormData({
      ...EMPTY_HISTORY_FORM,
      monthlyFee: String(defaultMonthly),
      performanceFee: String(defaultPerformance),
      masterContractId: masterContractId ? String(masterContractId) : "",
    });
    setEditingHistoryId(null);
    setIsManualMonthlyFee(false);
    setIsManualPerformanceFee(false);
    setHistoryFormOpen(true);
    if (historyStaffOptions.salesOptions.length === 0) {
      getStaffList().then(setHistoryStaffOptions);
    }
  };

  const handleEditHistory = (history: ContractHistory) => {
    setFormOpen(false);
    const autoMonthlyFee = calculateMonthlyFee(history.industryType, history.contractPlan);
    const autoPerformanceFee = calculatePerformanceFee(history.contractPlan);
    setHistoryFormData({
      industryType: history.industryType,
      contractPlan: history.contractPlan,
      jobMedia: history.jobMedia || "",
      contractStartDate: new Date(history.contractStartDate),
      contractEndDate: history.contractEndDate ? new Date(history.contractEndDate) : null,
      contractDate: history.contractDate ? new Date(history.contractDate) : null,
      initialFee: String(history.initialFee),
      monthlyFee: String(history.monthlyFee),
      performanceFee: String(history.performanceFee),
      salesStaffId: history.salesStaffId ? String(history.salesStaffId) : "",
      operationStaffId: history.operationStaffId ? String(history.operationStaffId) : "",
      status: history.status,
      note: history.note || "",
      operationStatus: history.operationStatus || "",
      accountId: history.accountId || "",
      accountPass: history.accountPass || "",
      masterContractId: history.masterContractId ? String(history.masterContractId) : "",
    });
    setIsManualMonthlyFee(history.monthlyFee !== autoMonthlyFee);
    setIsManualPerformanceFee(history.performanceFee !== autoPerformanceFee);
    setEditingHistoryId(history.id);
    setHistoryFormOpen(true);
    if (historyStaffOptions.salesOptions.length === 0) {
      getStaffList().then(setHistoryStaffOptions);
    }
  };

  const handleSubmitHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyFormData.industryType || !historyFormData.contractPlan || !historyFormData.contractStartDate) {
      toast.error("業種、契約プラン、契約開始日は必須です");
      return;
    }
    if (isInvalidJobMedia(historyFormData.jobMedia || null)) {
      toast.error("無効な求人媒体が選択されています。正しい媒体を選択してください。");
      return;
    }
    setIsSubmitting(true);
    try {
      const data: ContractHistoryData = {
        industryType: historyFormData.industryType,
        contractPlan: historyFormData.contractPlan,
        jobMedia: historyFormData.jobMedia || null,
        contractStartDate: toLocalDateString(historyFormData.contractStartDate),
        contractEndDate: historyFormData.contractEndDate ? toLocalDateString(historyFormData.contractEndDate) : null,
        initialFee: Number(historyFormData.initialFee) || 0,
        monthlyFee: Number(historyFormData.monthlyFee) || 0,
        performanceFee: Number(historyFormData.performanceFee) || 0,
        salesStaffId: historyFormData.salesStaffId ? Number(historyFormData.salesStaffId) : null,
        operationStaffId: historyFormData.operationStaffId ? Number(historyFormData.operationStaffId) : null,
        status: historyFormData.status || "active",
        note: historyFormData.note || null,
        operationStatus: historyFormData.operationStatus || null,
        accountId: historyFormData.accountId || null,
        accountPass: historyFormData.accountPass || null,
        masterContractId: historyFormData.masterContractId && historyFormData.masterContractId !== "none" ? Number(historyFormData.masterContractId) : null,
        contractDate: historyFormData.contractDate ? toLocalDateString(historyFormData.contractDate) : null,
      };
      if (editingHistoryId) {
        const result = await updateContractHistory(editingHistoryId, data);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("契約履歴を更新しました");
      } else {
        const result = await addContractHistory(companyId, data);
        if (!result.success) { toast.error(result.error); return; }
        toast.success("契約履歴を追加しました");
      }
      setHistoryFormOpen(false);
      setEditingHistoryId(null);
      setHistoryFormData(EMPTY_HISTORY_FORM);
      setIsManualMonthlyFee(false);
      setIsManualPerformanceFee(false);
      await loadContracts();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    if (!confirm("この契約履歴を削除してもよろしいですか？")) return;
    try {
      const result = await deleteContractHistory(id);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("契約履歴を削除しました");
      await loadContracts();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("削除に失敗しました");
    }
  };

  // 紐づかない契約履歴を契約書に紐づける
  const handleLinkHistoryToContract = async (historyId: number, contractId: number) => {
    try {
      const result = await linkContractHistoryToContract(historyId, contractId);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("契約書に紐づけました");
      await loadContracts();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("紐づけに失敗しました");
    }
  };

  // 業種区分変更時
  const handleHistoryIndustryTypeChange = (value: string) => {
    const newData = { ...historyFormData, industryType: value };
    if (!isManualMonthlyFee) {
      newData.monthlyFee = String(calculateMonthlyFee(value, historyFormData.contractPlan));
    }
    setHistoryFormData(newData);
  };

  // 契約プラン変更時
  const handleHistoryContractPlanChange = (value: string) => {
    const newData = { ...historyFormData, contractPlan: value };
    if (!isManualMonthlyFee) {
      newData.monthlyFee = String(calculateMonthlyFee(historyFormData.industryType, value));
    }
    if (!isManualPerformanceFee) {
      newData.performanceFee = String(calculatePerformanceFee(value));
    }
    setHistoryFormData(newData);
  };

  const handleManualMonthlyFeeChange = (checked: boolean) => {
    setIsManualMonthlyFee(checked);
    if (!checked) {
      setHistoryFormData({
        ...historyFormData,
        monthlyFee: String(calculateMonthlyFee(historyFormData.industryType, historyFormData.contractPlan)),
      });
    }
  };

  const handleManualPerformanceFeeChange = (checked: boolean) => {
    setIsManualPerformanceFee(checked);
    if (!checked) {
      setHistoryFormData({
        ...historyFormData,
        performanceFee: String(calculatePerformanceFee(historyFormData.contractPlan)),
      });
    }
  };

  // CloudSign送付ボタンのロジック
  const handleCloudsignSend = async () => {
    if (!cloudsignData) {
      setLoadingCloudsign(true);
      try {
        const data = await getCloudsignModalData(companyId);
        setCloudsignData(data);
        if (!data.operatingCompany?.cloudsignClientId) {
          toast.error("運営法人にクラウドサインのクライアントIDが設定されていません。設定画面から登録してください。");
          return;
        }
      } catch (error) {
        console.error(error);
        toast.error("クラウドサイン情報の取得に失敗しました");
        return;
      } finally {
        setLoadingCloudsign(false);
      }
    }

    setLoadingDrafts(true);
    try {
      const existingDrafts = await getDraftsForCompany(companyId);
      if (existingDrafts.length > 0) {
        setDrafts(existingDrafts);
        setDraftSelectOpen(true);
      } else {
        setResumeDraft(undefined);
        setSendModalOpen(true);
      }
    } catch (error) {
      console.error(error);
      setResumeDraft(undefined);
      setSendModalOpen(true);
    } finally {
      setLoadingDrafts(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="mixed"
        className="p-0 overflow-hidden flex flex-col"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>契約管理 - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 flex flex-col gap-4 flex-1 min-h-0">
          {/* ボタン行 */}
          {!formOpen && !historyFormOpen && (
            <div className="flex justify-end gap-2 shrink-0">
              {/* 契約履歴を追加 */}
              <Button onClick={() => handleAddHistory()} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                契約履歴を追加
              </Button>
              {/* 契約書を作成 ドロップダウン */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    契約書を作成
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    onClick={handleCloudsignSend}
                    disabled={loadingCloudsign || loadingDrafts}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    <div>
                      <div className="font-medium">クラウドサインで送付</div>
                      <div className="text-xs text-gray-500">テンプレートから契約書を作成し、相手先に送付します</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleAdd}>
                    <FileText className="h-4 w-4 mr-2" />
                    <div>
                      <div className="font-medium">手動で登録</div>
                      <div className="text-xs text-gray-500">紙の契約書やPDFを手動でアップロード・登録します</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* 契約書フォーム（折りたたみ） */}
          {formOpen && (
            <div className="border rounded-lg p-4 bg-gray-50 shrink-0 max-h-[50vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">
                  {editingId ? "契約書を編集" : "新規契約書を追加"}
                </h3>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {!editingId && nextContractNumber && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-gray-700">
                    この契約書データを作成すると契約書番号「<span className="font-mono font-bold">{nextContractNumber}</span>」で保存されます。
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 契約種別 */}
                  <div>
                    <Label htmlFor="contractType">
                      契約種別 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* タイトル */}
                  <div>
                    <Label htmlFor="title">
                      タイトル <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="契約書タイトル"
                    />
                  </div>

                  {/* 親契約 */}
                  <div>
                    <Label>親契約</Label>
                    <Select
                      value={formData.parentContractId || "none"}
                      onValueChange={(value) => setFormData({ ...formData, parentContractId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="なし" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">なし</SelectItem>
                        {localContracts
                          .filter((c) => c.id !== editingId)
                          .map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.contractNumber} {c.contractType} - {c.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ステータス */}
                  <div>
                    <Label htmlFor="currentStatusId">ステータス</Label>
                    {(() => {
                      const editingContract = editingId ? localContracts.find(c => c.id === editingId) : null;
                      const isCloudSignSynced = !!(editingContract?.cloudsignDocumentId && editingContract?.cloudsignAutoSync);
                      return (
                        <>
                          <Select
                            value={formData.currentStatusId}
                            onValueChange={(value) => setFormData({ ...formData, currentStatusId: value })}
                            disabled={isCloudSignSynced}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent>
                              {contractStatusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isCloudSignSynced && (
                            <p className="text-xs text-blue-600 mt-1">
                              CloudSign同期中のため自動更新されます。手動で変更するには同期をOFFにしてください。
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* 締結方法 */}
                  <div>
                    <Label htmlFor="signingMethod">締結方法</Label>
                    <Select
                      value={formData.signingMethod}
                      onValueChange={(value) => setFormData({ ...formData, signingMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {signingMethodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 締結日 */}
                  <div>
                    <Label htmlFor="signedDate">締結日</Label>
                    {(() => {
                      const editingContract = editingId ? localContracts.find(c => c.id === editingId) : null;
                      const isCloudSignSynced = !!(editingContract?.cloudsignDocumentId && editingContract?.cloudsignAutoSync);
                      return (
                        <>
                          <DatePicker
                            selected={formData.signedDate}
                            onChange={(date: Date | null) => setFormData({ ...formData, signedDate: date })}
                            dateFormat="yyyy/MM/dd"
                            locale="ja"
                            placeholderText="日付を選択"
                            isClearable
                            disabled={isCloudSignSynced}
                            className={datePickerClassName}
                            wrapperClassName="w-full"
                            calendarClassName="shadow-lg"
                          />
                          {isCloudSignSynced && (
                            <p className="text-xs text-blue-600 mt-1">
                              CloudSign同期中のため自動更新されます。
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* 契約開始日 */}
                  <div>
                    <Label htmlFor="startDate">契約開始日</Label>
                    <DatePicker
                      selected={formData.startDate}
                      onChange={(date: Date | null) => setFormData({ ...formData, startDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>

                  {/* 契約終了日 */}
                  <div>
                    <Label htmlFor="endDate">契約終了日</Label>
                    <DatePicker
                      selected={formData.endDate}
                      onChange={(date: Date | null) => setFormData({ ...formData, endDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>

                  {/* 契約書ファイル */}
                  <div className="col-span-2">
                    <Label htmlFor="fileUpload">契約書ファイル</Label>
                    <FileUpload
                      value={{
                        filePath: formData.filePath || null,
                        fileName: formData.fileName || null,
                      }}
                      onChange={(newValue) => {
                        setFormData({
                          ...formData,
                          filePath: newValue.filePath || "",
                          fileName: newValue.fileName || "",
                        });
                      }}
                      contractId={editingId || undefined}
                    />
                  </div>

                  {/* 担当者（複数選択可） */}
                  <div className="col-span-2">
                    <Label htmlFor="assignedTo">担当者</Label>
                    <MultiSelectCombobox
                      options={staffOptions}
                      value={formData.assignedTo ? formData.assignedTo.split(",").filter(Boolean) : []}
                      onChange={(values) => setFormData({ ...formData, assignedTo: values.join(",") })}
                      placeholder="担当者を選択"
                    />
                  </div>
                </div>

                {/* 備考 */}
                <div>
                  <Label htmlFor="note">備考</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="備考"
                    rows={2}
                  />
                </div>

                {/* CloudSignドキュメントID */}
                {!(editingId && localContracts.find(c => c.id === editingId)?.cloudsignDocumentId) && (
                  <div>
                    <Label htmlFor="cloudsignDocumentId">CloudSign ドキュメントID（任意）</Label>
                    <Input
                      id="cloudsignDocumentId"
                      value={formData.cloudsignDocumentId}
                      onChange={(e) => setFormData({ ...formData, cloudsignDocumentId: e.target.value })}
                      placeholder="例: abcdef12-3456-7890-abcd-ef1234567890"
                    />
                    {formData.cloudsignDocumentId.trim() && (
                      <p className="text-xs text-blue-600 mt-1">
                        保存後にCloudSignと同期するか確認されます。同期するとCloudSign側のステータスがCRMに反映されます。
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "保存中..." : "保存"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 契約履歴フォーム（折りたたみ） */}
          {historyFormOpen && (
            <div ref={historyFormRef} className="border rounded-lg p-4 bg-gray-50 shrink-0 max-h-[50vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">
                  {editingHistoryId ? "契約履歴を編集" : "新規契約履歴を追加"}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => {
                  setHistoryFormOpen(false);
                  setEditingHistoryId(null);
                  setHistoryFormData(EMPTY_HISTORY_FORM);
                  setIsManualMonthlyFee(false);
                  setIsManualPerformanceFee(false);
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmitHistory} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      業種区分 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={historyFormData.industryType}
                      onValueChange={handleHistoryIndustryTypeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {industryTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      契約プラン <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={historyFormData.contractPlan}
                      onValueChange={handleHistoryContractPlanChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractPlanOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>求人媒体</Label>
                  {isInvalidJobMedia(historyFormData.jobMedia || null) && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                      無効な媒体「{historyFormData.jobMedia}」が設定されています。変更してください。
                    </div>
                  )}
                  <Select
                    value={historyFormData.jobMedia || "none"}
                    onValueChange={(v) => setHistoryFormData({ ...historyFormData, jobMedia: v === "none" ? "" : v })}
                  >
                    <SelectTrigger className={isInvalidJobMedia(historyFormData.jobMedia || null) ? "border-red-500" : ""}>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">選択なし</SelectItem>
                      {jobMediaOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>
                      契約開始日 <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      selected={historyFormData.contractStartDate}
                      onChange={(date: Date | null) => setHistoryFormData({ ...historyFormData, contractStartDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>契約終了日</Label>
                    <DatePicker
                      selected={historyFormData.contractEndDate}
                      onChange={(date: Date | null) => setHistoryFormData({ ...historyFormData, contractEndDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      契約日 <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      selected={historyFormData.contractDate}
                      onChange={(date: Date | null) => setHistoryFormData({ ...historyFormData, contractDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>初期費用</Label>
                    <Input
                      type="number"
                      value={historyFormData.initialFee}
                      onChange={(e) => setHistoryFormData({ ...historyFormData, initialFee: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>月額</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="histManualMonthlyFee"
                          checked={isManualMonthlyFee}
                          onCheckedChange={(checked) => handleManualMonthlyFeeChange(checked === true)}
                        />
                        <label htmlFor="histManualMonthlyFee" className="text-xs text-muted-foreground cursor-pointer">
                          手動入力
                        </label>
                      </div>
                    </div>
                    <Input
                      type="number"
                      value={historyFormData.monthlyFee}
                      onChange={(e) => setHistoryFormData({ ...historyFormData, monthlyFee: e.target.value })}
                      placeholder="0"
                      disabled={!isManualMonthlyFee}
                      className={!isManualMonthlyFee ? "bg-muted" : ""}
                    />
                    {!isManualMonthlyFee && (
                      <p className="text-xs text-muted-foreground">
                        自動計算: {formatCurrency(calculateMonthlyFee(historyFormData.industryType, historyFormData.contractPlan))}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>成果報酬単価</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="histManualPerformanceFee"
                          checked={isManualPerformanceFee}
                          onCheckedChange={(checked) => handleManualPerformanceFeeChange(checked === true)}
                        />
                        <label htmlFor="histManualPerformanceFee" className="text-xs text-muted-foreground cursor-pointer">
                          手動入力
                        </label>
                      </div>
                    </div>
                    <Input
                      type="number"
                      value={historyFormData.performanceFee}
                      onChange={(e) => setHistoryFormData({ ...historyFormData, performanceFee: e.target.value })}
                      placeholder="0"
                      disabled={!isManualPerformanceFee}
                      className={!isManualPerformanceFee ? "bg-muted" : ""}
                    />
                    {!isManualPerformanceFee && (
                      <p className="text-xs text-muted-foreground">
                        自動計算: {formatCurrency(calculatePerformanceFee(historyFormData.contractPlan))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>担当営業</Label>
                    <Select
                      value={historyFormData.salesStaffId || "none"}
                      onValueChange={(v) => setHistoryFormData({ ...historyFormData, salesStaffId: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">選択なし</SelectItem>
                        {historyStaffOptions.salesOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>担当運用</Label>
                    <Select
                      value={historyFormData.operationStaffId || "none"}
                      onValueChange={(v) => setHistoryFormData({ ...historyFormData, operationStaffId: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">選択なし</SelectItem>
                        {historyStaffOptions.operationOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ステータス</Label>
                  <Select
                    value={historyFormData.status}
                    onValueChange={(v) => setHistoryFormData({ ...historyFormData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>運用ステータス</Label>
                  <Select
                    value={historyFormData.operationStatus || "none"}
                    onValueChange={(v) => setHistoryFormData({ ...historyFormData, operationStatus: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">選択なし</SelectItem>
                      {operationStatusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>アカウントID</Label>
                    <Input
                      type="text"
                      value={historyFormData.accountId}
                      onChange={(e) => setHistoryFormData({ ...historyFormData, accountId: e.target.value })}
                      placeholder="アカウントIDを入力"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>アカウントPASS</Label>
                    <Input
                      type="text"
                      value={historyFormData.accountPass}
                      onChange={(e) => setHistoryFormData({ ...historyFormData, accountPass: e.target.value })}
                      placeholder="パスワードを入力"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>備考</Label>
                  <Textarea
                    value={historyFormData.note}
                    onChange={(e) => setHistoryFormData({ ...historyFormData, note: e.target.value })}
                    rows={2}
                    placeholder="備考を入力"
                  />
                </div>

                {/* 関連する契約書 */}
                <div className="space-y-2">
                  <Label>関連する契約書</Label>
                  <Select
                    value={historyFormData.masterContractId || "none"}
                    onValueChange={(v) => setHistoryFormData({ ...historyFormData, masterContractId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="なし" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">なし</SelectItem>
                      {localContracts.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.contractNumber} {c.contractType} - {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => {
                    setHistoryFormOpen(false);
                    setEditingHistoryId(null);
                    setHistoryFormData(EMPTY_HISTORY_FORM);
                    setIsManualMonthlyFee(false);
                    setIsManualPerformanceFee(false);
                  }}>
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "保存中..." : editingHistoryId ? "更新" : "追加"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 契約書一覧（ツリー表示） — フォームが開いている時は非表示 */}
          {formOpen || historyFormOpen ? null : initialLoading ? (
            <div className="text-center py-8 text-gray-500">読み込み中...</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {localContracts.length === 0 && unlinkedHistories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">契約書・契約履歴が登録されていません</div>
              ) : (
                <>
                  {/* 契約書セクション */}
                  {localContracts.map((contract) => (
                    <ContractCard
                      key={contract.id}
                      contract={contract}
                      contracts={localContracts}
                      onEdit={() => handleEdit(contract)}
                      onDelete={() => handleDelete(contract.id)}
                      onEditHistory={(history) => handleEditHistory(history)}
                      onDeleteHistory={(historyId) => handleDeleteHistory(historyId)}
                      onAddHistoryForContract={(contractId) => handleAddHistory(contractId)}
                      formatDate={formatDate}
                      cloudsignData={cloudsignData}
                      setCloudsignData={setCloudsignData}
                      loadingCloudsign={loadingCloudsign}
                      setLoadingCloudsign={setLoadingCloudsign}
                      loadingDrafts={loadingDrafts}
                      setLoadingDrafts={setLoadingDrafts}
                      syncingContractId={syncingContractId}
                      setSyncingContractId={setSyncingContractId}
                      togglingAutoSyncId={togglingAutoSyncId}
                      setTogglingAutoSyncId={setTogglingAutoSyncId}
                      linkingContractId={linkingContractId}
                      setLinkingContractId={setLinkingContractId}
                      remindingContractId={remindingContractId}
                      setRemindingContractId={setRemindingContractId}
                      fetchingSigningUrlId={fetchingSigningUrlId}
                      setFetchingSigningUrlId={setFetchingSigningUrlId}
                      deletingDraftId={deletingDraftId}
                      setDeletingDraftId={setDeletingDraftId}
                      loadContracts={loadContracts}
                      companyId={companyId}
                      setResumeDraft={setResumeDraft}
                      setSendModalOpen={setSendModalOpen}
                      setDrafts={setDrafts}
                      setDraftSelectOpen={setDraftSelectOpen}
                      router={router}
                    />
                  ))}

                  {/* 契約書に紐づかない契約履歴 */}
                  {unlinkedHistories.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                        <div className="flex-1 border-t border-gray-200" />
                        <span className="whitespace-nowrap">契約書に紐づかない契約履歴</span>
                        <div className="flex-1 border-t border-gray-200" />
                      </h3>
                      {unlinkedHistories.map((history) => (
                        <ContractHistoryCard
                          key={history.id}
                          history={history}
                          onEdit={() => handleEditHistory(history)}
                          onDelete={() => handleDeleteHistory(history.id)}
                          contracts={localContracts}
                          onLink={handleLinkHistoryToContract}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* 下書き選択ダイアログ */}
      <Dialog open={draftSelectOpen} onOpenChange={setDraftSelectOpen}>
        <DialogContent size="form" className="p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>下書きが{drafts.length}件あります</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {drafts.map((draft) => (
              <div key={draft.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{draft.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {draft.contractType} ・ {draft.contractNumber}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      作成: {new Date(draft.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResumeDraft({
                          contractId: draft.id,
                          contractNumber: draft.contractNumber,
                          cloudsignDocumentId: draft.cloudsignDocumentId || "",
                          contractType: draft.contractType,
                          title: draft.title,
                          cloudsignTitle: draft.cloudsignTitle,
                          assignedTo: draft.assignedTo,
                          note: draft.note,
                        });
                        setDraftSelectOpen(false);
                        setSendModalOpen(true);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      再開
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deletingDraftId === draft.id}
                      onClick={async () => {
                        if (!confirm("この下書きを削除しますか？")) return;
                        setDeletingDraftId(draft.id);
                        try {
                          await deleteDraftContract(draft.id);
                          toast.success("下書きを削除しました");
                          setDrafts((prev: typeof drafts) => prev.filter((d) => d.id !== draft.id));
                          await loadContracts();
                          if (drafts.length <= 1) {
                            setDraftSelectOpen(false);
                            setResumeDraft(undefined);
                            setSendModalOpen(true);
                          }
                        } catch (error) {
                          console.error(error);
                          toast.error("削除に失敗しました");
                        } finally {
                          setDeletingDraftId(null);
                        }
                      }}
                    >
                      {deletingDraftId === draft.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t shrink-0 flex justify-between">
            <Button variant="outline" onClick={() => setDraftSelectOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                setDraftSelectOpen(false);
                setResumeDraft(undefined);
                setSendModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              新規で作成
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 契約書送付モーダル */}
      {cloudsignData && cloudsignData.operatingCompany && (
        <ContractSendModal
          open={sendModalOpen}
          onOpenChange={(v) => {
            setSendModalOpen(v);
            if (!v) setResumeDraft(undefined);
          }}
          companyId={companyId}
          companyName={companyName}
          projectId={cloudsignData.projectId}
          contractTypes={cloudsignData.contractTypes}
          contacts={cloudsignData.contacts}
          operatingCompany={cloudsignData.operatingCompany}
          staffOptions={staffOptions}
          onSuccess={loadContracts}
          resumeDraft={resumeDraft}
        />
      )}
    </Dialog>
  );
}
