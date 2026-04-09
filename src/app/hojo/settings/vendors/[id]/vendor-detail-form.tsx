"use client";

import { useState, useTransition, useEffect, useCallback, useMemo, useRef } from "react";
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
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
  FileText,
  ExternalLink,
  Link as LinkIcon,
  Upload,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { updateVendorDetail, updateVendorConsultingStaff, updateVendorAssignedAs, updateVendorContractDocuments } from "./actions";
import {
  addVendorContact,
  updateVendorContact,
  deleteVendorContact,
  setPrimaryContact,
} from "../actions";
import type { StatusType } from "../vendor-status-management-modal";
import type { ContractDocumentItem } from "./vendor-detail-tabs";

/** ベンダーメモからフォーム回答のLINE名を抽出する */
function extractFormLineNames(memo: string): { representative: string | null; contact: string | null } {
  const repMatch = memo.match(/代表者LINE名:\s*(.+)/);
  const contMatch = memo.match(/主担当者LINE名:\s*(.+)/);
  return {
    representative: repMatch?.[1]?.trim() || null,
    contact: contMatch?.[1]?.trim() || null,
  };
}

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
    email: string;
    phone: string;
    kickoffMtg: string;
    scWholesaleStatusId: number | null;
    scWholesaleContractStatusId: number | null;
    scWholesaleKickoffMtg: string;
    scWholesaleContractDate: string;
    scWholesaleEndDate: string;
    scWholesaleMemo: string;
    consultingPlanStatusId: number | null;
    consultingPlanContractStatusId: number | null;
    consultingPlanKickoffMtg: string;
    consultingPlanContractDate: string;
    consultingPlanEndDate: string;
    consultingPlanMemo: string;
    grantApplicationBpo: boolean;
    grantApplicationBpoContractStatusId: number | null;
    grantApplicationBpoKickoffMtg: string;
    grantApplicationBpoContractDate: string;
    grantApplicationBpoMemo: string;
    subsidyConsulting: boolean;
    subsidyConsultingKickoffMtg: string;
    subsidyConsultingMemo: string;
    loanUsage: boolean;
    loanUsageKickoffMtg: string;
    loanUsageMemo: string;
    vendorRegistrationStatusId: number | null;
    vendorRegistrationMemo: string;
    toolRegistrationStatusId: number | null;
    toolRegistrationMemo: string;
    memo: string;
    vendorSharedMemo: string;
    assignedAsLineFriendId: number | null;
  };
  contacts: ContactData[];
  scLineFriendSelectOptions: { value: string; label: string }[];
  joseiLineFriendSelectOptions: { value: string; label: string }[];
  scWholesaleOptions: { value: string; label: string }[];
  consultingPlanOptions: { value: string; label: string }[];
  contractStatusOptions: { value: string; label: string }[];
  vendorRegistrationOptions: { value: string; label: string }[];
  toolRegistrationOptions: { value: string; label: string }[];
  contractDocsByService: Record<string, ContractDocumentItem[]>;
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
  contractStatusOptions,
  vendorRegistrationOptions,
  toolRegistrationOptions,
  contractDocsByService,
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

  // フォーム回答由来のLINE名ヒント
  const formLineNames = useMemo(() => extractFormLineNames(vendor.memo || ""), [vendor.memo]);

  // ベンダー基本情報
  const [vendorEmail, setVendorEmail] = useState(vendor.email);
  const [vendorPhone, setVendorPhone] = useState(vendor.phone);

  // 全体の初回MTG
  const [kickoffMtg, setKickoffMtg] = useState(vendor.kickoffMtg);

  // セキュリティクラウド卸
  const [scWholesaleStatusId, setScWholesaleStatusId] = useState<string>(
    vendor.scWholesaleStatusId ? String(vendor.scWholesaleStatusId) : ""
  );
  const [scWholesaleContractStatusId, setScWholesaleContractStatusId] = useState<string>(
    vendor.scWholesaleContractStatusId ? String(vendor.scWholesaleContractStatusId) : ""
  );
  const [scWholesaleKickoffMtg, setScWholesaleKickoffMtg] = useState(vendor.scWholesaleKickoffMtg);
  const [scWholesaleContractDate, setScWholesaleContractDate] = useState(vendor.scWholesaleContractDate);
  const [scWholesaleEndDate, setScWholesaleEndDate] = useState(vendor.scWholesaleEndDate);
  const [scWholesaleMemo, setScWholesaleMemo] = useState(vendor.scWholesaleMemo);
  const [scWholesaleDocs, setScWholesaleDocs] = useState<ContractDocumentItem[]>(
    contractDocsByService.scWholesale || []
  );

  // コンサルティングプラン
  const [consultingPlanStatusId, setConsultingPlanStatusId] = useState<string>(
    vendor.consultingPlanStatusId ? String(vendor.consultingPlanStatusId) : ""
  );
  const [consultingPlanContractStatusId, setConsultingPlanContractStatusId] = useState<string>(
    vendor.consultingPlanContractStatusId ? String(vendor.consultingPlanContractStatusId) : ""
  );
  const [consultingPlanKickoffMtg, setConsultingPlanKickoffMtg] = useState(vendor.consultingPlanKickoffMtg);
  const [consultingPlanContractDate, setConsultingPlanContractDate] = useState(vendor.consultingPlanContractDate);
  const [consultingPlanEndDate, setConsultingPlanEndDate] = useState(vendor.consultingPlanEndDate);
  const [consultingPlanMemo, setConsultingPlanMemo] = useState(vendor.consultingPlanMemo);
  const [consultingPlanDocs, setConsultingPlanDocs] = useState<ContractDocumentItem[]>(
    contractDocsByService.consultingPlan || []
  );

  // 交付申請BPO
  const [grantApplicationBpo, setGrantApplicationBpo] = useState(vendor.grantApplicationBpo);
  const [grantApplicationBpoContractStatusId, setGrantApplicationBpoContractStatusId] = useState<string>(
    vendor.grantApplicationBpoContractStatusId ? String(vendor.grantApplicationBpoContractStatusId) : ""
  );
  const [grantApplicationBpoKickoffMtg, setGrantApplicationBpoKickoffMtg] = useState(
    vendor.grantApplicationBpoKickoffMtg
  );
  const [grantApplicationBpoContractDate, setGrantApplicationBpoContractDate] = useState(
    vendor.grantApplicationBpoContractDate
  );
  const [grantApplicationBpoMemo, setGrantApplicationBpoMemo] = useState(vendor.grantApplicationBpoMemo);
  const [grantApplicationBpoDocs, setGrantApplicationBpoDocs] = useState<ContractDocumentItem[]>(
    contractDocsByService.grantApplicationBpo || []
  );

  // 助成金コンサルティング
  const [subsidyConsulting, setSubsidyConsulting] = useState(vendor.subsidyConsulting);
  const [subsidyConsultingKickoffMtg, setSubsidyConsultingKickoffMtg] = useState(
    vendor.subsidyConsultingKickoffMtg
  );
  const [subsidyConsultingMemo, setSubsidyConsultingMemo] = useState(vendor.subsidyConsultingMemo);

  // 貸金業者
  const [loanUsage, setLoanUsage] = useState(vendor.loanUsage);
  const [loanUsageKickoffMtg, setLoanUsageKickoffMtg] = useState(vendor.loanUsageKickoffMtg);
  const [loanUsageMemo, setLoanUsageMemo] = useState(vendor.loanUsageMemo);

  const [vendorRegistrationStatusId, setVendorRegistrationStatusId] = useState<string>(
    vendor.vendorRegistrationStatusId ? String(vendor.vendorRegistrationStatusId) : ""
  );
  const [vendorRegistrationMemo, setVendorRegistrationMemo] = useState(vendor.vendorRegistrationMemo);

  const [toolRegistrationStatusId, setToolRegistrationStatusId] = useState<string>(
    vendor.toolRegistrationStatusId ? String(vendor.toolRegistrationStatusId) : ""
  );
  const [toolRegistrationMemo, setToolRegistrationMemo] = useState(vendor.toolRegistrationMemo);

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
    vendorEmail, vendorPhone, kickoffMtg,
    scWholesaleStatusId, scWholesaleContractStatusId, scWholesaleKickoffMtg, scWholesaleContractDate, scWholesaleEndDate, scWholesaleMemo, scWholesaleDocs,
    consultingPlanStatusId, consultingPlanContractStatusId, consultingPlanKickoffMtg, consultingPlanContractDate, consultingPlanEndDate, consultingPlanMemo, consultingPlanDocs,
    grantApplicationBpo, grantApplicationBpoContractStatusId, grantApplicationBpoKickoffMtg, grantApplicationBpoContractDate, grantApplicationBpoMemo, grantApplicationBpoDocs,
    subsidyConsulting, subsidyConsultingKickoffMtg, subsidyConsultingMemo,
    loanUsage, loanUsageKickoffMtg, loanUsageMemo,
    vendorRegistrationStatusId, vendorRegistrationMemo,
    toolRegistrationStatusId, toolRegistrationMemo,
    memo, vendorSharedMemo,
    consultingStaffIds: [...consultingStaffIds].sort(),
    asLineFriendId,
  }), [
    vendorEmail, vendorPhone, kickoffMtg,
    scWholesaleStatusId, scWholesaleContractStatusId, scWholesaleKickoffMtg, scWholesaleContractDate, scWholesaleEndDate, scWholesaleMemo, scWholesaleDocs,
    consultingPlanStatusId, consultingPlanContractStatusId, consultingPlanKickoffMtg, consultingPlanContractDate, consultingPlanEndDate, consultingPlanMemo, consultingPlanDocs,
    grantApplicationBpo, grantApplicationBpoContractStatusId, grantApplicationBpoKickoffMtg, grantApplicationBpoContractDate, grantApplicationBpoMemo, grantApplicationBpoDocs,
    subsidyConsulting, subsidyConsultingKickoffMtg, subsidyConsultingMemo,
    loanUsage, loanUsageKickoffMtg, loanUsageMemo,
    vendorRegistrationStatusId, vendorRegistrationMemo,
    toolRegistrationStatusId, toolRegistrationMemo,
    memo, vendorSharedMemo,
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
          email: vendorEmail,
          phone: vendorPhone,
          kickoffMtg: kickoffMtg || null,
          scWholesaleStatusId: scWholesaleStatusId ? Number(scWholesaleStatusId) : null,
          scWholesaleContractStatusId: scWholesaleContractStatusId ? Number(scWholesaleContractStatusId) : null,
          scWholesaleKickoffMtg: scWholesaleKickoffMtg || null,
          scWholesaleContractDate: scWholesaleContractDate || null,
          scWholesaleEndDate: scWholesaleEndDate || null,
          scWholesaleMemo,
          consultingPlanStatusId: consultingPlanStatusId ? Number(consultingPlanStatusId) : null,
          consultingPlanContractStatusId: consultingPlanContractStatusId ? Number(consultingPlanContractStatusId) : null,
          consultingPlanKickoffMtg: consultingPlanKickoffMtg || null,
          consultingPlanContractDate: consultingPlanContractDate || null,
          consultingPlanEndDate: consultingPlanEndDate || null,
          consultingPlanMemo,
          grantApplicationBpo,
          grantApplicationBpoContractStatusId: grantApplicationBpoContractStatusId
            ? Number(grantApplicationBpoContractStatusId)
            : null,
          grantApplicationBpoKickoffMtg: grantApplicationBpoKickoffMtg || null,
          grantApplicationBpoContractDate: grantApplicationBpoContractDate || null,
          grantApplicationBpoMemo,
          subsidyConsulting,
          subsidyConsultingKickoffMtg: subsidyConsultingKickoffMtg || null,
          subsidyConsultingMemo,
          loanUsage,
          loanUsageKickoffMtg: loanUsageKickoffMtg || null,
          loanUsageMemo,
          vendorRegistrationStatusId: vendorRegistrationStatusId
            ? Number(vendorRegistrationStatusId)
            : null,
          vendorRegistrationMemo,
          toolRegistrationStatusId: toolRegistrationStatusId
            ? Number(toolRegistrationStatusId)
            : null,
          toolRegistrationMemo,
          memo,
          vendorSharedMemo,
        });
        // 契約書ドキュメントも更新
        await Promise.all([
          updateVendorContractDocuments(vendor.id, "scWholesale", scWholesaleDocs),
          updateVendorContractDocuments(vendor.id, "consultingPlan", consultingPlanDocs),
          updateVendorContractDocuments(vendor.id, "grantApplicationBpo", grantApplicationBpoDocs),
        ]);
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
              {(() => {
                const hint = formRoleSelect === "representative" ? formLineNames.representative
                  : formRoleSelect === "contact_person" ? formLineNames.contact
                  : null;
                return hint ? (
                  <p className="text-xs text-blue-600 font-medium">LINE名: {hint}</p>
                ) : null;
              })()}
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

      {/* ベンダー基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            ベンダー基本情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-3 md:grid-cols-2">
            <FieldBlock label="メールアドレス">
              <Input
                type="email"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                placeholder="vendor@example.com"
              />
            </FieldBlock>
            <FieldBlock label="電話番号">
              <Input
                type="tel"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                placeholder="03-xxxx-xxxx"
              />
            </FieldBlock>
            <FieldBlock label="初回MTG">
              <DateTimePicker value={kickoffMtg} onChange={setKickoffMtg} placeholder="初回MTGの日時" />
            </FieldBlock>
          </div>
        </CardContent>
      </Card>

      {/* サービス契約状況 */}
      <Card>
        <CardHeader>
          <CardTitle>サービス契約状況</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* セキュリティクラウド卸 */}
          <ServiceSection
            title="セキュリティクラウド卸"
            onPlanSettingsClick={() => openStatusModal("scWholesale")}
          >
            <div className="grid gap-3 lg:grid-cols-5 md:grid-cols-2">
              <FieldBlock label="プラン">
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
              </FieldBlock>
              <FieldBlock
                label="契約状況"
                onSettingsClick={() => openStatusModal("contractStatus")}
              >
                <Select
                  value={scWholesaleContractStatusId || UNSET_VALUE}
                  onValueChange={(v) => setScWholesaleContractStatusId(v === UNSET_VALUE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                    {contractStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock label="契約日">
                <DatePicker value={scWholesaleContractDate} onChange={setScWholesaleContractDate} placeholder="契約日" />
              </FieldBlock>
              <FieldBlock label="終了予定日">
                <DatePicker value={scWholesaleEndDate} onChange={setScWholesaleEndDate} placeholder="終了予定日" />
              </FieldBlock>
              <FieldBlock label="初回MTG">
                <DateTimePicker value={scWholesaleKickoffMtg} onChange={setScWholesaleKickoffMtg} placeholder="初回MTG" />
              </FieldBlock>
            </div>
            <FieldBlock label="契約書">
              <ContractDocumentEditor value={scWholesaleDocs} onChange={setScWholesaleDocs} vendorId={vendor.id} />
            </FieldBlock>
            <FieldBlock label="備考">
              <Textarea
                value={scWholesaleMemo}
                onChange={(e) => setScWholesaleMemo(e.target.value)}
                rows={2}
                placeholder="セキュリティクラウド卸に関するメモ"
              />
            </FieldBlock>
          </ServiceSection>

          <hr />

          {/* コンサルティングプラン */}
          <ServiceSection
            title="コンサルティングプラン"
            onPlanSettingsClick={() => openStatusModal("consultingPlan")}
          >
            <div className="grid gap-3 lg:grid-cols-5 md:grid-cols-2">
              <FieldBlock label="プラン">
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
              </FieldBlock>
              <FieldBlock
                label="契約状況"
                onSettingsClick={() => openStatusModal("contractStatus")}
              >
                <Select
                  value={consultingPlanContractStatusId || UNSET_VALUE}
                  onValueChange={(v) => setConsultingPlanContractStatusId(v === UNSET_VALUE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                    {contractStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock label="契約日">
                <DatePicker value={consultingPlanContractDate} onChange={setConsultingPlanContractDate} placeholder="契約日" />
              </FieldBlock>
              <FieldBlock label="終了予定日">
                <DatePicker value={consultingPlanEndDate} onChange={setConsultingPlanEndDate} placeholder="終了予定日" />
              </FieldBlock>
              <FieldBlock label="初回MTG">
                <DateTimePicker value={consultingPlanKickoffMtg} onChange={setConsultingPlanKickoffMtg} placeholder="初回MTG" />
              </FieldBlock>
            </div>
            <FieldBlock label="契約書">
              <ContractDocumentEditor value={consultingPlanDocs} onChange={setConsultingPlanDocs} vendorId={vendor.id} />
            </FieldBlock>
            <FieldBlock label="備考">
              <Textarea
                value={consultingPlanMemo}
                onChange={(e) => setConsultingPlanMemo(e.target.value)}
                rows={2}
                placeholder="コンサルティングプランに関するメモ"
              />
            </FieldBlock>
          </ServiceSection>

          <hr />

          {/* 交付申請BPO */}
          <ServiceSection title="交付申請BPO">
            <div className="grid gap-3 lg:grid-cols-4 md:grid-cols-2">
              <FieldBlock label="利用">
                <div className="flex items-center h-9">
                  <Switch checked={grantApplicationBpo} onCheckedChange={setGrantApplicationBpo} />
                </div>
              </FieldBlock>
              <FieldBlock
                label="契約状況"
                onSettingsClick={() => openStatusModal("contractStatus")}
              >
                <Select
                  value={grantApplicationBpoContractStatusId || UNSET_VALUE}
                  onValueChange={(v) => setGrantApplicationBpoContractStatusId(v === UNSET_VALUE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="未選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_VALUE}>未選択</SelectItem>
                    {contractStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock label="契約日">
                <DatePicker value={grantApplicationBpoContractDate} onChange={setGrantApplicationBpoContractDate} placeholder="契約日" />
              </FieldBlock>
              <FieldBlock label="初回MTG">
                <DateTimePicker value={grantApplicationBpoKickoffMtg} onChange={setGrantApplicationBpoKickoffMtg} placeholder="初回MTG" />
              </FieldBlock>
            </div>
            <FieldBlock label="契約書">
              <ContractDocumentEditor value={grantApplicationBpoDocs} onChange={setGrantApplicationBpoDocs} vendorId={vendor.id} />
            </FieldBlock>
            <FieldBlock label="備考">
              <Textarea
                value={grantApplicationBpoMemo}
                onChange={(e) => setGrantApplicationBpoMemo(e.target.value)}
                rows={2}
                placeholder="交付申請BPOに関するメモ"
              />
            </FieldBlock>
          </ServiceSection>

          <hr />

          {/* 助成金コンサルティング */}
          <ServiceSection title="助成金コンサルティング">
            <div className="grid gap-3 lg:grid-cols-4 md:grid-cols-2">
              <FieldBlock label="利用">
                <div className="flex items-center h-9">
                  <Switch checked={subsidyConsulting} onCheckedChange={setSubsidyConsulting} />
                </div>
              </FieldBlock>
              <FieldBlock label="初回MTG">
                <DateTimePicker value={subsidyConsultingKickoffMtg} onChange={setSubsidyConsultingKickoffMtg} placeholder="初回MTG" />
              </FieldBlock>
            </div>
            <FieldBlock label="備考">
              <Textarea
                value={subsidyConsultingMemo}
                onChange={(e) => setSubsidyConsultingMemo(e.target.value)}
                rows={2}
                placeholder="助成金コンサルティングに関するメモ"
              />
            </FieldBlock>
          </ServiceSection>

          <hr />

          {/* 貸金業者 */}
          <ServiceSection title="貸金業者">
            <div className="grid gap-3 lg:grid-cols-4 md:grid-cols-2">
              <FieldBlock label="利用">
                <div className="flex items-center h-9">
                  <Switch checked={loanUsage} onCheckedChange={setLoanUsage} />
                </div>
              </FieldBlock>
              <FieldBlock label="初回MTG">
                <DateTimePicker value={loanUsageKickoffMtg} onChange={setLoanUsageKickoffMtg} placeholder="初回MTG" />
              </FieldBlock>
            </div>
            <FieldBlock label="備考">
              <Textarea
                value={loanUsageMemo}
                onChange={(e) => setLoanUsageMemo(e.target.value)}
                rows={2}
                placeholder="貸金業者に関するメモ"
              />
            </FieldBlock>
          </ServiceSection>

          <hr />

          {/* ベンダー登録 / ツール登録 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ServiceSection
              title="ベンダー登録の有無"
              onPlanSettingsClick={() => openStatusModal("vendorRegistration")}
            >
              <FieldBlock label="ステータス">
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
              </FieldBlock>
              <FieldBlock label="備考">
                <Textarea
                  value={vendorRegistrationMemo}
                  onChange={(e) => setVendorRegistrationMemo(e.target.value)}
                  rows={2}
                  placeholder="ベンダー登録に関するメモ"
                />
              </FieldBlock>
            </ServiceSection>

            <ServiceSection
              title="ツール登録の有無"
              onPlanSettingsClick={() => openStatusModal("toolRegistration")}
            >
              <FieldBlock label="ステータス">
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
              </FieldBlock>
              <FieldBlock label="備考">
                <Textarea
                  value={toolRegistrationMemo}
                  onChange={(e) => setToolRegistrationMemo(e.target.value)}
                  rows={2}
                  placeholder="ツール登録に関するメモ"
                />
              </FieldBlock>
            </ServiceSection>
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

// ============================
// サービスセクション・フィールドブロック（共通レイアウト）
// ============================

function ServiceSection({
  title,
  onPlanSettingsClick,
  children,
}: {
  title: string;
  onPlanSettingsClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {onPlanSettingsClick && (
          <button
            type="button"
            onClick={onPlanSettingsClick}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="プランを管理"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FieldBlock({
  label,
  onSettingsClick,
  children,
}: {
  label: string;
  onSettingsClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-xs text-gray-600 font-medium">{label}</Label>
        {onSettingsClick && (
          <button
            type="button"
            onClick={onSettingsClick}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="マスタを管理"
          >
            <Settings className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================
// 契約書エディター（URL+ファイル複数）
// ============================

function ContractDocumentEditor({
  value,
  onChange,
  vendorId,
}: {
  value: ContractDocumentItem[];
  onChange: (docs: ContractDocumentItem[]) => void;
  vendorId: number;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddUrl = () => {
    onChange([
      ...value,
      {
        id: 0,
        type: "url",
        url: "",
        filePath: null,
        fileName: null,
        fileSize: null,
        mimeType: null,
      },
    ]);
  };

  const handleUrlChange = (index: number, url: string) => {
    const next = [...value];
    next[index] = { ...next[index], url };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newDocs: ContractDocumentItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("vendorId", String(vendorId));
        const response = await fetch("/api/hojo/vendor-contracts/upload", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "アップロードに失敗しました");
        }
        newDocs.push({
          id: 0,
          type: "file",
          url: null,
          filePath: result.filePath,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "アップロードに失敗しました";
        toast.error(`${file.name}: ${message}`);
      }
    }
    if (newDocs.length > 0) {
      onChange([...value, ...newDocs]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((doc, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-2.5 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              {doc.type === "url" ? (
                <>
                  <LinkIcon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                  <Input
                    type="url"
                    value={doc.url || ""}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="https://..."
                    className="h-7 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-blue-200 px-1"
                  />
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                      title="リンクを開く"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                  <span className="flex-1 text-sm truncate text-gray-700" title={doc.fileName || ""}>
                    {doc.fileName}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatFileSize(doc.fileSize)}
                  </span>
                  {doc.filePath && (
                    <a
                      href={doc.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                      title="ファイルを開く"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                title="削除"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleAddUrl}>
          <LinkIcon className="h-3.5 w-3.5 mr-1" />
          URLを追加
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />アップロード中...</>
          ) : (
            <><Upload className="h-3.5 w-3.5 mr-1" />ファイルを追加</>
          )}
        </Button>
      </div>
    </div>
  );
}
