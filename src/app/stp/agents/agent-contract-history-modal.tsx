"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { toLocalDateString } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  getAgentContractHistories,
  addAgentContractHistory,
  updateAgentContractHistory,
  deleteAgentContractHistory,
  getReferredCompanies,
  addCommissionOverride,
  updateCommissionOverride,
  deleteCommissionOverride,
  type AgentContractHistoryData,
  type CommissionOverrideData,
} from "./agent-contract-history-actions";
import { useTimedFormCache } from "@/hooks/use-timed-form-cache";

registerLocale("ja", ja);

const statusOptions = [
  { value: "契約前", label: "契約前" },
  { value: "契約済み", label: "契約済み" },
];

const commMonthlyTypeOptions = [
  { value: "rate", label: "率(%)" },
  { value: "fixed", label: "固定額" },
];

type ContractHistory = {
  id: number;
  agentId: number;
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  initialFee: number | null;
  monthlyFee: number | null;
  // 月額プラン
  defaultMpInitialRate: number | null;
  defaultMpInitialDuration: number | null;
  defaultMpMonthlyType: string | null;
  defaultMpMonthlyRate: number | null;
  defaultMpMonthlyFixed: number | null;
  defaultMpMonthlyDuration: number | null;
  // 成果報酬プラン
  defaultPpInitialRate: number | null;
  defaultPpInitialDuration: number | null;
  defaultPpPerfType: string | null;
  defaultPpPerfRate: number | null;
  defaultPpPerfFixed: number | null;
  defaultPpPerfDuration: number | null;
  note: string | null;
  commissionOverrides: CommissionOverride[];
};

type CommissionOverride = {
  id: number;
  agentContractHistoryId: number;
  stpCompanyId: number;
  stpCompanyName: string;
  // 月額プラン
  mpInitialRate: number | null;
  mpInitialDuration: number | null;
  mpMonthlyType: string | null;
  mpMonthlyRate: number | null;
  mpMonthlyFixed: number | null;
  mpMonthlyDuration: number | null;
  // 成果報酬プラン
  ppInitialRate: number | null;
  ppInitialDuration: number | null;
  ppPerfType: string | null;
  ppPerfRate: number | null;
  ppPerfFixed: number | null;
  ppPerfDuration: number | null;
  note: string | null;
};

type ReferredCompany = {
  id: number;
  companyCode: string;
  companyName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: number;
  agentName: string;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString()}`;
}

// 通貨フォーマット入力コンポーネント
function CurrencyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value != null ? formatCurrency(value) : "");
    }
  }, [value, isFocused]);

  return (
    <Input
      ref={inputRef}
      type={isFocused ? "number" : "text"}
      value={isFocused ? (value ?? "") : displayValue}
      onChange={(e) => {
        onChange(e.target.value ? Number(e.target.value) : null);
      }}
      onFocus={() => {
        setIsFocused(true);
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

function formatCommissionSummary(history: {
  // 月額プラン
  defaultMpInitialRate?: number | null;
  defaultMpInitialDuration?: number | null;
  defaultMpMonthlyType?: string | null;
  defaultMpMonthlyRate?: number | null;
  defaultMpMonthlyFixed?: number | null;
  defaultMpMonthlyDuration?: number | null;
  // 成果報酬プラン
  defaultPpInitialRate?: number | null;
  defaultPpInitialDuration?: number | null;
  defaultPpPerfType?: string | null;
  defaultPpPerfRate?: number | null;
  defaultPpPerfFixed?: number | null;
  defaultPpPerfDuration?: number | null;
  // Override用（prefix無し）
  mpInitialRate?: number | null;
  mpInitialDuration?: number | null;
  mpMonthlyType?: string | null;
  mpMonthlyRate?: number | null;
  mpMonthlyFixed?: number | null;
  mpMonthlyDuration?: number | null;
  ppInitialRate?: number | null;
  ppInitialDuration?: number | null;
  ppPerfType?: string | null;
  ppPerfRate?: number | null;
  ppPerfFixed?: number | null;
  ppPerfDuration?: number | null;
}): string {
  const lines: string[] = [];

  // 月額プラン
  const mpInitRate = history.defaultMpInitialRate ?? history.mpInitialRate;
  const mpInitDur = history.defaultMpInitialDuration ?? history.mpInitialDuration;
  const mpMonType = history.defaultMpMonthlyType ?? history.mpMonthlyType;
  const mpMonRate = history.defaultMpMonthlyRate ?? history.mpMonthlyRate;
  const mpMonFixed = history.defaultMpMonthlyFixed ?? history.mpMonthlyFixed;
  const mpMonDur = history.defaultMpMonthlyDuration ?? history.mpMonthlyDuration;

  const mpParts: string[] = [];
  if (mpInitRate != null) {
    mpParts.push(`初期${mpInitRate}%${mpInitDur ? `(${mpInitDur}ヶ月)` : ""}`);
  }
  if (mpMonType === "rate" && mpMonRate != null) {
    mpParts.push(`月額${mpMonRate}%${mpMonDur ? `(${mpMonDur}ヶ月)` : ""}`);
  } else if (mpMonType === "fixed" && mpMonFixed != null) {
    mpParts.push(`月額${formatCurrency(mpMonFixed)}${mpMonDur ? `(${mpMonDur}ヶ月)` : ""}`);
  }
  if (mpParts.length > 0) {
    lines.push(`月額プラン: ${mpParts.join(" / ")}`);
  }

  // 成果報酬プラン
  const ppInitRate = history.defaultPpInitialRate ?? history.ppInitialRate;
  const ppInitDur = history.defaultPpInitialDuration ?? history.ppInitialDuration;
  const ppPerfType = history.defaultPpPerfType ?? history.ppPerfType;
  const ppPerfRate = history.defaultPpPerfRate ?? history.ppPerfRate;
  const ppPerfFixed = history.defaultPpPerfFixed ?? history.ppPerfFixed;
  const ppPerfDur = history.defaultPpPerfDuration ?? history.ppPerfDuration;

  const ppParts: string[] = [];
  if (ppInitRate != null) {
    ppParts.push(`初期${ppInitRate}%${ppInitDur ? `(${ppInitDur}ヶ月)` : ""}`);
  }
  if (ppPerfType === "rate" && ppPerfRate != null) {
    ppParts.push(`成果${ppPerfRate}%${ppPerfDur ? `(${ppPerfDur}ヶ月)` : ""}`);
  } else if (ppPerfType === "fixed" && ppPerfFixed != null) {
    ppParts.push(`成果${formatCurrency(ppPerfFixed)}${ppPerfDur ? `(${ppPerfDur}ヶ月)` : ""}`);
  } else if (ppPerfRate != null) {
    // ppPerfType未設定の場合は既存のrate表示（後方互換）
    ppParts.push(`成果${ppPerfRate}%${ppPerfDur ? `(${ppPerfDur}ヶ月)` : ""}`);
  }
  if (ppParts.length > 0) {
    lines.push(`成果プラン: ${ppParts.join(" / ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "-";
}

export function AgentContractHistoryModal({
  open,
  onOpenChange,
  agentId,
  agentName,
}: Props) {
  const [histories, setHistories] = useState<ContractHistory[]>([]);
  const [referredCompanies, setReferredCompanies] = useState<ReferredCompany[]>([]);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editHistory, setEditHistory] = useState<ContractHistory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ContractHistory | null>(null);
  const [editConfirm, setEditConfirm] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<Partial<AgentContractHistoryData> | null>(null);
  const [formData, setFormData] = useState<Partial<AgentContractHistoryData>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [financeWarning, setFinanceWarning] = useState<number | null>(null);

  // 報酬例外管理
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [overrideAddMode, setOverrideAddMode] = useState(false);
  const [overrideEditTarget, setOverrideEditTarget] = useState<CommissionOverride | null>(null);
  const [overrideDeleteConfirm, setOverrideDeleteConfirm] = useState<CommissionOverride | null>(null);
  const [overrideFormData, setOverrideFormData] = useState<Partial<CommissionOverrideData>>({});

  type CachedState = {
    formData: Partial<AgentContractHistoryData>;
    selectedHistoryId: number | null;
    isAddMode: boolean;
    editHistory: ContractHistory | null;
    overrideAddMode: boolean;
    overrideEditTarget: CommissionOverride | null;
    overrideFormData: Partial<CommissionOverrideData>;
  };
  const { restore, save, clear } = useTimedFormCache<CachedState>(
    `agent-contract-history-${agentId}`
  );
  const formStateRef = useRef<CachedState>({
    formData: {},
    selectedHistoryId: null,
    isAddMode: false,
    editHistory: null,
    overrideAddMode: false,
    overrideEditTarget: null,
    overrideFormData: {},
  });
  formStateRef.current = {
    formData, selectedHistoryId, isAddMode, editHistory,
    overrideAddMode, overrideEditTarget, overrideFormData,
  };

  // クローズ時にキャッシュ保存
  useEffect(() => {
    if (!open) return;
    return () => {
      save(formStateRef.current);
    };
  }, [open, save]);

  const loadData = useCallback(async () => {
    setInitialLoading(true);
    try {
      const [historiesData, companiesData] = await Promise.all([
        getAgentContractHistories(agentId),
        getReferredCompanies(agentId),
      ]);
      setHistories(historiesData);
      setReferredCompanies(companiesData);
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setInitialLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (open) {
      loadData();
      const cached = restore();
      if (cached) {
        setFormData(cached.formData);
        setSelectedHistoryId(cached.selectedHistoryId);
        setIsAddMode(cached.isAddMode);
        setEditHistory(cached.editHistory);
        setOverrideAddMode(cached.overrideAddMode);
        setOverrideEditTarget(cached.overrideEditTarget);
        setOverrideFormData(cached.overrideFormData);
      } else {
        setFormData({});
        setSelectedHistoryId(null);
        setIsAddMode(false);
        setEditHistory(null);
        setOverrideAddMode(false);
        setOverrideEditTarget(null);
        setOverrideFormData({});
      }
      // 一時的なUI状態は常にリセット
      setDeleteConfirm(null);
      setEditConfirm(false);
      setPendingEditData(null);
      setFinanceWarning(null);
      setOverrideDeleteConfirm(null);
    }
  }, [open, loadData, restore]);

  const getDefaultFormData = (): Partial<AgentContractHistoryData> => ({
    contractStartDate: "",
    contractEndDate: null,
    status: "契約前",
    initialFee: null,
    monthlyFee: null,
    defaultMpInitialRate: null,
    defaultMpInitialDuration: null,
    defaultMpMonthlyType: null,
    defaultMpMonthlyRate: null,
    defaultMpMonthlyFixed: null,
    defaultMpMonthlyDuration: null,
    defaultPpInitialRate: null,
    defaultPpInitialDuration: null,
    defaultPpPerfType: null,
    defaultPpPerfRate: null,
    defaultPpPerfFixed: null,
    defaultPpPerfDuration: null,
    note: null,
  });

  const openAddForm = () => {
    setFormData(getDefaultFormData());
    setIsAddMode(true);
    setEditHistory(null);
  };

  const openEditForm = (history: ContractHistory) => {
    setFormData({
      contractStartDate: history.contractStartDate,
      contractEndDate: history.contractEndDate,
      status: history.status,
      initialFee: history.initialFee,
      monthlyFee: history.monthlyFee,
      defaultMpInitialRate: history.defaultMpInitialRate,
      defaultMpInitialDuration: history.defaultMpInitialDuration,
      defaultMpMonthlyType: history.defaultMpMonthlyType,
      defaultMpMonthlyRate: history.defaultMpMonthlyRate,
      defaultMpMonthlyFixed: history.defaultMpMonthlyFixed,
      defaultMpMonthlyDuration: history.defaultMpMonthlyDuration,
      defaultPpInitialRate: history.defaultPpInitialRate,
      defaultPpInitialDuration: history.defaultPpInitialDuration,
      defaultPpPerfType: history.defaultPpPerfType,
      defaultPpPerfRate: history.defaultPpPerfRate,
      defaultPpPerfFixed: history.defaultPpPerfFixed,
      defaultPpPerfDuration: history.defaultPpPerfDuration,
      note: history.note,
    });
    setEditHistory(history);
    setIsAddMode(false);
  };

  const handleAdd = async () => {
    if (!formData.contractStartDate || !formData.status) {
      toast.error("必須項目を入力してください");
      return;
    }
    setLoading(true);
    try {
      const result = await addAgentContractHistory(agentId, {
        contractStartDate: formData.contractStartDate,
        contractEndDate: formData.contractEndDate || null,
        status: formData.status,
        initialFee: formData.initialFee ?? null,
        monthlyFee: formData.monthlyFee ?? null,
        defaultMpInitialRate: formData.defaultMpInitialRate ?? null,
        defaultMpInitialDuration: formData.defaultMpInitialDuration ?? null,
        defaultMpMonthlyType: formData.defaultMpMonthlyType || null,
        defaultMpMonthlyRate: formData.defaultMpMonthlyRate ?? null,
        defaultMpMonthlyFixed: formData.defaultMpMonthlyFixed ?? null,
        defaultMpMonthlyDuration: formData.defaultMpMonthlyDuration ?? null,
        defaultPpInitialRate: formData.defaultPpInitialRate ?? null,
        defaultPpInitialDuration: formData.defaultPpInitialDuration ?? null,
        defaultPpPerfType: formData.defaultPpPerfType || null,
        defaultPpPerfRate: formData.defaultPpPerfRate ?? null,
        defaultPpPerfFixed: formData.defaultPpPerfFixed ?? null,
        defaultPpPerfDuration: formData.defaultPpPerfDuration ?? null,
        note: formData.note || null,
      });
      if (!result.success) {
        toast.error(`追加に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("契約履歴を追加しました");
      setIsAddMode(false);
      setFormData({});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`追加に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmEdit = () => {
    setPendingEditData(formData);
    setEditConfirm(true);
  };

  const handleUpdate = async () => {
    if (!editHistory || !pendingEditData?.contractStartDate || !pendingEditData?.status) {
      toast.error("必須項目を入力してください");
      return;
    }
    setLoading(true);
    try {
      const result = await updateAgentContractHistory(editHistory.id, {
        contractStartDate: pendingEditData.contractStartDate,
        contractEndDate: pendingEditData.contractEndDate || null,
        status: pendingEditData.status,
        initialFee: pendingEditData.initialFee ?? null,
        monthlyFee: pendingEditData.monthlyFee ?? null,
        defaultMpInitialRate: pendingEditData.defaultMpInitialRate ?? null,
        defaultMpInitialDuration: pendingEditData.defaultMpInitialDuration ?? null,
        defaultMpMonthlyType: pendingEditData.defaultMpMonthlyType || null,
        defaultMpMonthlyRate: pendingEditData.defaultMpMonthlyRate ?? null,
        defaultMpMonthlyFixed: pendingEditData.defaultMpMonthlyFixed ?? null,
        defaultMpMonthlyDuration: pendingEditData.defaultMpMonthlyDuration ?? null,
        defaultPpInitialRate: pendingEditData.defaultPpInitialRate ?? null,
        defaultPpInitialDuration: pendingEditData.defaultPpInitialDuration ?? null,
        defaultPpPerfType: pendingEditData.defaultPpPerfType || null,
        defaultPpPerfRate: pendingEditData.defaultPpPerfRate ?? null,
        defaultPpPerfFixed: pendingEditData.defaultPpPerfFixed ?? null,
        defaultPpPerfDuration: pendingEditData.defaultPpPerfDuration ?? null,
        note: pendingEditData.note || null,
      });
      if (!result.success) {
        toast.error(`更新に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("契約履歴を更新しました");
      setEditHistory(null);
      setFormData({});
      setEditConfirm(false);
      setPendingEditData(null);
      // 会計データへの影響がある場合は警告
      if (result.affectedFinanceCount && result.affectedFinanceCount > 0) {
        setFinanceWarning(result.affectedFinanceCount);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`更新に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
      const result = await deleteAgentContractHistory(deleteConfirm.id);
      if (!result.success) {
        toast.error(`削除に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("契約履歴を削除しました");
      setDeleteConfirm(null);
      if (selectedHistoryId === deleteConfirm.id) {
        setSelectedHistoryId(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`削除に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // === 報酬例外ハンドラ ===

  const getDefaultOverrideFormData = (): Partial<CommissionOverrideData> => ({
    stpCompanyId: undefined,
    mpInitialRate: null,
    mpInitialDuration: null,
    mpMonthlyType: null,
    mpMonthlyRate: null,
    mpMonthlyFixed: null,
    mpMonthlyDuration: null,
    ppInitialRate: null,
    ppInitialDuration: null,
    ppPerfType: null,
    ppPerfRate: null,
    ppPerfFixed: null,
    ppPerfDuration: null,
    note: null,
  });

  const openOverrideAdd = () => {
    setOverrideFormData(getDefaultOverrideFormData());
    setOverrideAddMode(true);
    setOverrideEditTarget(null);
  };

  const openOverrideEdit = (override: CommissionOverride) => {
    setOverrideFormData({
      stpCompanyId: override.stpCompanyId,
      mpInitialRate: override.mpInitialRate,
      mpInitialDuration: override.mpInitialDuration,
      mpMonthlyType: override.mpMonthlyType,
      mpMonthlyRate: override.mpMonthlyRate,
      mpMonthlyFixed: override.mpMonthlyFixed,
      mpMonthlyDuration: override.mpMonthlyDuration,
      ppInitialRate: override.ppInitialRate,
      ppInitialDuration: override.ppInitialDuration,
      ppPerfType: override.ppPerfType,
      ppPerfRate: override.ppPerfRate,
      ppPerfFixed: override.ppPerfFixed,
      ppPerfDuration: override.ppPerfDuration,
      note: override.note,
    });
    setOverrideEditTarget(override);
    setOverrideAddMode(false);
  };

  const handleOverrideAdd = async () => {
    if (!selectedHistoryId || !overrideFormData.stpCompanyId) {
      toast.error("企業を選択してください");
      return;
    }
    setLoading(true);
    try {
      const result = await addCommissionOverride({
        agentContractHistoryId: selectedHistoryId,
        stpCompanyId: overrideFormData.stpCompanyId,
        mpInitialRate: overrideFormData.mpInitialRate ?? null,
        mpInitialDuration: overrideFormData.mpInitialDuration ?? null,
        mpMonthlyType: overrideFormData.mpMonthlyType || null,
        mpMonthlyRate: overrideFormData.mpMonthlyRate ?? null,
        mpMonthlyFixed: overrideFormData.mpMonthlyFixed ?? null,
        mpMonthlyDuration: overrideFormData.mpMonthlyDuration ?? null,
        ppInitialRate: overrideFormData.ppInitialRate ?? null,
        ppInitialDuration: overrideFormData.ppInitialDuration ?? null,
        ppPerfType: overrideFormData.ppPerfType || null,
        ppPerfRate: overrideFormData.ppPerfRate ?? null,
        ppPerfFixed: overrideFormData.ppPerfFixed ?? null,
        ppPerfDuration: overrideFormData.ppPerfDuration ?? null,
        note: overrideFormData.note || null,
      });
      if (!result.success) {
        toast.error(`追加に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("報酬例外を追加しました");
      setOverrideAddMode(false);
      setOverrideFormData({});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`追加に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideUpdate = async () => {
    if (!overrideEditTarget) return;
    setLoading(true);
    try {
      const result = await updateCommissionOverride(overrideEditTarget.id, {
        mpInitialRate: overrideFormData.mpInitialRate ?? null,
        mpInitialDuration: overrideFormData.mpInitialDuration ?? null,
        mpMonthlyType: overrideFormData.mpMonthlyType || null,
        mpMonthlyRate: overrideFormData.mpMonthlyRate ?? null,
        mpMonthlyFixed: overrideFormData.mpMonthlyFixed ?? null,
        mpMonthlyDuration: overrideFormData.mpMonthlyDuration ?? null,
        ppInitialRate: overrideFormData.ppInitialRate ?? null,
        ppInitialDuration: overrideFormData.ppInitialDuration ?? null,
        ppPerfType: overrideFormData.ppPerfType || null,
        ppPerfRate: overrideFormData.ppPerfRate ?? null,
        ppPerfFixed: overrideFormData.ppPerfFixed ?? null,
        ppPerfDuration: overrideFormData.ppPerfDuration ?? null,
        note: overrideFormData.note || null,
      });
      if (!result.success) {
        toast.error(`更新に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("報酬例外を更新しました");
      setOverrideEditTarget(null);
      setOverrideFormData({});
      // 会計データへの影響がある場合は警告
      if (result.affectedFinanceCount && result.affectedFinanceCount > 0) {
        setFinanceWarning(result.affectedFinanceCount);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`更新に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideDelete = async () => {
    if (!overrideDeleteConfirm) return;
    setLoading(true);
    try {
      const result = await deleteCommissionOverride(overrideDeleteConfirm.id);
      if (!result.success) {
        toast.error(`削除に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("報酬例外を削除しました");
      setOverrideDeleteConfirm(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`削除に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 選択中の契約履歴
  const selectedHistory = histories.find((h) => h.id === selectedHistoryId);

  // 紹介企業のうち、既にoverrideがある企業を除外
  const availableCompaniesForOverride = referredCompanies.filter(
    (rc) => !selectedHistory?.commissionOverrides.some((o) => o.stpCompanyId === rc.id)
  );

  // === レンダリング ===

  // 月額プラン報酬セクション（共通化）
  const renderMpSection = (
    prefix: "default" | "override",
    data: Record<string, unknown>,
    setData: (d: Record<string, unknown>) => void,
    compact?: boolean
  ) => {
    const mpInitialRate = prefix === "default" ? "defaultMpInitialRate" : "mpInitialRate";
    const mpInitialDuration = prefix === "default" ? "defaultMpInitialDuration" : "mpInitialDuration";
    const mpMonthlyType = prefix === "default" ? "defaultMpMonthlyType" : "mpMonthlyType";
    const mpMonthlyRate = prefix === "default" ? "defaultMpMonthlyRate" : "mpMonthlyRate";
    const mpMonthlyFixed = prefix === "default" ? "defaultMpMonthlyFixed" : "mpMonthlyFixed";
    const mpMonthlyDuration = prefix === "default" ? "defaultMpMonthlyDuration" : "mpMonthlyDuration";
    const labelClass = compact ? "text-xs" : "";
    const inputClass = compact ? "h-8 text-sm" : "";
    const placeholder = compact ? "デフォルト値を使用" : "";

    return (
      <div className="space-y-3">
        <h4 className={`${compact ? "text-xs" : "text-sm"} font-medium text-blue-700`}>
          月額プランを契約した企業からの報酬
        </h4>
        <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2"} gap-3`}>
          <div className="space-y-1">
            <Label className={labelClass}>初期費用報酬率(%)</Label>
            <Input
              type="number"
              step="0.01"
              value={(data[mpInitialRate] as number) ?? ""}
              onChange={(e) =>
                setData({ ...data, [mpInitialRate]: e.target.value ? Number(e.target.value) : null })
              }
              placeholder={placeholder || "例: 10"}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>報酬発生期間(ヶ月)</Label>
            <Input
              type="number"
              value={(data[mpInitialDuration] as number) ?? ""}
              onChange={(e) =>
                setData({ ...data, [mpInitialDuration]: e.target.value ? Number(e.target.value) : null })
              }
              placeholder={placeholder || "例: 12"}
              className={inputClass}
            />
          </div>
        </div>
        <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-3"} gap-3`}>
          <div className="space-y-1">
            <Label className={labelClass}>月額報酬タイプ</Label>
            <Select
              value={(data[mpMonthlyType] as string) || "none"}
              onValueChange={(v) =>
                setData({ ...data, [mpMonthlyType]: v === "none" ? null : v })
              }
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{compact ? "デフォルト" : "選択なし"}</SelectItem>
                {commMonthlyTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(data[mpMonthlyType] as string) === "rate" && (
            <div className="space-y-1">
              <Label className={labelClass}>月額報酬率(%)</Label>
              <Input
                type="number"
                step="0.01"
                value={(data[mpMonthlyRate] as number) ?? ""}
                onChange={(e) =>
                  setData({ ...data, [mpMonthlyRate]: e.target.value ? Number(e.target.value) : null })
                }
                placeholder={placeholder || "例: 5"}
                className={inputClass}
              />
            </div>
          )}
          {(data[mpMonthlyType] as string) === "fixed" && (
            <div className="space-y-1">
              <Label className={labelClass}>月額報酬固定額</Label>
              <CurrencyInput
                value={(data[mpMonthlyFixed] as number) ?? null}
                onChange={(v) => setData({ ...data, [mpMonthlyFixed]: v })}
                placeholder={placeholder || "例: 50,000"}
                className={inputClass}
              />
            </div>
          )}
          {(data[mpMonthlyType] as string) && (data[mpMonthlyType] as string) !== "none" && (
            <div className="space-y-1">
              <Label className={labelClass}>月額報酬期間(ヶ月)</Label>
              <Input
                type="number"
                value={(data[mpMonthlyDuration] as number) ?? ""}
                onChange={(e) =>
                  setData({ ...data, [mpMonthlyDuration]: e.target.value ? Number(e.target.value) : null })
                }
                placeholder={placeholder || "例: 24"}
                className={inputClass}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // 成果報酬プランセクション（共通化）
  const renderPpSection = (
    prefix: "default" | "override",
    data: Record<string, unknown>,
    setData: (d: Record<string, unknown>) => void,
    compact?: boolean
  ) => {
    const ppInitialRate = prefix === "default" ? "defaultPpInitialRate" : "ppInitialRate";
    const ppInitialDuration = prefix === "default" ? "defaultPpInitialDuration" : "ppInitialDuration";
    const ppPerfType = prefix === "default" ? "defaultPpPerfType" : "ppPerfType";
    const ppPerfRate = prefix === "default" ? "defaultPpPerfRate" : "ppPerfRate";
    const ppPerfFixed = prefix === "default" ? "defaultPpPerfFixed" : "ppPerfFixed";
    const ppPerfDuration = prefix === "default" ? "defaultPpPerfDuration" : "ppPerfDuration";
    const labelClass = compact ? "text-xs" : "";
    const inputClass = compact ? "h-8 text-sm" : "";
    const placeholder = compact ? "デフォルト値を使用" : "";

    return (
      <div className="space-y-3">
        <h4 className={`${compact ? "text-xs" : "text-sm"} font-medium text-green-700`}>
          成果報酬プランを契約した企業からの報酬
        </h4>
        <div className={`grid grid-cols-2 gap-3`}>
          <div className="space-y-1">
            <Label className={labelClass}>初期費用報酬率(%)</Label>
            <Input
              type="number"
              step="0.01"
              value={(data[ppInitialRate] as number) ?? ""}
              onChange={(e) =>
                setData({ ...data, [ppInitialRate]: e.target.value ? Number(e.target.value) : null })
              }
              placeholder={placeholder || "例: 10"}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>報酬発生期間(ヶ月)</Label>
            <Input
              type="number"
              value={(data[ppInitialDuration] as number) ?? ""}
              onChange={(e) =>
                setData({ ...data, [ppInitialDuration]: e.target.value ? Number(e.target.value) : null })
              }
              placeholder={placeholder || "例: 12"}
              className={inputClass}
            />
          </div>
        </div>
        <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-3"} gap-3`}>
          <div className="space-y-1">
            <Label className={labelClass}>成果報酬タイプ</Label>
            <Select
              value={(data[ppPerfType] as string) || "none"}
              onValueChange={(v) =>
                setData({ ...data, [ppPerfType]: v === "none" ? null : v })
              }
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{compact ? "デフォルト" : "選択なし"}</SelectItem>
                {commMonthlyTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(data[ppPerfType] as string) === "rate" && (
            <div className="space-y-1">
              <Label className={labelClass}>成果報酬率(%)</Label>
              <Input
                type="number"
                step="0.01"
                value={(data[ppPerfRate] as number) ?? ""}
                onChange={(e) =>
                  setData({ ...data, [ppPerfRate]: e.target.value ? Number(e.target.value) : null })
                }
                placeholder={placeholder || "例: 20"}
                className={inputClass}
              />
            </div>
          )}
          {(data[ppPerfType] as string) === "fixed" && (
            <div className="space-y-1">
              <Label className={labelClass}>成果報酬固定額</Label>
              <CurrencyInput
                value={(data[ppPerfFixed] as number) ?? null}
                onChange={(v) => setData({ ...data, [ppPerfFixed]: v })}
                placeholder={placeholder || "例: 100,000"}
                className={inputClass}
              />
            </div>
          )}
          {(data[ppPerfType] as string) && (data[ppPerfType] as string) !== "none" && (
            <div className="space-y-1">
              <Label className={labelClass}>成果報酬期間(ヶ月)</Label>
              <Input
                type="number"
                value={(data[ppPerfDuration] as number) ?? ""}
                onChange={(e) =>
                  setData({ ...data, [ppPerfDuration]: e.target.value ? Number(e.target.value) : null })
                }
                placeholder={placeholder || "例: 12"}
                className={inputClass}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContractForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <h3 className="font-medium text-sm">
        {isAddMode ? "契約履歴を追加" : "契約履歴を編集"}
      </h3>

      {/* 契約情報 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>
            契約開始日 <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            selected={formData.contractStartDate ? new Date(formData.contractStartDate) : null}
            onChange={(date: Date | null) => {
              setFormData({
                ...formData,
                contractStartDate: date ? toLocalDateString(date) : "",
              });
            }}
            dateFormat="yyyy/MM/dd"
            locale="ja"
            placeholderText="日付を選択"
            isClearable
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            wrapperClassName="w-full"
            calendarClassName="shadow-lg"
          />
        </div>
        <div className="space-y-2">
          <Label>契約終了日</Label>
          <DatePicker
            selected={formData.contractEndDate ? new Date(formData.contractEndDate) : null}
            onChange={(date: Date | null) => {
              setFormData({
                ...formData,
                contractEndDate: date ? toLocalDateString(date) : null,
              });
            }}
            dateFormat="yyyy/MM/dd"
            locale="ja"
            placeholderText="日付を選択"
            isClearable
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            wrapperClassName="w-full"
            calendarClassName="shadow-lg"
          />
        </div>
        <div className="space-y-2">
          <Label>
            ステータス <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.status || ""}
            onValueChange={(v) => setFormData({ ...formData, status: v })}
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
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>初期費用</Label>
          <CurrencyInput
            value={formData.initialFee ?? null}
            onChange={(v) => setFormData({ ...formData, initialFee: v })}
            placeholder="例: 150,000"
          />
        </div>
        <div className="space-y-2">
          <Label>月額費用</Label>
          <CurrencyInput
            value={formData.monthlyFee ?? null}
            onChange={(v) => setFormData({ ...formData, monthlyFee: v })}
            placeholder="例: 50,000"
          />
        </div>
      </div>

      {/* 月額プラン報酬設定 */}
      <div className="border-t pt-4">
        {renderMpSection(
          "default",
          formData as Record<string, unknown>,
          (d) => setFormData(d as Partial<AgentContractHistoryData>)
        )}
      </div>

      {/* 成果報酬プラン報酬設定 */}
      <div className="border-t pt-4">
        {renderPpSection(
          "default",
          formData as Record<string, unknown>,
          (d) => setFormData(d as Partial<AgentContractHistoryData>)
        )}
      </div>

      <div className="space-y-2">
        <Label>備考</Label>
        <Textarea
          value={formData.note || ""}
          onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
          rows={2}
          placeholder="備考を入力"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddMode(false);
            setEditHistory(null);
            setFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button onClick={isAddMode ? handleAdd : confirmEdit} disabled={loading}>
          {loading ? "保存中..." : isAddMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  const renderOverrideForm = () => (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <h4 className="text-sm font-medium">
        {overrideAddMode ? "報酬例外を追加" : "報酬例外を編集"}
      </h4>
      {overrideAddMode && (
        <div className="space-y-2">
          <Label>
            企業 <span className="text-destructive">*</span>
          </Label>
          <Select
            value={overrideFormData.stpCompanyId ? String(overrideFormData.stpCompanyId) : ""}
            onValueChange={(v) =>
              setOverrideFormData({ ...overrideFormData, stpCompanyId: Number(v) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="企業を選択" />
            </SelectTrigger>
            <SelectContent>
              {availableCompaniesForOverride.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.companyCode} - {c.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 月額プラン */}
      {renderMpSection(
        "override",
        overrideFormData as Record<string, unknown>,
        (d) => setOverrideFormData(d as Partial<CommissionOverrideData>),
        true
      )}

      {/* 成果報酬プラン */}
      {renderPpSection(
        "override",
        overrideFormData as Record<string, unknown>,
        (d) => setOverrideFormData(d as Partial<CommissionOverrideData>),
        true
      )}

      <div className="space-y-1">
        <Label className="text-xs">備考</Label>
        <Input
          value={overrideFormData.note || ""}
          onChange={(e) =>
            setOverrideFormData({ ...overrideFormData, note: e.target.value || null })
          }
          placeholder="備考"
          className="h-8 text-sm"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOverrideAddMode(false);
            setOverrideEditTarget(null);
            setOverrideFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button
          size="sm"
          onClick={overrideAddMode ? handleOverrideAdd : handleOverrideUpdate}
          disabled={loading}
        >
          {loading ? "保存中..." : overrideAddMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-5xl max-w-[calc(100%-2rem)] p-0 overflow-hidden"
          style={{
            display: "flex",
            flexDirection: "column",
            height: "90vh",
            maxHeight: "90vh",
          }}
        >
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>代理店契約履歴管理 - {agentName}</DialogTitle>
          </DialogHeader>

          <div
            className="px-6 py-4"
            style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
          >
            <div className="space-y-4">
              {/* 追加ボタン */}
              {!isAddMode && !editHistory && (
                <div className="flex justify-end">
                  <Button onClick={openAddForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    契約履歴を追加
                  </Button>
                </div>
              )}

              {/* 追加/編集フォーム */}
              {(isAddMode || editHistory) && renderContractForm()}

              {/* 契約履歴一覧 */}
              {initialLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  読み込み中...
                </div>
              ) : histories.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  契約履歴が登録されていません
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="whitespace-nowrap">ステータス</TableHead>
                        <TableHead className="whitespace-nowrap">契約開始日</TableHead>
                        <TableHead className="whitespace-nowrap">契約終了日</TableHead>
                        <TableHead className="text-right whitespace-nowrap">初期費用</TableHead>
                        <TableHead className="text-right whitespace-nowrap">月額費用</TableHead>
                        <TableHead className="whitespace-nowrap">デフォルト報酬</TableHead>
                        <TableHead className="whitespace-nowrap">備考</TableHead>
                        <TableHead className="w-[100px] whitespace-nowrap">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {histories.map((history) => (
                        <TableRow
                          key={history.id}
                          className={selectedHistoryId === history.id ? "bg-muted/50" : "cursor-pointer hover:bg-muted/30"}
                          onClick={() => {
                            if (selectedHistoryId === history.id) {
                              setSelectedHistoryId(null);
                            } else {
                              setSelectedHistoryId(history.id);
                              setOverrideAddMode(false);
                              setOverrideEditTarget(null);
                            }
                          }}
                        >
                          <TableCell>
                            {selectedHistoryId === history.id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                history.status === "契約済み"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {history.status}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(history.contractStartDate)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {history.contractEndDate ? formatDate(history.contractEndDate) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {history.initialFee != null ? formatCurrency(history.initialFee) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {history.monthlyFee != null ? formatCurrency(history.monthlyFee) : "-"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-pre-line">
                            {formatCommissionSummary(history)}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate" title={history.note || ""}>
                            {history.note || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditForm(history)}
                                disabled={isAddMode || !!editHistory}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm(history)}
                                disabled={isAddMode || !!editHistory}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* 紹介企業の報酬一覧（選択した契約に対して） */}
              {selectedHistory && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">
                      紹介企業の報酬設定（{formatDate(selectedHistory.contractStartDate)}〜）
                    </h3>
                    {!overrideAddMode && !overrideEditTarget && availableCompaniesForOverride.length > 0 && (
                      <Button size="sm" variant="outline" onClick={openOverrideAdd}>
                        <Plus className="mr-1 h-3 w-3" />
                        例外を追加
                      </Button>
                    )}
                  </div>

                  {/* 報酬例外追加/編集フォーム */}
                  {(overrideAddMode || overrideEditTarget) && renderOverrideForm()}

                  {/* 紹介企業一覧 */}
                  {referredCompanies.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4 text-sm">
                      紹介企業がありません
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">企業</TableHead>
                            <TableHead className="whitespace-nowrap">適用</TableHead>
                            <TableHead className="whitespace-nowrap">報酬内容</TableHead>
                            <TableHead className="whitespace-nowrap">備考</TableHead>
                            <TableHead className="w-[80px]">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {referredCompanies.map((company) => {
                            const override = selectedHistory.commissionOverrides.find(
                              (o) => o.stpCompanyId === company.id
                            );
                            const isOverride = !!override;

                            return (
                              <TableRow key={company.id}>
                                <TableCell className="whitespace-nowrap">
                                  {company.companyCode} - {company.companyName}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                      isOverride
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-blue-100 text-blue-700"
                                    }`}
                                  >
                                    {isOverride ? "例外" : "デフォルト"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm whitespace-pre-line">
                                  {isOverride
                                    ? formatCommissionSummary(override)
                                    : formatCommissionSummary(selectedHistory)}
                                </TableCell>
                                <TableCell className="max-w-[100px] truncate text-sm">
                                  {isOverride ? override.note || "-" : "-"}
                                </TableCell>
                                <TableCell>
                                  {isOverride && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => openOverrideEdit(override)}
                                        disabled={overrideAddMode || !!overrideEditTarget}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setOverrideDeleteConfirm(override)}
                                        disabled={overrideAddMode || !!overrideEditTarget}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 編集確認ダイアログ */}
      <AlertDialog open={editConfirm} onOpenChange={setEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>契約履歴を更新しますか？</AlertDialogTitle>
            <AlertDialogDescription>変更内容を保存します。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditConfirm(false)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdate} disabled={loading}>
              {loading ? "更新中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>契約履歴を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除された履歴は一覧に表示されなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "削除中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 報酬例外削除確認ダイアログ */}
      <AlertDialog
        open={!!overrideDeleteConfirm}
        onOpenChange={(open) => !open && setOverrideDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>報酬例外を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この企業にはデフォルトの報酬設定が適用されるようになります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOverrideDeleteConfirm(null)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverrideDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "削除中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 会計データ影響警告ダイアログ */}
      <AlertDialog open={financeWarning !== null} onOpenChange={(open) => !open && setFinanceWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <span>⚠</span> 会計データへの影響
            </AlertDialogTitle>
            <AlertDialogDescription>
              この契約に紐づく会計データが <strong>{financeWarning}件</strong> あり、金額が変わる可能性があります。
              売上経費画面で確認してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setFinanceWarning(null)}>
              確認しました
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
