"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createMediaAd, updateMediaAd } from "./actions";

type Contract = {
  id: number;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  contractPlan: string;
};

type AdFormData = {
  id?: number;
  contractHistoryId?: number;
  adNumber: string;
  adName: string;
  status: string;
  startDate: string;
  endDate: string;
  budgetLimit: string;
};

const AD_STATUSES = [
  { value: "active", label: "配信中" },
  { value: "ended", label: "終了" },
  { value: "preparing", label: "準備中" },
  { value: "paused", label: "停止中" },
];

export function AdFormDialog({
  open,
  onOpenChange,
  contracts,
  editingAd,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
  editingAd?: {
    id: number;
    adNumber: string;
    adName: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    budgetLimit: number | null;
  } | null;
  onSuccess: () => void;
}) {
  const isEdit = !!editingAd;

  const [form, setForm] = useState<AdFormData>({
    contractHistoryId: editingAd ? undefined : contracts[0]?.id,
    adNumber: editingAd?.adNumber ?? "",
    adName: editingAd?.adName ?? "",
    status: editingAd?.status ?? "active",
    startDate: editingAd?.startDate ?? "",
    endDate: editingAd?.endDate ?? "",
    budgetLimit: editingAd?.budgetLimit?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isEdit && !form.contractHistoryId) {
      toast.error("契約を選択してください");
      return;
    }
    if (!form.adNumber.trim()) {
      toast.error("広告番号を入力してください");
      return;
    }
    if (!form.adName.trim()) {
      toast.error("広告名を入力してください");
      return;
    }

    setSaving(true);
    try {
      const result = isEdit
        ? await updateMediaAd(editingAd!.id, {
            adName: form.adName,
            status: form.status,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            budgetLimit: form.budgetLimit
              ? parseInt(form.budgetLimit, 10)
              : null,
          })
        : await createMediaAd({
            contractHistoryId: form.contractHistoryId!,
            adNumber: form.adNumber,
            adName: form.adName,
            status: form.status,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            budgetLimit: form.budgetLimit
              ? parseInt(form.budgetLimit, 10)
              : null,
          });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "広告を更新しました" : "広告を追加しました");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const formatContractLabel = (c: Contract) => {
    const media = c.jobMedia || "未設定";
    const start = c.contractStartDate;
    const end = c.contractEndDate || "〜";
    return `${media}（${start}〜${end}）`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "広告を編集" : "広告を追加"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!isEdit && (
            <div>
              <Label>契約 *</Label>
              <Select
                value={form.contractHistoryId?.toString() ?? ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, contractHistoryId: Number(v) }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="契約を選択" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {formatContractLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>広告番号 *</Label>
            <Input
              value={form.adNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, adNumber: e.target.value }))
              }
              placeholder="例: 2048083"
              disabled={isEdit}
            />
          </div>
          <div>
            <Label>広告名 *</Label>
            <Input
              value={form.adName}
              onChange={(e) =>
                setForm((f) => ({ ...f, adName: e.target.value }))
              }
              placeholder="例: 施工管理"
            />
          </div>
          <div>
            <Label>状態</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>開始日</Label>
              <DatePicker
                value={form.startDate}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                placeholder="任意"
              />
            </div>
            <div>
              <Label>終了日</Label>
              <DatePicker
                value={form.endDate}
                onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                placeholder="任意"
              />
            </div>
          </div>
          <div>
            <Label>予算上限（円）</Label>
            <Input
              type="number"
              value={form.budgetLimit}
              onChange={(e) =>
                setForm((f) => ({ ...f, budgetLimit: e.target.value }))
              }
              placeholder="任意"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "更新" : "追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
