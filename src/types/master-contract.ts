import { JOB_MEDIA_OPTIONS } from "@/lib/stp/job-media";

export type ContractHistory = {
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

export type Contract = {
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
  cloudsignTitle?: string | null;
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
  contractFiles?: { id: number; filePath: string; fileName: string; fileSize: number | null; mimeType: string | null; category: string }[];
  contractHistories: ContractHistory[];
  agentContractHistories?: AgentContractHistory[];
};

export type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderInline?: boolean;
  companyId: number;
  companyName: string;
  contractStatusOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  contractTypeOptions: { value: string; label: string }[];
  agentId?: number;
};

export type FormData = {
  contractType: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  currentStatusId: string;
  signedDate: Date | null;
  signingMethod: string;
  files: import("@/components/multi-file-upload").FileInfo[];
  assignedTo: string;
  note: string;
  cloudsignDocumentId: string;
  parentContractId: string;
};

export const EMPTY_FORM_DATA: FormData = {
  contractType: "",
  title: "",
  startDate: null,
  endDate: null,
  currentStatusId: "",
  signedDate: null,
  signingMethod: "",
  files: [],
  assignedTo: "",
  note: "",
  cloudsignDocumentId: "",
  parentContractId: "",
};

// 契約履歴フォーム
export type HistoryFormData = {
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

export const EMPTY_HISTORY_FORM: HistoryFormData = {
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

// 代理店契約履歴の型
export type AgentContractHistory = {
  id: number;
  agentId: number;
  contractStartDate: string;
  contractEndDate: string | null;
  contractDate: string | null;
  status: string;
  initialFee: number | null;
  monthlyFee: number | null;
  defaultMpInitialType: string | null;
  defaultMpInitialRate: number | null;
  defaultMpInitialFixed: number | null;
  defaultMpInitialDuration: number | null;
  defaultMpMonthlyType: string | null;
  defaultMpMonthlyRate: number | null;
  defaultMpMonthlyFixed: number | null;
  defaultMpMonthlyDuration: number | null;
  defaultPpInitialType: string | null;
  defaultPpInitialRate: number | null;
  defaultPpInitialFixed: number | null;
  defaultPpInitialDuration: number | null;
  defaultPpPerfType: string | null;
  defaultPpPerfRate: number | null;
  defaultPpPerfFixed: number | null;
  defaultPpPerfDuration: number | null;
  note: string | null;
  masterContractId: number | null;
};

// 代理店契約履歴フォーム
export type AgentHistoryFormData = {
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  contractDate: Date | null;
  status: string;
  initialFee: string;
  monthlyFee: string;
  defaultMpInitialType: string;
  defaultMpInitialRate: string;
  defaultMpInitialFixed: string;
  defaultMpInitialDuration: string;
  defaultMpMonthlyType: string;
  defaultMpMonthlyRate: string;
  defaultMpMonthlyFixed: string;
  defaultMpMonthlyDuration: string;
  defaultPpInitialType: string;
  defaultPpInitialRate: string;
  defaultPpInitialFixed: string;
  defaultPpInitialDuration: string;
  defaultPpPerfType: string;
  defaultPpPerfRate: string;
  defaultPpPerfFixed: string;
  defaultPpPerfDuration: string;
  note: string;
};

export const EMPTY_AGENT_HISTORY_FORM: AgentHistoryFormData = {
  contractStartDate: null,
  contractEndDate: null,
  contractDate: null,
  status: "active",
  initialFee: "",
  monthlyFee: "",
  defaultMpInitialType: "",
  defaultMpInitialRate: "",
  defaultMpInitialFixed: "",
  defaultMpInitialDuration: "",
  defaultMpMonthlyType: "",
  defaultMpMonthlyRate: "",
  defaultMpMonthlyFixed: "",
  defaultMpMonthlyDuration: "",
  defaultPpInitialType: "",
  defaultPpInitialRate: "",
  defaultPpInitialFixed: "",
  defaultPpInitialDuration: "",
  defaultPpPerfType: "",
  defaultPpPerfRate: "",
  defaultPpPerfFixed: "",
  defaultPpPerfDuration: "",
  note: "",
};

// --- Option constants ---
export const signingMethodOptions = [
  { value: "cloudsign", label: "クラウドサイン" },
  { value: "paper", label: "紙" },
  { value: "other", label: "その他" },
];

export const agentStatusOptions = [
  { value: "active", label: "契約中" },
  { value: "scheduled", label: "契約予定" },
  { value: "cancelled", label: "解約" },
  { value: "dormant", label: "休眠" },
];

export const commMonthlyTypeOptions = [
  { value: "rate", label: "率(%)" },
  { value: "fixed", label: "固定額" },
];

export const industryTypeOptions = [
  { value: "general", label: "一般" },
  { value: "dispatch", label: "派遣" },
];

export const contractPlanOptions = [
  { value: "monthly", label: "月額" },
  { value: "performance", label: "成果報酬" },
];

export const statusOptions = [
  { value: "active", label: "契約中" },
  { value: "scheduled", label: "契約予定" },
  { value: "cancelled", label: "解約" },
  { value: "dormant", label: "休眠" },
];

export const operationStatusOptions = [
  { value: "テスト1", label: "テスト1" },
  { value: "テスト2", label: "テスト2" },
];

export const jobMediaOptions = JOB_MEDIA_OPTIONS;

// --- Utility functions ---
export function calculateMonthlyFee(industryType: string, contractPlan: string): number {
  if (contractPlan === "performance") return 0;
  if (industryType === "dispatch") return 300000;
  return 150000;
}

export function calculatePerformanceFee(contractPlan: string): number {
  if (contractPlan === "performance") return 150000;
  return 0;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString() + "円";
}

// --- Label mappings ---
export const planLabels: Record<string, string> = { monthly: "月額", performance: "成果報酬" };
export const industryLabels: Record<string, string> = { general: "一般", dispatch: "派遣" };
export const statusLabels: Record<string, string> = { active: "契約中", scheduled: "契約予定", cancelled: "解約", dormant: "休眠" };
