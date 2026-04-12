"use client";

import { useState } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  addContractHistory,
  updateContractHistory,
  type ContractHistoryData,
} from "../../contract-history-actions";

const UNSET = "__unset__";

const INDUSTRY_OPTIONS = [
  { value: "general", label: "一般" },
  { value: "dispatch", label: "派遣" },
];

const PLAN_OPTIONS = [
  { value: "monthly", label: "月額" },
  { value: "performance", label: "成果報酬" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "契約中" },
  { value: "scheduled", label: "契約予定" },
  { value: "cancelled", label: "解約" },
  { value: "dormant", label: "休眠" },
];

type EditingHistory = {
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
  operationStaffId: number | null;
  status: string;
  note: string | null;
  operationStatus: string | null;
  accountId: string | null;
  accountPass: string | null;
  contractDate: string | null;
};

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-600 font-medium">{label}</Label>
      {children}
    </div>
  );
}

export function ContractHistoryFormInline({
  companyId,
  editingHistory,
  staffOptions,
  onSuccess,
  onCancel,
}: {
  companyId: number;
  editingHistory: EditingHistory | null;
  staffOptions: { value: string; label: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!editingHistory;

  const [industryType, setIndustryType] = useState(editingHistory?.industryType || "general");
  const [contractPlan, setContractPlan] = useState(editingHistory?.contractPlan || "monthly");
  const [jobMedia, setJobMedia] = useState(editingHistory?.jobMedia || "");
  const [contractStartDate, setContractStartDate] = useState(editingHistory?.contractStartDate || "");
  const [contractEndDate, setContractEndDate] = useState(editingHistory?.contractEndDate || "");
  const [initialFee, setInitialFee] = useState(editingHistory?.initialFee?.toString() || "0");
  const [monthlyFee, setMonthlyFee] = useState(editingHistory?.monthlyFee?.toString() || "0");
  const [performanceFee, setPerformanceFee] = useState(editingHistory?.performanceFee?.toString() || "0");
  const [salesStaffId, setSalesStaffId] = useState(editingHistory?.salesStaffId?.toString() || "");
  const [operationStaffId, setOperationStaffId] = useState(editingHistory?.operationStaffId?.toString() || "");
  const [status, setStatus] = useState(editingHistory?.status || "active");
  const [note, setNote] = useState(editingHistory?.note || "");
  const [operationStatus, setOperationStatus] = useState(editingHistory?.operationStatus || "");
  const [accountId, setAccountId] = useState(editingHistory?.accountId || "");
  const [accountPass, setAccountPass] = useState(editingHistory?.accountPass || "");
  const [contractDate, setContractDate] = useState(editingHistory?.contractDate || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!contractStartDate) {
      toast.error("契約開始日は必須です");
      return;
    }

    setSaving(true);
    const data: ContractHistoryData = {
      industryType,
      contractPlan,
      jobMedia: jobMedia || null,
      contractStartDate,
      contractEndDate: contractEndDate || null,
      initialFee: parseInt(initialFee, 10) || 0,
      monthlyFee: parseInt(monthlyFee, 10) || 0,
      performanceFee: parseInt(performanceFee, 10) || 0,
      salesStaffId: salesStaffId ? parseInt(salesStaffId, 10) : null,
      operationStaffId: operationStaffId ? parseInt(operationStaffId, 10) : null,
      status,
      note: note || null,
      operationStatus: operationStatus || null,
      accountId: accountId || null,
      accountPass: accountPass || null,
      masterContractId: editingHistory?.id ? null : null,
      contractDate: contractDate || null,
    };

    try {
      const result = isEdit
        ? await updateContractHistory(editingHistory!.id, data)
        : await addContractHistory(companyId, data);

      if (result.success) {
        toast.success(isEdit ? "契約履歴を更新しました" : "契約履歴を追加しました");
        onSuccess();
      } else {
        toast.error(result.error || "保存に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <FieldBlock label="業種区分 *">
          <Select value={industryType} onValueChange={setIndustryType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBlock>
        <FieldBlock label="契約プラン *">
          <Select value={contractPlan} onValueChange={setContractPlan}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBlock>
        <FieldBlock label="求人媒体">
          <Input value={jobMedia} onChange={(e) => setJobMedia(e.target.value)} placeholder="例: Airワーク" />
        </FieldBlock>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FieldBlock label="契約開始日 *">
          <DatePicker value={contractStartDate} onChange={setContractStartDate} placeholder="必須" />
        </FieldBlock>
        <FieldBlock label="契約終了日">
          <DatePicker value={contractEndDate} onChange={setContractEndDate} placeholder="任意" />
        </FieldBlock>
        <FieldBlock label="ステータス *">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBlock>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FieldBlock label="月額（円）">
          <Input type="number" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
        </FieldBlock>
        <FieldBlock label="初期費用（円）">
          <Input type="number" value={initialFee} onChange={(e) => setInitialFee(e.target.value)} />
        </FieldBlock>
        <FieldBlock label="成果報酬単価（円）">
          <Input type="number" value={performanceFee} onChange={(e) => setPerformanceFee(e.target.value)} />
        </FieldBlock>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldBlock label="担当営業">
          <Select value={salesStaffId || UNSET} onValueChange={(v) => setSalesStaffId(v === UNSET ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="未選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>未選択</SelectItem>
              {staffOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBlock>
        <FieldBlock label="担当運用">
          <Select value={operationStaffId || UNSET} onValueChange={(v) => setOperationStaffId(v === UNSET ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="未選択" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>未選択</SelectItem>
              {staffOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldBlock>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FieldBlock label="運用ステータス">
          <Input value={operationStatus} onChange={(e) => setOperationStatus(e.target.value)} placeholder="任意" />
        </FieldBlock>
        <FieldBlock label="アカウントID">
          <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="任意" />
        </FieldBlock>
        <FieldBlock label="アカウントPASS">
          <Input value={accountPass} onChange={(e) => setAccountPass(e.target.value)} placeholder="任意" />
        </FieldBlock>
      </div>

      <FieldBlock label="備考">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="備考・メモ" />
      </FieldBlock>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>キャンセル</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "更新" : "追加"}
        </Button>
      </div>
    </div>
  );
}
