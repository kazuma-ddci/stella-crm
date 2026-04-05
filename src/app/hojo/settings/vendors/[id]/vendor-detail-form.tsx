"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { VendorStatusManagementModal } from "../vendor-status-management-modal";
import {
  Settings,
  Save,
  Loader2,
  Star,
  Plus,
  Pencil,
  Trash2,
  Users,
  Mail,
  Phone,
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { updateVendorDetail, updateVendorConsultingStaff, updateVendorAssignedAs } from "./actions";
import {
  addVendorContact,
  updateVendorContact,
  deleteVendorContact,
  setPrimaryContact,
} from "../actions";
import type { StatusType } from "../vendor-status-management-modal";

type ContactData = {
  id: number;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  lineFriendId: number | null;
  lineFriendName: string | null;
  joseiLineFriendId: number | null;
  joseiLineFriendName: string | null;
  isPrimary: boolean;
};

type Props = {
  vendor: {
    id: number;
    name: string;
    contractDate: string;
    caseStatusId: number | null;
    consultingStartDate: string;
    consultingEndDate: string;
    scWholesaleStatusId: number | null;
    scWholesaleKickoffMtg: string;
    scWholesaleContractUrl: string;
    consultingPlanStatusId: number | null;
    consultingPlanKickoffMtg: string;
    consultingPlanContractUrl: string;
    grantApplicationBpo: boolean;
    grantApplicationBpoKickoffMtg: string;
    grantApplicationBpoContractUrl: string;
    subsidyConsulting: boolean;
    subsidyConsultingKickoffMtg: string;
    loanUsage: boolean;
    loanUsageKickoffMtg: string;
    loanUsageContractUrl: string;
    vendorRegistrationStatusId: number | null;
    toolRegistrationStatusId: number | null;
    memo: string;
    vendorSharedMemo: string;
    assignedAsLineFriendId: number | null;
  };
  contacts: ContactData[];
  scLineFriendSelectOptions: { value: string; label: string }[];
  joseiLineFriendSelectOptions: { value: string; label: string }[];
  scWholesaleOptions: { value: string; label: string }[];
  consultingPlanOptions: { value: string; label: string }[];
  caseStatusOptions: { value: string; label: string }[];
  vendorRegistrationOptions: { value: string; label: string }[];
  toolRegistrationOptions: { value: string; label: string }[];
  scLabel: string;
  joseiLabel: string;
  staffOptions: { value: string; label: string }[];
  currentConsultingStaffIds: number[];
  assignedAsLineFriendId: number | null;
  assignedAsLineFriendLabel: string | null;
  autoDetectedAsLabel: string | null;
  autoDetectedAsLineFriendId: number | null;
  scLineFriendsForAs: { value: string; label: string }[];
};

const UNSET_VALUE = "__unset__";
const CUSTOM_ROLE_VALUE = "__custom__";

function getRoleDisplayLabel(role: string | null): string | null {
  if (!role) return null;
  if (role === "representative") return "代表者";
  if (role === "contact_person") return "主担当者";
  return role; // custom role text
}

function getRoleBadgeColor(role: string | null): string {
  if (role === "representative") return "text-blue-600 border-blue-300 bg-blue-50";
  if (role === "contact_person") return "text-green-600 border-green-300 bg-green-50";
  return "text-gray-600 border-gray-300 bg-gray-50"; // custom role
}

export function VendorDetailForm({
  vendor,
  contacts,
  scLineFriendSelectOptions,
  joseiLineFriendSelectOptions,
  scWholesaleOptions,
  consultingPlanOptions,
  caseStatusOptions,
  vendorRegistrationOptions,
  toolRegistrationOptions,
  scLabel,
  joseiLabel,
  staffOptions,
  currentConsultingStaffIds,
  assignedAsLineFriendLabel,
  autoDetectedAsLabel,
  autoDetectedAsLineFriendId,
  scLineFriendsForAs,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // サービス契約状況
  const [scWholesaleStatusId, setScWholesaleStatusId] = useState<string>(
    vendor.scWholesaleStatusId ? String(vendor.scWholesaleStatusId) : ""
  );
  const [scWholesaleKickoffMtg, setScWholesaleKickoffMtg] = useState(vendor.scWholesaleKickoffMtg);
  const [scWholesaleContractUrl, setScWholesaleContractUrl] = useState(vendor.scWholesaleContractUrl);

  const [consultingPlanStatusId, setConsultingPlanStatusId] = useState<string>(
    vendor.consultingPlanStatusId ? String(vendor.consultingPlanStatusId) : ""
  );
  const [consultingPlanKickoffMtg, setConsultingPlanKickoffMtg] = useState(vendor.consultingPlanKickoffMtg);
  const [consultingPlanContractUrl, setConsultingPlanContractUrl] = useState(vendor.consultingPlanContractUrl);

  // 契約日・案件ステータス・開始日・終了予定日
  const [contractDate, setContractDate] = useState(vendor.contractDate);
  const [caseStatusId, setCaseStatusId] = useState<string>(
    vendor.caseStatusId ? String(vendor.caseStatusId) : ""
  );
  const [consultingStartDate, setConsultingStartDate] = useState(vendor.consultingStartDate);
  const [consultingEndDate, setConsultingEndDate] = useState(vendor.consultingEndDate);

  const [grantApplicationBpo, setGrantApplicationBpo] = useState(vendor.grantApplicationBpo);
  const [grantApplicationBpoKickoffMtg, setGrantApplicationBpoKickoffMtg] = useState(
    vendor.grantApplicationBpoKickoffMtg
  );
  const [grantApplicationBpoContractUrl, setGrantApplicationBpoContractUrl] = useState(
    vendor.grantApplicationBpoContractUrl
  );

  const [subsidyConsulting, setSubsidyConsulting] = useState(vendor.subsidyConsulting);
  const [subsidyConsultingKickoffMtg, setSubsidyConsultingKickoffMtg] = useState(
    vendor.subsidyConsultingKickoffMtg
  );

  const [loanUsage, setLoanUsage] = useState(vendor.loanUsage);
  const [loanUsageKickoffMtg, setLoanUsageKickoffMtg] = useState(vendor.loanUsageKickoffMtg);
  const [loanUsageContractUrl, setLoanUsageContractUrl] = useState(vendor.loanUsageContractUrl);

  const [vendorRegistrationStatusId, setVendorRegistrationStatusId] = useState<string>(
    vendor.vendorRegistrationStatusId ? String(vendor.vendorRegistrationStatusId) : ""
  );

  const [toolRegistrationStatusId, setToolRegistrationStatusId] = useState<string>(
    vendor.toolRegistrationStatusId ? String(vendor.toolRegistrationStatusId) : ""
  );

  // ステータス管理モーダル
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalType, setStatusModalType] = useState<StatusType>("scWholesale");

  const openStatusModal = (type: StatusType) => {
    setStatusModalType(type);
    setStatusModalOpen(true);
  };

  // その他
  const [memo, setMemo] = useState(vendor.memo);
  const [vendorSharedMemo, setVendorSharedMemo] = useState(vendor.vendorSharedMemo);

  // コンサル担当者・担当AS
  const [consultingStaffIds, setConsultingStaffIds] = useState<number[]>(currentConsultingStaffIds);
  const [asLineFriendId, setAsLineFriendId] = useState<string>(
    vendor.assignedAsLineFriendId ? String(vendor.assignedAsLineFriendId) : ""
  );
  const [consultingStaffPending, setConsultingStaffPending] = useState(false);
  const [asPending, setAsPending] = useState(false);

  // 未保存変更の検出
  const currentValues = useMemo(() => JSON.stringify({
    scWholesaleStatusId, scWholesaleKickoffMtg, scWholesaleContractUrl,
    consultingPlanStatusId, consultingPlanKickoffMtg, consultingPlanContractUrl,
    contractDate, caseStatusId, consultingStartDate, consultingEndDate,
    grantApplicationBpo, grantApplicationBpoKickoffMtg, grantApplicationBpoContractUrl,
    subsidyConsulting, subsidyConsultingKickoffMtg,
    loanUsage, loanUsageKickoffMtg, loanUsageContractUrl,
    vendorRegistrationStatusId, toolRegistrationStatusId, memo, vendorSharedMemo,
    consultingStaffIds: [...consultingStaffIds].sort(),
    asLineFriendId,
  }), [
    scWholesaleStatusId, scWholesaleKickoffMtg, scWholesaleContractUrl,
    consultingPlanStatusId, consultingPlanKickoffMtg, consultingPlanContractUrl,
    contractDate, caseStatusId, consultingStartDate, consultingEndDate,
    grantApplicationBpo, grantApplicationBpoKickoffMtg, grantApplicationBpoContractUrl,
    subsidyConsulting, subsidyConsultingKickoffMtg,
    loanUsage, loanUsageKickoffMtg, loanUsageContractUrl,
    vendorRegistrationStatusId, toolRegistrationStatusId, memo, vendorSharedMemo,
    consultingStaffIds, asLineFriendId,
  ]);

  const [savedValues, setSavedValues] = useState(currentValues);
  const isDirty = currentValues !== savedValues;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const guardNavigation = useCallback((e: MouseEvent) => {
    if (!isDirty) return;
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;
    const href = target.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
    if (!confirm("編集したデータが保存されていませんがよろしいですか？")) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [isDirty]);

  useEffect(() => {
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [guardNavigation]);

  // 担当者管理
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [formName, setFormName] = useState("");
  const [formRoleSelect, setFormRoleSelect] = useState<string>(UNSET_VALUE); // "representative" | "contact_person" | "__custom__" | "__unset__"
  const [formRoleCustomText, setFormRoleCustomText] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formScId, setFormScId] = useState("");
  const [formJoseiId, setFormJoseiId] = useState("");
  const [contactPending, setContactPending] = useState(false);

  function getFormRoleValue(): string {
    if (formRoleSelect === UNSET_VALUE) return "";
    if (formRoleSelect === CUSTOM_ROLE_VALUE) return formRoleCustomText.trim();
    return formRoleSelect; // "representative" or "contact_person"
  }

  function openAddContactDialog() {
    setEditingContact(null);
    setFormName("");
    setFormRoleSelect(UNSET_VALUE);
    setFormRoleCustomText("");
    setFormEmail("");
    setFormPhone("");
    setFormScId("");
    setFormJoseiId("");
    setContactDialogOpen(true);
  }

  function openEditContactDialog(contact: ContactData) {
    setEditingContact(contact);
    setFormName(contact.name || "");
    // Determine role select value
    if (!contact.role) {
      setFormRoleSelect(UNSET_VALUE);
      setFormRoleCustomText("");
    } else if (contact.role === "representative" || contact.role === "contact_person") {
      setFormRoleSelect(contact.role);
      setFormRoleCustomText("");
    } else {
      setFormRoleSelect(CUSTOM_ROLE_VALUE);
      setFormRoleCustomText(contact.role);
    }
    setFormEmail(contact.email || "");
    setFormPhone(contact.phone || "");
    setFormScId(contact.lineFriendId ? String(contact.lineFriendId) : "");
    setFormJoseiId(contact.joseiLineFriendId ? String(contact.joseiLineFriendId) : "");
    setContactDialogOpen(true);
  }

  function closeContactDialog() {
    setContactDialogOpen(false);
    setEditingContact(null);
  }

  async function handleSaveContact() {
    const scId = formScId ? Number(formScId) : null;
    const joseiId = formJoseiId ? Number(formJoseiId) : null;
    if (!scId && !joseiId && !formName.trim()) {
      toast.error("名前またはLINE情報を入力してください");
      return;
    }

    const role = getFormRoleValue();

    // Validate unique representative/contact_person
    if (role === "representative" || role === "contact_person") {
      const existingWithRole = contacts.find(
        (c) => c.role === role && c.id !== editingContact?.id
      );
      if (existingWithRole) {
        const roleLabel = role === "representative" ? "代表者" : "主担当者";
        const existingName = existingWithRole.name || existingWithRole.lineFriendName || "(名前なし)";
        const confirmed = confirm(
          `既に${roleLabel}として「${existingName}」が登録されています。\n「${existingName}」の${roleLabel}を解除して変更しますか？`
        );
        if (!confirmed) return;
      }
    }

    setContactPending(true);
    try {
      const extra = { name: formName, role, email: formEmail, phone: formPhone };
      if (editingContact) {
        await updateVendorContact(editingContact.id, scId, joseiId, extra);
        toast.success("担当者を更新しました");
      } else {
        await addVendorContact(vendor.id, scId, joseiId, extra);
        toast.success("担当者を追加しました");
      }
      closeContactDialog();
      router.refresh();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setContactPending(false);
    }
  }

  async function handleDeleteContact(contactId: number) {
    if (!confirm("この担当者を削除しますか？")) return;
    try {
      await deleteVendorContact(contactId);
      toast.success("担当者を削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  async function handleSetPrimary(contactId: number) {
    try {
      await setPrimaryContact(contactId);
      toast.success("主担当を変更しました");
      router.refresh();
    } catch {
      toast.error("変更に失敗しました");
    }
  }

  async function handleSaveConsultingStaff() {
    setConsultingStaffPending(true);
    try {
      await updateVendorConsultingStaff(vendor.id, consultingStaffIds);
      setSavedValues(currentValues);
      toast.success("コンサル担当者を更新しました");
      router.refresh();
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setConsultingStaffPending(false);
    }
  }

  async function handleSaveAssignedAs() {
    setAsPending(true);
    try {
      await updateVendorAssignedAs(vendor.id, asLineFriendId ? Number(asLineFriendId) : null);
      setSavedValues(currentValues);
      toast.success("担当ASを更新しました");
      router.refresh();
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setAsPending(false);
    }
  }

  function handleClearAssignedAs() {
    setAsLineFriendId("");
    // Immediately save with null
    setAsPending(true);
    updateVendorAssignedAs(vendor.id, null)
      .then(() => {
        setSavedValues(JSON.stringify({ ...JSON.parse(currentValues), asLineFriendId: "" }));
        toast.success("担当ASをクリアしました");
        router.refresh();
      })
      .catch(() => {
        toast.error("更新に失敗しました");
      })
      .finally(() => {
        setAsPending(false);
      });
  }

  function toggleConsultingStaff(staffId: number) {
    setConsultingStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateVendorDetail(vendor.id, {
          contractDate: contractDate || null,
          caseStatusId: caseStatusId ? Number(caseStatusId) : null,
          scWholesaleStatusId: scWholesaleStatusId ? Number(scWholesaleStatusId) : null,
          scWholesaleKickoffMtg,
          scWholesaleContractUrl,
          consultingPlanStatusId: consultingPlanStatusId ? Number(consultingPlanStatusId) : null,
          consultingPlanKickoffMtg,
          consultingPlanContractUrl,
          consultingStartDate: consultingStartDate || null,
          consultingEndDate: consultingEndDate || null,
          grantApplicationBpo,
          grantApplicationBpoKickoffMtg,
          grantApplicationBpoContractUrl,
          subsidyConsulting,
          subsidyConsultingKickoffMtg,
          loanUsage,
          loanUsageKickoffMtg,
          loanUsageContractUrl,
          vendorRegistrationStatusId: vendorRegistrationStatusId
            ? Number(vendorRegistrationStatusId)
            : null,
          toolRegistrationStatusId: toolRegistrationStatusId
            ? Number(toolRegistrationStatusId)
            : null,
          memo,
          vendorSharedMemo,
        });
        setSavedValues(currentValues);
        toast.success("保存しました");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 担当者管理 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            担当者管理
          </CardTitle>
          <Button size="sm" variant="outline" onClick={openAddContactDialog}>
            <Plus className="h-4 w-4 mr-1" />
            担当者追加
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              担当者が登録されていません
            </p>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => {
                const roleLabel = getRoleDisplayLabel(c.role);
                return (
                  <div key={c.id} className="p-4 border rounded-lg space-y-1.5">
                    {/* Name + badges + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-sm font-semibold">
                          {c.name || c.lineFriendName || "(名前なし)"}
                        </span>
                        {c.isPrimary && (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-300 bg-amber-50 text-xs"
                          >
                            <Star className="h-3 w-3 mr-0.5 fill-amber-500" />
                            主担当
                          </Badge>
                        )}
                        {roleLabel && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${getRoleBadgeColor(c.role)}`}
                          >
                            {roleLabel}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!c.isPrimary && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="主担当に設定"
                            onClick={() => handleSetPrimary(c.id)}
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="編集"
                          onClick={() => openEditContactDialog(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="削除"
                          onClick={() => handleDeleteContact(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Email / Phone */}
                    {(c.email || c.phone) && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </span>
                        )}
                      </div>
                    )}
                    {/* LINE info */}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>
                        {scLabel}LINE: {c.lineFriendId ? `${c.lineFriendId} ${c.lineFriendName || ""}`.trim() : "---"}
                      </div>
                      <div>
                        {joseiLabel}LINE: {c.joseiLineFriendId ? `${c.joseiLineFriendId} ${c.joseiLineFriendName || ""}`.trim() : "---"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 担当者追加/編集ダイアログ */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "担当者を編集" : "担当者を追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>名前</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="担当者名"
              />
            </div>
            <div className="space-y-2">
              <Label>役割</Label>
              <Select
                value={formRoleSelect}
                onValueChange={(v) => {
                  setFormRoleSelect(v);
                  if (v !== CUSTOM_ROLE_VALUE) setFormRoleCustomText("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>なし</SelectItem>
                  <SelectItem value="representative">代表者</SelectItem>
                  <SelectItem value="contact_person">主担当者</SelectItem>
                  <SelectItem value={CUSTOM_ROLE_VALUE}>その他（手入力）</SelectItem>
                </SelectContent>
              </Select>
              {formRoleSelect === CUSTOM_ROLE_VALUE && (
                <Input
                  value={formRoleCustomText}
                  onChange={(e) => setFormRoleCustomText(e.target.value)}
                  placeholder="役割名を入力（例: 営業担当、経理担当）"
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>メールアドレス</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="example@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>電話番号</Label>
              <Input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="03-xxxx-xxxx"
              />
            </div>
            <div className="space-y-2">
              <Label>{scLabel}LINE</Label>
              <Select
                value={formScId || UNSET_VALUE}
                onValueChange={(v) => setFormScId(v === UNSET_VALUE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                  {scLineFriendSelectOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{joseiLabel}LINE</Label>
              <Select
                value={formJoseiId || UNSET_VALUE}
                onValueChange={(v) => setFormJoseiId(v === UNSET_VALUE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                  {joseiLineFriendSelectOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeContactDialog}>
              キャンセル
            </Button>
            <Button onClick={handleSaveContact} disabled={contactPending}>
              {contactPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingContact ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* コンサル担当者・担当AS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            コンサル担当者・担当AS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* コンサル担当者 */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">コンサル担当者</Label>
            <div className="flex flex-wrap gap-2">
              {staffOptions.map((staff) => {
                const isSelected = consultingStaffIds.includes(Number(staff.value));
                return (
                  <button
                    key={staff.value}
                    type="button"
                    onClick={() => toggleConsultingStaff(Number(staff.value))}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-accent"
                    }`}
                  >
                    {staff.label}
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveConsultingStaff}
              disabled={consultingStaffPending}
            >
              {consultingStaffPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-1 h-3 w-3" />
              担当者を保存
            </Button>
          </div>

          <hr />

          {/* 担当AS */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">担当AS</Label>
            {autoDetectedAsLabel && !vendor.assignedAsLineFriendId && (
              <div className="text-xs text-muted-foreground">
                自動検出: {autoDetectedAsLabel}
                {autoDetectedAsLineFriendId && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs h-auto p-0 ml-2"
                    onClick={() => {
                      setAsLineFriendId(String(autoDetectedAsLineFriendId));
                    }}
                  >
                    この値をセット
                  </Button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select
                value={asLineFriendId || UNSET_VALUE}
                onValueChange={(v) => setAsLineFriendId(v === UNSET_VALUE ? "" : v)}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                  {scLineFriendsForAs.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {asLineFriendId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="クリア"
                  onClick={handleClearAssignedAs}
                  disabled={asPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveAssignedAs}
                disabled={asPending}
              >
                {asPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-1 h-3 w-3" />
                保存
              </Button>
            </div>
            {assignedAsLineFriendLabel && (
              <div className="text-xs text-muted-foreground">
                現在の担当AS: {assignedAsLineFriendLabel}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* サービス契約状況 */}
      <Card>
        <CardHeader>
          <CardTitle>サービス契約状況</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 契約日・案件ステータス・開始日・終了予定日 */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>契約日</Label>
              <DatePicker value={contractDate} onChange={setContractDate} placeholder="契約日を選択" />
            </div>
            <div className="space-y-2">
              <Label>案件ステータス <button type="button" className="inline-flex align-middle hover:text-blue-600 transition-colors" onClick={() => openStatusModal("caseStatus")}><Settings className="h-3.5 w-3.5" /></button></Label>
              <Select
                value={caseStatusId || UNSET_VALUE}
                onValueChange={(v) => setCaseStatusId(v === UNSET_VALUE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                  {caseStatusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>開始日</Label>
              <DatePicker value={consultingStartDate} onChange={setConsultingStartDate} placeholder="開始日を選択" />
            </div>
            <div className="space-y-2">
              <Label>終了予定日</Label>
              <DatePicker value={consultingEndDate} onChange={setConsultingEndDate} placeholder="終了予定日を選択" />
            </div>
          </div>

          <hr />

          {/* セキュリティクラウド卸 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">セキュリティクラウド卸</h3>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStatusModal("scWholesale")}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>プラン</Label>
                <Select
                  value={scWholesaleStatusId || UNSET_VALUE}
                  onValueChange={(v) => setScWholesaleStatusId(v === UNSET_VALUE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                    {scWholesaleOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={scWholesaleKickoffMtg}
                  onChange={(e) => setScWholesaleKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={scWholesaleContractUrl}
                  onChange={(e) => setScWholesaleContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* コンサルティングプラン */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">コンサルティングプラン</h3>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStatusModal("consultingPlan")}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>プラン</Label>
                <Select
                  value={consultingPlanStatusId || UNSET_VALUE}
                  onValueChange={(v) => setConsultingPlanStatusId(v === UNSET_VALUE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                    {consultingPlanOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={consultingPlanKickoffMtg}
                  onChange={(e) => setConsultingPlanKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={consultingPlanContractUrl}
                  onChange={(e) => setConsultingPlanContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* 交付申請BPO */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">交付申請BPO</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={grantApplicationBpo}
                  onCheckedChange={setGrantApplicationBpo}
                />
                <Label>利用</Label>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={grantApplicationBpoKickoffMtg}
                  onChange={(e) => setGrantApplicationBpoKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={grantApplicationBpoContractUrl}
                  onChange={(e) => setGrantApplicationBpoContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* 助成金コンサルティング */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">助成金コンサルティング</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={subsidyConsulting}
                  onCheckedChange={setSubsidyConsulting}
                />
                <Label>利用</Label>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={subsidyConsultingKickoffMtg}
                  onChange={(e) => setSubsidyConsultingKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div>{/* 助成金コンサルティングには契約書URLなし */}</div>
            </div>
          </div>

          <hr />

          {/* 貸金利用の有無 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">貸金利用の有無</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={loanUsage}
                  onCheckedChange={setLoanUsage}
                />
                <Label>利用</Label>
              </div>
              <div className="space-y-2">
                <Label>キックオフMTG</Label>
                <Input
                  value={loanUsageKickoffMtg}
                  onChange={(e) => setLoanUsageKickoffMtg(e.target.value)}
                  placeholder="日時やメモ"
                />
              </div>
              <div className="space-y-2">
                <Label>契約書URL</Label>
                <Input
                  value={loanUsageContractUrl}
                  onChange={(e) => setLoanUsageContractUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <hr />

          {/* ベンダー登録の有無 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">ベンダー登録の有無</h3>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStatusModal("vendorRegistration")}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-w-xs space-y-2">
              <Label>ステータス</Label>
              <Select
                value={vendorRegistrationStatusId || UNSET_VALUE}
                onValueChange={(v) =>
                  setVendorRegistrationStatusId(v === UNSET_VALUE ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                  {vendorRegistrationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <hr />

          {/* ツール登録の有無 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">ツール登録の有無</h3>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => openStatusModal("toolRegistration")}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-w-xs space-y-2">
              <Label>ステータス</Label>
              <Select
                value={toolRegistrationStatusId || UNSET_VALUE}
                onValueChange={(v) =>
                  setToolRegistrationStatusId(v === UNSET_VALUE ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                  {toolRegistrationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* その他 */}
      <Card>
        <CardHeader>
          <CardTitle>その他</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="memo">弊社用備考</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder="社内メモ"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendorSharedMemo">ベンダー共有用備考</Label>
            <Textarea
              id="vendorSharedMemo"
              value={vendorSharedMemo}
              onChange={(e) => setVendorSharedMemo(e.target.value)}
              rows={4}
              placeholder="ベンダーと共有するメモ"
            />
          </div>
        </CardContent>
      </Card>

      {/* 保存ボタン */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存
        </Button>
      </div>

      {/* ステータス管理モーダル */}
      <VendorStatusManagementModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        type={statusModalType}
      />
    </div>
  );
}
