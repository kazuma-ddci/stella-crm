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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toLocalDateString } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  getContractHistories,
  addContractHistory,
  updateContractHistory,
  deleteContractHistory,
  getStaffList,
  ContractHistoryData,
} from "./contract-history-actions";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { useTimedFormCache } from "@/hooks/use-timed-form-cache";
import { JOB_MEDIA_OPTIONS, isInvalidJobMedia } from "@/lib/stp/job-media";

// 日本語ロケールを登録
registerLocale("ja", ja);

// 選択肢の定義
const industryTypeOptions = [
  { value: "general", label: "一般" },
  { value: "dispatch", label: "派遣" },
];

const contractPlanOptions = [
  { value: "monthly", label: "月額" },
  { value: "performance", label: "成果報酬" },
];

const initialFeeOptions = [
  { value: "0", label: "0円" },
  { value: "100000", label: "100,000円" },
  { value: "150000", label: "150,000円" },
];

const statusOptions = [
  { value: "active", label: "契約中" },
  { value: "cancelled", label: "解約" },
  { value: "dormant", label: "休眠" },
];

const operationStatusOptions = [
  { value: "テスト1", label: "テスト1" },
  { value: "テスト2", label: "テスト2" },
];

const jobMediaOptions = JOB_MEDIA_OPTIONS;

// 月額費用の自動計算
// 一般+成果報酬→¥0, 一般+月額→¥150,000, 派遣+成果報酬→¥0, 派遣+月額→¥300,000
function calculateMonthlyFee(industryType: string, contractPlan: string): number {
  if (contractPlan === "performance") {
    return 0;
  }
  // 月額プランの場合
  if (industryType === "dispatch") {
    return 300000;
  }
  return 150000; // 一般
}

// 成果報酬単価の自動計算
// 月額→¥0, 成果報酬→¥150,000
function calculatePerformanceFee(contractPlan: string): number {
  if (contractPlan === "performance") {
    return 150000;
  }
  return 0;
}

type ContractHistory = {
  id: number;
  companyId: number;
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
  note: string | null;
  operationStatus: string | null;
  accountId: string | null;
  accountPass: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
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
  return value.toLocaleString() + "円";
}

export function ContractHistoryModal({
  open,
  onOpenChange,
  companyId,
  companyName,
}: Props) {
  const [histories, setHistories] = useState<ContractHistory[]>([]);
  const [salesStaffOptions, setSalesStaffOptions] = useState<{ value: string; label: string }[]>([]);
  const [operationStaffOptions, setOperationStaffOptions] = useState<{ value: string; label: string }[]>([]);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editHistory, setEditHistory] = useState<ContractHistory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ContractHistory | null>(null);
  const [editConfirm, setEditConfirm] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<Partial<ContractHistoryData> | null>(null);
  const [formData, setFormData] = useState<Partial<ContractHistoryData>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isManualMonthlyFee, setIsManualMonthlyFee] = useState(false);
  const [isManualPerformanceFee, setIsManualPerformanceFee] = useState(false);
  const [financeWarning, setFinanceWarning] = useState<number | null>(null);

  type CachedState = {
    formData: Partial<ContractHistoryData>;
    isAddMode: boolean;
    editHistory: ContractHistory | null;
    isManualMonthlyFee: boolean;
    isManualPerformanceFee: boolean;
  };
  const { restore, save, clear } = useTimedFormCache<CachedState>(
    `company-contract-history-${companyId}`
  );
  const formStateRef = useRef<CachedState>({
    formData: {},
    isAddMode: false,
    editHistory: null,
    isManualMonthlyFee: false,
    isManualPerformanceFee: false,
  });
  formStateRef.current = { formData, isAddMode, editHistory, isManualMonthlyFee, isManualPerformanceFee };

  // クローズ時にキャッシュ保存
  useEffect(() => {
    if (!open) return;
    return () => {
      save(formStateRef.current);
    };
  }, [open, save]);

  // データ取得
  const loadData = useCallback(async () => {
    setInitialLoading(true);
    try {
      const [historiesData, staffData] = await Promise.all([
        getContractHistories(companyId),
        getStaffList(),
      ]);
      setHistories(historiesData);
      setSalesStaffOptions(staffData.salesOptions);
      setOperationStaffOptions(staffData.operationOptions);
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setInitialLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) {
      loadData();
      const cached = restore();
      if (cached) {
        setFormData(cached.formData);
        setIsAddMode(cached.isAddMode);
        setEditHistory(cached.editHistory);
        setIsManualMonthlyFee(cached.isManualMonthlyFee);
        setIsManualPerformanceFee(cached.isManualPerformanceFee);
      } else {
        setFormData({});
        setIsAddMode(false);
        setEditHistory(null);
        setIsManualMonthlyFee(false);
        setIsManualPerformanceFee(false);
      }
      // 一時的なUI状態は常にリセット
      setDeleteConfirm(null);
      setEditConfirm(false);
      setPendingEditData(null);
      setFinanceWarning(null);
    }
  }, [open, loadData, restore]);

  const getDefaultFormData = (): Partial<ContractHistoryData> => {
    const defaultIndustryType = "general";
    const defaultContractPlan = "monthly";
    return {
      industryType: defaultIndustryType,
      contractPlan: defaultContractPlan,
      jobMedia: null,
      contractStartDate: "",
      contractEndDate: null,
      initialFee: 0,
      monthlyFee: calculateMonthlyFee(defaultIndustryType, defaultContractPlan),
      performanceFee: calculatePerformanceFee(defaultContractPlan),
      salesStaffId: null,
      operationStaffId: null,
      status: "active",
      note: null,
      operationStatus: null,
      accountId: null,
      accountPass: null,
    };
  };

  const openAddForm = () => {
    setFormData(getDefaultFormData());
    setIsManualMonthlyFee(false);
    setIsManualPerformanceFee(false);
    setIsAddMode(true);
  };

  const openEditForm = (history: ContractHistory) => {
    // 既存データが自動計算値と一致するかどうかで手動入力フラグを判定
    const autoMonthlyFee = calculateMonthlyFee(history.industryType, history.contractPlan);
    const autoPerformanceFee = calculatePerformanceFee(history.contractPlan);

    setFormData({
      industryType: history.industryType,
      contractPlan: history.contractPlan,
      jobMedia: history.jobMedia,
      contractStartDate: history.contractStartDate,
      contractEndDate: history.contractEndDate,
      initialFee: history.initialFee,
      monthlyFee: history.monthlyFee,
      performanceFee: history.performanceFee,
      salesStaffId: history.salesStaffId,
      operationStaffId: history.operationStaffId,
      status: history.status,
      note: history.note,
      operationStatus: history.operationStatus,
      accountId: history.accountId,
      accountPass: history.accountPass,
    });

    // 自動計算値と異なる場合は手動入力モードにする
    setIsManualMonthlyFee(history.monthlyFee !== autoMonthlyFee);
    setIsManualPerformanceFee(history.performanceFee !== autoPerformanceFee);
    setEditHistory(history);
  };

  // 業種区分変更時のハンドラ
  const handleIndustryTypeChange = (value: string) => {
    const newFormData = { ...formData, industryType: value };
    if (!isManualMonthlyFee) {
      newFormData.monthlyFee = calculateMonthlyFee(value, formData.contractPlan || "monthly");
    }
    setFormData(newFormData);
  };

  // 契約プラン変更時のハンドラ
  const handleContractPlanChange = (value: string) => {
    const newFormData = { ...formData, contractPlan: value };
    if (!isManualMonthlyFee) {
      newFormData.monthlyFee = calculateMonthlyFee(formData.industryType || "general", value);
    }
    if (!isManualPerformanceFee) {
      newFormData.performanceFee = calculatePerformanceFee(value);
    }
    setFormData(newFormData);
  };

  // 手動入力モード切り替え時のハンドラ
  const handleManualMonthlyFeeChange = (checked: boolean) => {
    setIsManualMonthlyFee(checked);
    if (!checked) {
      // 自動計算モードに戻す場合、値を再計算
      setFormData({
        ...formData,
        monthlyFee: calculateMonthlyFee(formData.industryType || "general", formData.contractPlan || "monthly"),
      });
    }
  };

  const handleManualPerformanceFeeChange = (checked: boolean) => {
    setIsManualPerformanceFee(checked);
    if (!checked) {
      // 自動計算モードに戻す場合、値を再計算
      setFormData({
        ...formData,
        performanceFee: calculatePerformanceFee(formData.contractPlan || "monthly"),
      });
    }
  };

  const handleAdd = async () => {
    if (!formData.industryType || !formData.contractPlan || !formData.contractStartDate) {
      toast.error("必須項目を入力してください");
      return;
    }
    if (isInvalidJobMedia(formData.jobMedia)) {
      toast.error("無効な求人媒体が選択されています。正しい媒体を選択してください。");
      return;
    }
    setLoading(true);
    try {
      const result = await addContractHistory(companyId, {
        industryType: formData.industryType,
        contractPlan: formData.contractPlan,
        jobMedia: formData.jobMedia || null,
        contractStartDate: formData.contractStartDate,
        contractEndDate: formData.contractEndDate || null,
        initialFee: formData.initialFee || 0,
        monthlyFee: formData.monthlyFee || 0,
        performanceFee: formData.performanceFee || 0,
        salesStaffId: formData.salesStaffId || null,
        operationStaffId: formData.operationStaffId || null,
        status: formData.status || "active",
        note: formData.note || null,
        operationStatus: formData.operationStatus || null,
        accountId: formData.accountId || null,
        accountPass: formData.accountPass || null,
      });
      if (!result.success) {
        console.error("契約履歴追加エラー:", result.error);
        toast.error(`追加に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("契約履歴を追加しました");
      setIsAddMode(false);
      setFormData({});
      setIsManualMonthlyFee(false);
      setIsManualPerformanceFee(false);
    } catch (error) {
      console.error("契約履歴追加エラー:", error);
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`追加に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmEdit = () => {
    if (isInvalidJobMedia(formData.jobMedia)) {
      toast.error("無効な求人媒体が選択されています。正しい媒体を選択してください。");
      return;
    }
    setPendingEditData(formData);
    setEditConfirm(true);
  };

  const handleUpdate = async () => {
    if (!editHistory || !pendingEditData?.industryType || !pendingEditData?.contractPlan || !pendingEditData?.contractStartDate) {
      toast.error("必須項目を入力してください");
      return;
    }
    setLoading(true);
    try {
      const result = await updateContractHistory(editHistory.id, {
        industryType: pendingEditData.industryType,
        contractPlan: pendingEditData.contractPlan,
        jobMedia: pendingEditData.jobMedia || null,
        contractStartDate: pendingEditData.contractStartDate,
        contractEndDate: pendingEditData.contractEndDate || null,
        initialFee: pendingEditData.initialFee || 0,
        monthlyFee: pendingEditData.monthlyFee || 0,
        performanceFee: pendingEditData.performanceFee || 0,
        salesStaffId: pendingEditData.salesStaffId || null,
        operationStaffId: pendingEditData.operationStaffId || null,
        status: pendingEditData.status || "active",
        note: pendingEditData.note || null,
        operationStatus: pendingEditData.operationStatus || null,
        accountId: pendingEditData.accountId || null,
        accountPass: pendingEditData.accountPass || null,
      });
      if (!result.success) {
        console.error("契約履歴更新エラー:", result.error);
        toast.error(`更新に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("契約履歴を更新しました");
      setEditHistory(null);
      setFormData({});
      setEditConfirm(false);
      setPendingEditData(null);
      setIsManualMonthlyFee(false);
      setIsManualPerformanceFee(false);
      // 会計データへの影響がある場合は警告
      if (result.affectedFinanceCount && result.affectedFinanceCount > 0) {
        setFinanceWarning(result.affectedFinanceCount);
      }
    } catch (error) {
      console.error("契約履歴更新エラー:", error);
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
      const result = await deleteContractHistory(deleteConfirm.id);
      if (!result.success) {
        console.error("契約履歴削除エラー:", result.error);
        toast.error(`削除に失敗しました: ${result.error}`);
        return;
      }
      await loadData();
      toast.success("契約履歴を削除しました");
      setDeleteConfirm(null);
    } catch (error) {
      console.error("契約履歴削除エラー:", error);
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error(`削除に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getLabelByValue = (options: { value: string; label: string }[], value: string): string => {
    const option = options.find((opt) => opt.value === value);
    return option?.label || value;
  };

  const renderForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            業種区分 <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.industryType || ""}
            onValueChange={handleIndustryTypeChange}
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
            契約プラン <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.contractPlan || ""}
            onValueChange={handleContractPlanChange}
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
        {isInvalidJobMedia(formData.jobMedia) && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            無効な媒体「{formData.jobMedia}」が設定されています。変更してください。
          </div>
        )}
        <Select
          value={formData.jobMedia || "none"}
          onValueChange={(v) => setFormData({ ...formData, jobMedia: v === "none" ? null : v })}
        >
          <SelectTrigger className={isInvalidJobMedia(formData.jobMedia) ? "border-red-500" : ""}>
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
      <div className="grid grid-cols-2 gap-4">
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
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            wrapperClassName="w-full"
            calendarClassName="shadow-lg"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>初期費用</Label>
          <Select
            value={String(formData.initialFee || 0)}
            onValueChange={(v) => setFormData({ ...formData, initialFee: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {initialFeeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>月額</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="manualMonthlyFee"
                checked={isManualMonthlyFee}
                onCheckedChange={(checked) => handleManualMonthlyFeeChange(checked === true)}
              />
              <label
                htmlFor="manualMonthlyFee"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                手動入力
              </label>
            </div>
          </div>
          <Input
            type="number"
            value={formData.monthlyFee ?? ""}
            onChange={(e) => setFormData({ ...formData, monthlyFee: Number(e.target.value) || 0 })}
            placeholder="0"
            disabled={!isManualMonthlyFee}
            className={!isManualMonthlyFee ? "bg-muted" : ""}
          />
          {!isManualMonthlyFee && (
            <p className="text-xs text-muted-foreground">
              自動計算: {formatCurrency(calculateMonthlyFee(formData.industryType || "general", formData.contractPlan || "monthly"))}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>成果報酬単価</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="manualPerformanceFee"
                checked={isManualPerformanceFee}
                onCheckedChange={(checked) => handleManualPerformanceFeeChange(checked === true)}
              />
              <label
                htmlFor="manualPerformanceFee"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                手動入力
              </label>
            </div>
          </div>
          <Input
            type="number"
            value={formData.performanceFee ?? ""}
            onChange={(e) => setFormData({ ...formData, performanceFee: Number(e.target.value) || 0 })}
            placeholder="0"
            disabled={!isManualPerformanceFee}
            className={!isManualPerformanceFee ? "bg-muted" : ""}
          />
          {!isManualPerformanceFee && (
            <p className="text-xs text-muted-foreground">
              自動計算: {formatCurrency(calculatePerformanceFee(formData.contractPlan || "monthly"))}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>担当営業</Label>
          <Select
            value={formData.salesStaffId ? String(formData.salesStaffId) : "none"}
            onValueChange={(v) => setFormData({ ...formData, salesStaffId: v === "none" ? null : Number(v) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">選択なし</SelectItem>
              {salesStaffOptions.map((opt) => (
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
            value={formData.operationStaffId ? String(formData.operationStaffId) : "none"}
            onValueChange={(v) => setFormData({ ...formData, operationStaffId: v === "none" ? null : Number(v) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">選択なし</SelectItem>
              {operationStaffOptions.map((opt) => (
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
          value={formData.status || "active"}
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
      <div className="space-y-2">
        <Label>運用ステータス</Label>
        <Select
          value={formData.operationStatus || "none"}
          onValueChange={(v) => setFormData({ ...formData, operationStatus: v === "none" ? null : v })}
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
            value={formData.accountId || ""}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value || null })}
            placeholder="アカウントIDを入力"
          />
        </div>
        <div className="space-y-2">
          <Label>アカウントPASS</Label>
          <Input
            type="text"
            value={formData.accountPass || ""}
            onChange={(e) => setFormData({ ...formData, accountPass: e.target.value || null })}
            placeholder="パスワードを入力"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>備考</Label>
        <Textarea
          value={formData.note || ""}
          onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
          rows={3}
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
            setIsManualMonthlyFee(false);
            setIsManualPerformanceFee(false);
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddMode ? handleAdd : confirmEdit}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  // 契約開始日でソート（降順）
  const sortedHistories = [...histories].sort(
    (a, b) => new Date(b.contractStartDate).getTime() - new Date(a.contractStartDate).getTime()
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-5xl max-w-[calc(100%-2rem)] p-0 overflow-hidden"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '90vh',
            maxHeight: '90vh'
          }}
        >
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>契約履歴管理 - {companyName}</DialogTitle>
          </DialogHeader>

          <div
            className="px-6 py-4"
            style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
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
            {(isAddMode || editHistory) && renderForm()}

            {/* 契約履歴一覧 */}
            {initialLoading ? (
              <div className="text-center text-muted-foreground py-8">
                読み込み中...
              </div>
            ) : sortedHistories.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                契約履歴が登録されていません
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">業種区分</TableHead>
                    <TableHead className="whitespace-nowrap">契約プラン</TableHead>
                    <TableHead className="whitespace-nowrap">求人媒体</TableHead>
                    <TableHead className="whitespace-nowrap">契約開始日</TableHead>
                    <TableHead className="whitespace-nowrap">契約終了日</TableHead>
                    <TableHead className="text-right whitespace-nowrap">初期費用</TableHead>
                    <TableHead className="text-right whitespace-nowrap">月額</TableHead>
                    <TableHead className="text-right whitespace-nowrap">成果報酬単価</TableHead>
                    <TableHead className="whitespace-nowrap">担当営業</TableHead>
                    <TableHead className="whitespace-nowrap">担当運用</TableHead>
                    <TableHead className="whitespace-nowrap">ステータス</TableHead>
                    <TableHead className="whitespace-nowrap">運用ステータス</TableHead>
                    <TableHead className="whitespace-nowrap">アカウントID</TableHead>
                    <TableHead className="whitespace-nowrap">アカウントPASS</TableHead>
                    <TableHead className="whitespace-nowrap">備考</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistories.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell>{getLabelByValue(industryTypeOptions, history.industryType)}</TableCell>
                      <TableCell>{getLabelByValue(contractPlanOptions, history.contractPlan)}</TableCell>
                      <TableCell>
                        {history.jobMedia
                          ? isInvalidJobMedia(history.jobMedia)
                            ? <span className="text-red-600 font-medium">{"\u26A0"} {history.jobMedia}</span>
                            : history.jobMedia
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(history.contractStartDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {history.contractEndDate ? formatDate(history.contractEndDate) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(history.initialFee)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(history.monthlyFee)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(history.performanceFee)}
                      </TableCell>
                      <TableCell>{history.salesStaffName || "-"}</TableCell>
                      <TableCell>{history.operationStaffName || "-"}</TableCell>
                      <TableCell>{getLabelByValue(statusOptions, history.status)}</TableCell>
                      <TableCell>{history.operationStatus || "-"}</TableCell>
                      <TableCell>{history.accountId || "-"}</TableCell>
                      <TableCell>{history.accountPass || "-"}</TableCell>
                      <TableCell>
                        <TextPreviewCell text={history.note} title="備考" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
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
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 編集確認ダイアログ */}
      <AlertDialog open={editConfirm} onOpenChange={setEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>契約履歴を更新しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              変更内容を保存します。
            </AlertDialogDescription>
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
