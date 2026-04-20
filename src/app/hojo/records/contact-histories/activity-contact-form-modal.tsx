"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";
import {
  addHojoVendorContactHistory,
  addHojoBbsContactHistory,
  addHojoLenderContactHistory,
  addHojoOtherContactHistory,
  updateHojoContactHistory,
} from "@/app/hojo/contact-histories/actions";

type TargetType = "vendor" | "bbs" | "lender" | "other";

type EditTarget = {
  id: number;
  contactDate: string;
  contactMethodId: number | null;
  contactCategoryId: number | null;
  assignedTo: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  targetType: TargetType;
  vendorId: number | null;
  customerTypeIds: number[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: EditTarget | null;
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  contactCategories: ContactCategoryOption[];
  vendorOptions: { value: string; label: string }[];
  hojoVendorCustomerTypeId: number;
  hojoBbsCustomerTypeId: number;
  hojoLenderCustomerTypeId: number;
  hojoOtherCustomerTypeId: number;
  onSaved?: () => void;
};

function nowLocalInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toInputFromIso(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return nowLocalInput();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export function ActivityContactFormModal({
  open,
  onOpenChange,
  editTarget,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  contactCategories,
  vendorOptions,
  hojoVendorCustomerTypeId,
  hojoBbsCustomerTypeId,
  hojoLenderCustomerTypeId,
  hojoOtherCustomerTypeId,
  onSaved,
}: Props) {
  const isEdit = !!editTarget;

  const [targetType, setTargetType] = useState<TargetType>("vendor");
  const [vendorId, setVendorId] = useState<string>("");
  const [contactDate, setContactDate] = useState(nowLocalInput());
  const [contactMethodId, setContactMethodId] = useState<string>("");
  const [contactCategoryId, setContactCategoryId] = useState<string>("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [customerTypeIds, setCustomerTypeIds] = useState<number[]>([]);
  const [customerParticipants, setCustomerParticipants] = useState("");
  const [meetingMinutes, setMeetingMinutes] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requiredCustomerTypeId =
    targetType === "vendor"
      ? hojoVendorCustomerTypeId
      : targetType === "bbs"
        ? hojoBbsCustomerTypeId
        : targetType === "lender"
          ? hojoLenderCustomerTypeId
          : hojoOtherCustomerTypeId;

  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setTargetType(editTarget.targetType);
      setVendorId(editTarget.vendorId ? String(editTarget.vendorId) : "");
      setContactDate(toInputFromIso(editTarget.contactDate));
      setContactMethodId(
        editTarget.contactMethodId ? String(editTarget.contactMethodId) : ""
      );
      setContactCategoryId(
        editTarget.contactCategoryId ? String(editTarget.contactCategoryId) : ""
      );
      setSelectedStaffIds(
        editTarget.assignedTo
          ? editTarget.assignedTo.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      );
      setCustomerTypeIds(editTarget.customerTypeIds);
      setCustomerParticipants(editTarget.customerParticipants ?? "");
      setMeetingMinutes(editTarget.meetingMinutes ?? "");
      setNote(editTarget.note ?? "");
    } else {
      setTargetType("vendor");
      setVendorId("");
      setContactDate(nowLocalInput());
      setContactMethodId("");
      setContactCategoryId("");
      setSelectedStaffIds([]);
      setCustomerTypeIds([hojoVendorCustomerTypeId]);
      setCustomerParticipants("");
      setMeetingMinutes("");
      setNote("");
    }
  }, [
    open,
    editTarget,
    hojoVendorCustomerTypeId,
  ]);

  // targetType 変更時に必須タグを入れ替え（新規作成時のみ）
  useEffect(() => {
    if (isEdit) return;
    setCustomerTypeIds((prev) => {
      const filtered = prev.filter(
        (id) =>
          id !== hojoVendorCustomerTypeId &&
          id !== hojoBbsCustomerTypeId &&
          id !== hojoLenderCustomerTypeId &&
          id !== hojoOtherCustomerTypeId
      );
      return [...filtered, requiredCustomerTypeId];
    });
  }, [
    targetType,
    isEdit,
    requiredCustomerTypeId,
    hojoVendorCustomerTypeId,
    hojoBbsCustomerTypeId,
    hojoLenderCustomerTypeId,
    hojoOtherCustomerTypeId,
  ]);

  const toggleStaff = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCustomerType = (id: number) => {
    if (id === requiredCustomerTypeId) return;
    setCustomerTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!contactDate) {
      toast.error("接触日時を入力してください");
      return;
    }
    if (targetType === "vendor" && !vendorId) {
      toast.error("ベンダーを選択してください");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        contactDate,
        contactMethodId: contactMethodId ? parseInt(contactMethodId, 10) : null,
        contactCategoryId: contactCategoryId
          ? parseInt(contactCategoryId, 10)
          : null,
        assignedTo:
          selectedStaffIds.length > 0 ? selectedStaffIds.join(",") : null,
        customerParticipants: customerParticipants.trim() || null,
        meetingMinutes: meetingMinutes.trim() || null,
        note: note.trim() || null,
        customerTypeIds,
      };

      if (isEdit && editTarget) {
        await updateHojoContactHistory(editTarget.id, payload);
        toast.success("接触履歴を更新しました");
      } else {
        if (targetType === "vendor") {
          await addHojoVendorContactHistory(parseInt(vendorId, 10), payload);
        } else if (targetType === "bbs") {
          const r = await addHojoBbsContactHistory(0, payload);
          // addHojoBbsContactHistory returns formatted history directly
          void r;
        } else if (targetType === "lender") {
          await addHojoLenderContactHistory(0, payload);
        } else {
          const r = await addHojoOtherContactHistory(0, payload);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
        }
        toast.success("接触履歴を追加しました");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "接触履歴を編集" : "接触履歴を追加"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">相手種別 *</Label>
            <div className="flex gap-4 text-sm">
              {(["vendor", "bbs", "lender", "other"] as TargetType[]).map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    value={t}
                    checked={targetType === t}
                    onChange={() => setTargetType(t)}
                    disabled={isEdit}
                  />
                  <span>
                    {t === "vendor"
                      ? "ベンダー"
                      : t === "bbs"
                        ? "BBS"
                        : t === "lender"
                          ? "貸金業社"
                          : "その他"}
                  </span>
                </label>
              ))}
            </div>
            {isEdit && (
              <p className="text-[10px] text-muted-foreground">
                編集時は相手種別は変更できません
              </p>
            )}
          </div>

          {targetType === "vendor" && (
            <div className="space-y-1">
              <Label className="text-xs">ベンダー *</Label>
              <Select value={vendorId} onValueChange={setVendorId} disabled={isEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="ベンダーを選択" />
                </SelectTrigger>
                <SelectContent>
                  {vendorOptions.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">接触日時 *</Label>
            <Input
              type="datetime-local"
              value={contactDate}
              onChange={(e) => setContactDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">相手先名（任意）</Label>
            <Input
              value={customerParticipants}
              onChange={(e) => setCustomerParticipants(e.target.value)}
              placeholder="例: 〇〇株式会社 田中様"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">接触方法</Label>
              <Select value={contactMethodId} onValueChange={setContactMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {contactMethodOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">接触種別</Label>
              <Select
                value={contactCategoryId}
                onValueChange={setContactCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {contactCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">担当者</Label>
            <div className="flex flex-wrap gap-2 rounded border p-2 max-h-32 overflow-y-auto">
              {staffOptions.map((s) => (
                <label
                  key={s.value}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedStaffIds.includes(s.value)}
                    onCheckedChange={() => toggleStaff(s.value)}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
              {staffOptions.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  スタッフがいません
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">顧客種別タグ</Label>
            <div className="flex flex-wrap gap-2 rounded border p-2">
              {customerTypes.map((ct) => {
                const required = ct.id === requiredCustomerTypeId;
                return (
                  <label
                    key={ct.id}
                    className={`flex items-center gap-1.5 text-sm ${required ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={customerTypeIds.includes(ct.id)}
                      onCheckedChange={() => toggleCustomerType(ct.id)}
                      disabled={required}
                    />
                    <span>
                      {ct.name}
                      {required && " (必須)"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">議事録</Label>
            <Textarea
              value={meetingMinutes}
              onChange={(e) => setMeetingMinutes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">メモ</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? "更新する" : "追加する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
