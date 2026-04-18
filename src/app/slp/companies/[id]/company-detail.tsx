"use client";

import { useState, useMemo, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Star,
  Mail,
  Phone,
  MessageSquare,
  Settings,
  Save,
  Loader2,
  BellOff,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateCompanyBasicInfo,
  deleteCompanyRecord,
  addContact,
  updateContact,
  deleteContact,
  setPrimaryContact,
  setManualContactAs,
  clearManualContactAs,
  markAsNotDuplicate,
  type CompanyBasicInfoPatch,
  type MasterKind,
} from "../actions";
import { MasterSelect, type MasterOption } from "../master-select";
import { MasterManagementModal } from "../master-management-modal";
import {
  SlpCompanyDocumentsView,
  type CompanyDocumentEntry,
} from "@/components/slp/slp-company-documents-modal";

// ----------------------------------------------------------------
// 都道府県リスト
// ----------------------------------------------------------------
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const UNSET = "__unset__";

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------
type ContactData = {
  id: number;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  lineFriendId: number | null;
  lineFriendLabel: string | null;
  isPrimary: boolean;
  receivesSessionNotifications: boolean;
};

type StatusHistoryEntry = {
  id: number;
  flow: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  changedByName: string | null;
  createdAt: string | null;
};

export type CompanyDetailRecord = {
  id: number;
  companyNo: number;
  contacts: ContactData[];
  // 基本情報
  companyName: string | null;
  representativeName: string | null;
  employeeCount: number | null;
  prefecture: string | null;
  address: string | null;
  companyPhone: string | null;
  pensionOffice: string | null;
  pensionOfficerName: string | null;
  industryId: number | null;
  industryName: string | null;
  flowSourceId: number | null;
  flowSourceName: string | null;
  salesStaffId: number | null;
  salesStaffName: string | null;
  status1Id: number | null;
  status1Name: string | null;
  status2Id: number | null;
  status2Name: string | null;
  lastContactDate: string | null;
  annualLaborCostExecutive: string | null;
  annualLaborCostEmployee: string | null;
  averageMonthlySalary: string | null;
  // プロライン予約フォーム回答（生テキスト・サジェスト表示用）
  annualLaborCostExecutiveFormAnswer: string | null;
  annualLaborCostEmployeeFormAnswer: string | null;
  employeeCountFormAnswer: string | null;
  // 事業形態・法人/個人事業主対応
  businessType: string | null;
  corporateNumber: string | null;
  companyEmail: string | null;
  representativePhone: string | null;
  representativeEmail: string | null;
  primaryContactId: number | null;
  // 金額・契約情報
  initialFee: string | null;
  initialPeopleCount: number | null;
  monthlyFee: string | null;
  monthlyPeopleCount: number | null;
  contractDate: string | null;
  lastPaymentDate: string | null;
  invoiceSentDate: string | null;
  nextPaymentDate: string | null;
  estMaxRefundPeople: number | null;
  estMaxRefundAmount: string | null;
  estOurRevenue: string | null;
  estAgentPayment: string | null;
  confirmedRefundPeople: number | null;
  confirmedRefundAmount: string | null;
  confirmedOurRevenue: string | null;
  confirmedAgentPayment: string | null;
  paymentReceivedDate: string | null;
  statusHistories: StatusHistoryEntry[];
  submittedDocuments: CompanyDocumentEntry[];
  reservationHistories: ReservationHistoryEntry[];
};

export type ReservationHistoryEntry = {
  id: number;
  reservationType: string; // "briefing" | "consultation"
  actionType: string; // "予約" | "変更" | "キャンセル"
  reservationId: string | null;
  reservedAt: string | null;
  bookedAt: string | null;
  staffName: string | null;
  formAnswers: Record<string, string | null> | null;
  createdAt: string | null;
};

type LineFriendOption = { id: number; label: string };
type StaffOption = { id: number; name: string };

type AsResolutionEntry = {
  contactId: number;
  contactName: string;
  contactDisplay: string;
  autoAsId: number | null;
  autoAsName: string | null;
  manualAsId: number | null;
  manualAsName: string | null;
  manualAsReason: string | null;
  manualAsChangedAt: string | null;
  manualAsChangedByName: string | null;
  effectiveAsId: number | null;
  effectiveAsName: string | null;
  isManual: boolean;
};

type ReferrerResolutionEntry = {
  contactId: number;
  contactName: string;
  contactDisplay: string;
  referrers: Array<{ lineFriendId: number; label: string }>;
};

type AgencyResolutionEntry = {
  contactId: number;
  contactName: string;
  contactDisplay: string;
  agencies: Array<{ agencyId: number; agencyName: string; label: string }>;
};

type DuplicateCandidateInfo = {
  candidateId: number;
  otherRecordId: number;
  otherCompanyName: string | null;
  reasons: string[];
};

type Props = {
  record: CompanyDetailRecord;
  lineFriendOptions: LineFriendOption[];
  staffOptions: StaffOption[];
  industryOptions: MasterOption[];
  flowSourceOptions: MasterOption[];
  status1Options: MasterOption[];
  status2Options: MasterOption[];
  asOptions: { id: number; name: string }[];
  asResolutions: AsResolutionEntry[];
  referrerResolutions: ReferrerResolutionEntry[];
  agencyResolutions: AgencyResolutionEntry[];
  multipleAgencyWarnings: Array<{
    contactDisplay: string;
    agencyLabels: string[];
  }>;
  duplicateCandidates: DuplicateCandidateInfo[];
  /** 「商談」タブ内に表示する Server Component（MeetingSessionsSection） */
  meetingSessionsSlot?: React.ReactNode;
  /** 「接触履歴」タブ内に表示する Server Component（SlpCompanyContactHistorySection） */
  contactHistoriesSlot?: React.ReactNode;
};

// ----------------------------------------------------------------
// 本体
// ----------------------------------------------------------------
export function CompanyDetail({
  record,
  lineFriendOptions,
  staffOptions,
  industryOptions,
  flowSourceOptions,
  status1Options,
  status2Options,
  asOptions,
  asResolutions,
  referrerResolutions,
  agencyResolutions,
  multipleAgencyWarnings,
  duplicateCandidates,
  meetingSessionsSlot,
  contactHistoriesSlot,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ============================================
  // メインフォームのstate（[保存]ボタンで一括保存される対象）
  // ============================================

  // --- 基本情報 ---
  const [companyName, setCompanyName] = useState(record.companyName ?? "");
  const [representativeName, setRepresentativeName] = useState(record.representativeName ?? "");
  const [employeeCount, setEmployeeCount] = useState(
    record.employeeCount !== null ? String(record.employeeCount) : ""
  );
  const [prefecture, setPrefecture] = useState(record.prefecture ?? "");
  const [address, setAddress] = useState(record.address ?? "");
  const [companyPhone, setCompanyPhone] = useState(record.companyPhone ?? "");
  const [pensionOffice, setPensionOffice] = useState(record.pensionOffice ?? "");
  const [pensionOfficerName, setPensionOfficerName] = useState(record.pensionOfficerName ?? "");
  const [industryId, setIndustryId] = useState<number | null>(record.industryId);
  const [flowSourceId, setFlowSourceId] = useState<number | null>(record.flowSourceId);
  const [salesStaffId, setSalesStaffId] = useState<number | null>(record.salesStaffId);
  const [status1Id, setStatus1Id] = useState<number | null>(record.status1Id);
  const [status2Id, setStatus2Id] = useState<number | null>(record.status2Id);
  const [lastContactDate, setLastContactDate] = useState(record.lastContactDate ?? "");
  const [annualLaborCostExecutive, setAnnualLaborCostExecutive] = useState(record.annualLaborCostExecutive ?? "");
  const [annualLaborCostEmployee, setAnnualLaborCostEmployee] = useState(record.annualLaborCostEmployee ?? "");
  const [averageMonthlySalary, setAverageMonthlySalary] = useState(record.averageMonthlySalary ?? "");

  // --- 事業形態・法人/個人事業主対応 ---
  const [businessType, setBusinessType] = useState(record.businessType || "corporation");
  const [corporateNumber, setCorporateNumber] = useState(record.corporateNumber ?? "");
  const [companyEmail, setCompanyEmail] = useState(record.companyEmail ?? "");
  const [representativePhone, setRepresentativePhone] = useState(record.representativePhone ?? "");
  const [representativeEmail, setRepresentativeEmail] = useState(record.representativeEmail ?? "");
  const [primaryContactId, setPrimaryContactIdState] = useState<string>(
    record.primaryContactId?.toString() ?? UNSET
  );

  // --- 金額・契約 ---
  const [initialFee, setInitialFee] = useState(record.initialFee ?? "");
  const [initialPeopleCount, setInitialPeopleCount] = useState(
    record.initialPeopleCount !== null ? String(record.initialPeopleCount) : ""
  );
  const [monthlyFee, setMonthlyFee] = useState(record.monthlyFee ?? "");
  const [monthlyPeopleCount, setMonthlyPeopleCount] = useState(
    record.monthlyPeopleCount !== null ? String(record.monthlyPeopleCount) : ""
  );
  const [contractDate, setContractDate] = useState(record.contractDate ?? "");
  const [lastPaymentDate, setLastPaymentDate] = useState(record.lastPaymentDate ?? "");
  const [invoiceSentDate, setInvoiceSentDate] = useState(record.invoiceSentDate ?? "");
  const [nextPaymentDate, setNextPaymentDate] = useState(record.nextPaymentDate ?? "");
  const [estMaxRefundPeople, setEstMaxRefundPeople] = useState(
    record.estMaxRefundPeople !== null ? String(record.estMaxRefundPeople) : ""
  );
  const [estMaxRefundAmount, setEstMaxRefundAmount] = useState(record.estMaxRefundAmount ?? "");
  const [estOurRevenue, setEstOurRevenue] = useState(record.estOurRevenue ?? "");
  const [estAgentPayment, setEstAgentPayment] = useState(record.estAgentPayment ?? "");
  const [confirmedRefundPeople, setConfirmedRefundPeople] = useState(
    record.confirmedRefundPeople !== null ? String(record.confirmedRefundPeople) : ""
  );
  const [confirmedRefundAmount, setConfirmedRefundAmount] = useState(record.confirmedRefundAmount ?? "");
  const [confirmedOurRevenue, setConfirmedOurRevenue] = useState(record.confirmedOurRevenue ?? "");
  const [confirmedAgentPayment, setConfirmedAgentPayment] = useState(record.confirmedAgentPayment ?? "");
  const [paymentReceivedDate, setPaymentReceivedDate] = useState(record.paymentReceivedDate ?? "");

  // ============================================
  // Dirty detection（未保存変更の検出）
  // ============================================
  const currentValues = useMemo(
    () =>
      JSON.stringify({
        companyName,
        representativeName,
        employeeCount,
        prefecture,
        address,
        companyPhone,
        pensionOffice,
        pensionOfficerName,
        industryId,
        flowSourceId,
        salesStaffId,
        status1Id,
        status2Id,
        lastContactDate,
        annualLaborCostExecutive,
        annualLaborCostEmployee,
        averageMonthlySalary,
        businessType,
        corporateNumber,
        companyEmail,
        representativePhone,
        representativeEmail,
        primaryContactId,
        initialFee,
        initialPeopleCount,
        monthlyFee,
        monthlyPeopleCount,
        contractDate,
        lastPaymentDate,
        invoiceSentDate,
        nextPaymentDate,
        estMaxRefundPeople,
        estMaxRefundAmount,
        estOurRevenue,
        estAgentPayment,
        confirmedRefundPeople,
        confirmedRefundAmount,
        confirmedOurRevenue,
        confirmedAgentPayment,
        paymentReceivedDate,
      }),
    [
      companyName, representativeName, employeeCount, prefecture, address, companyPhone,
      pensionOffice, pensionOfficerName, industryId, flowSourceId,
      salesStaffId, status1Id, status2Id, lastContactDate,
      annualLaborCostExecutive, annualLaborCostEmployee, averageMonthlySalary,
      businessType, corporateNumber, companyEmail, representativePhone, representativeEmail, primaryContactId,
      initialFee, initialPeopleCount, monthlyFee, monthlyPeopleCount,
      contractDate, lastPaymentDate, invoiceSentDate, nextPaymentDate,
      estMaxRefundPeople, estMaxRefundAmount, estOurRevenue, estAgentPayment,
      confirmedRefundPeople, confirmedRefundAmount, confirmedOurRevenue, confirmedAgentPayment,
      paymentReceivedDate,
    ]
  );

  const [savedValues, setSavedValues] = useState(currentValues);
  const isDirty = currentValues !== savedValues;

  // ブラウザを閉じる/リロード時の警告
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // <a>クリックによる遷移をインターセプト（Next.js Link 含む）
  const guardNavigation = useCallback(
    (e: MouseEvent) => {
      if (!isDirty) return;
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
      if (!confirm("編集したデータが保存されていませんがよろしいですか？")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [isDirty]
  );

  useEffect(() => {
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [guardNavigation]);

  // ============================================
  // 一括保存ハンドラ
  // ============================================
  const handleSave = () => {
    startTransition(async () => {
      try {
        // 基本情報・金額契約 を保存
        const patch: CompanyBasicInfoPatch = {
          companyName,
          representativeName,
          employeeCount,
          prefecture,
          address,
          companyPhone,
          pensionOffice,
          pensionOfficerName,
          industryId,
          flowSourceId,
          salesStaffId,
          status1Id,
          status2Id,
          lastContactDate,
          annualLaborCostExecutive,
          annualLaborCostEmployee,
          averageMonthlySalary,
          businessType: businessType || null,
          corporateNumber,
          companyEmail,
          representativePhone,
          representativeEmail,
          primaryContactId: primaryContactId !== UNSET ? parseInt(primaryContactId, 10) : null,
          initialFee,
          initialPeopleCount,
          monthlyFee,
          monthlyPeopleCount,
          contractDate,
          lastPaymentDate,
          invoiceSentDate,
          nextPaymentDate,
          estMaxRefundPeople,
          estMaxRefundAmount,
          estOurRevenue,
          estAgentPayment,
          confirmedRefundPeople,
          confirmedRefundAmount,
          confirmedOurRevenue,
          confirmedAgentPayment,
          paymentReceivedDate,
        };
        await updateCompanyBasicInfo(record.id, patch);

        // 商談情報は新「商談セッション管理」カードからセッションベースで更新される

        setSavedValues(currentValues);
        toast.success("保存しました");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  };

  // ============================================
  // マスタ管理モーダル
  // ============================================
  const [masterModalKind, setMasterModalKind] = useState<MasterKind | null>(null);
  const openMasterModal = (kind: MasterKind) => setMasterModalKind(kind);

  // ============================================
  // 担当者モーダル（即座にDB保存・dirty stateとは独立）
  // ============================================
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [formName, setFormName] = useState("");
  const [formRoleSelect, setFormRoleSelect] = useState(UNSET);
  const [formRoleCustom, setFormRoleCustom] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLineFriendId, setFormLineFriendId] = useState(UNSET);
  const [formReceivesSessionNotifications, setFormReceivesSessionNotifications] =
    useState(true);

  // ============================================
  // AS手動上書き用ダイアログ
  // ============================================
  const [asOverrideDialogOpen, setAsOverrideDialogOpen] = useState(false);
  const [asOverrideTarget, setAsOverrideTarget] =
    useState<AsResolutionEntry | null>(null);
  const [asOverrideAsId, setAsOverrideAsId] = useState<string>(UNSET);
  const [asOverrideReason, setAsOverrideReason] = useState("");
  const [asOverridePending, setAsOverridePending] = useState(false);

  const openAsOverrideDialog = (entry: AsResolutionEntry) => {
    setAsOverrideTarget(entry);
    setAsOverrideAsId(entry.manualAsId ? String(entry.manualAsId) : UNSET);
    setAsOverrideReason(entry.manualAsReason ?? "");
    setAsOverrideDialogOpen(true);
  };

  const handleSaveAsOverride = async () => {
    if (!asOverrideTarget) return;
    if (asOverrideAsId === UNSET) {
      toast.error("AS担当を選択してください");
      return;
    }
    if (!asOverrideReason.trim()) {
      toast.error("変更理由は必須です");
      return;
    }
    setAsOverridePending(true);
    try {
      const result = await setManualContactAs(
        asOverrideTarget.contactId,
        parseInt(asOverrideAsId, 10),
        asOverrideReason.trim()
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("AS担当を手動上書きしました");
      setAsOverrideDialogOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setAsOverridePending(false);
    }
  };

  const handleClearAsOverride = async (contactId: number) => {
    if (!confirm("手動上書きを解除して自動解決値に戻しますか？")) return;
    try {
      const result = await clearManualContactAs(contactId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("手動上書きを解除しました");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "解除に失敗しました");
    }
  };
  const [contactPending, setContactPending] = useState(false);

  const openAddContact = () => {
    setEditingContact(null);
    setFormName("");
    setFormRoleSelect(UNSET);
    setFormRoleCustom("");
    setFormEmail("");
    setFormPhone("");
    setFormLineFriendId(UNSET);
    setFormReceivesSessionNotifications(true); // デフォルトON
    setContactDialogOpen(true);
  };

  const openEditContact = (contact: ContactData) => {
    setEditingContact(contact);
    setFormName(contact.name ?? "");
    if (contact.role === "代表者" || contact.role === "主担当者") {
      setFormRoleSelect(contact.role);
      setFormRoleCustom("");
    } else if (contact.role) {
      setFormRoleSelect("other");
      setFormRoleCustom(contact.role);
    } else {
      setFormRoleSelect(UNSET);
      setFormRoleCustom("");
    }
    setFormEmail(contact.email ?? "");
    setFormPhone(contact.phone ?? "");
    setFormLineFriendId(contact.lineFriendId?.toString() ?? UNSET);
    setFormReceivesSessionNotifications(contact.receivesSessionNotifications);
    setContactDialogOpen(true);
  };

  const handleSaveContact = async () => {
    setContactPending(true);
    const role =
      formRoleSelect === "other"
        ? formRoleCustom
        : formRoleSelect === UNSET
          ? ""
          : formRoleSelect;

    try {
      if (editingContact) {
        await updateContact(editingContact.id, {
          name: formName,
          role,
          email: formEmail,
          phone: formPhone,
          lineFriendId: formLineFriendId !== UNSET ? parseInt(formLineFriendId) : null,
          receivesSessionNotifications: formReceivesSessionNotifications,
        });
      } else {
        await addContact({
          companyRecordId: record.id,
          name: formName,
          role,
          email: formEmail,
          phone: formPhone,
          lineFriendId: formLineFriendId !== UNSET ? parseInt(formLineFriendId) : null,
          receivesSessionNotifications: formReceivesSessionNotifications,
        });
      }

      toast.success(editingContact ? "担当者を更新しました" : "担当者を追加しました");
      setContactDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setContactPending(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm("この担当者を削除しますか？")) return;
    try {
      await deleteContact(contactId);
      toast.success("担当者を削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleSetPrimary = async (contactId: number) => {
    try {
      await setPrimaryContact(contactId, record.id);
      toast.success("主担当を変更しました");
      router.refresh();
    } catch {
      toast.error("変更に失敗しました");
    }
  };

  // 商談ステータス変更・完了処理は「商談セッション管理」カード側へ移行済み

  // ============================================
  // 削除
  // ============================================
  const handleDelete = async () => {
    if (isDirty) {
      if (!confirm("編集中の未保存データがあります。\n保存せずに削除してもよろしいですか？")) return;
    }
    if (!confirm("このレコードを削除しますか？\n（論理削除されます）")) return;
    try {
      await deleteCompanyRecord(record.id);
      toast.success("削除しました");
      // dirty状態を解除してから遷移（離脱ガードを回避）
      setSavedValues(currentValues);
      router.push("/slp/companies");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  // ============================================
  // タブ
  // ============================================
  const [tab, setTab] = useState("basic");

  const displayName = record.companyName ?? `企業 #${record.companyNo}`;

  // ============================================
  // レンダリング
  // ============================================
  return (
    <div className="space-y-4">
      {/* ============================================
          スティッキーヘッダー（企業名 + 戻る + 保存 + 削除）
          ============================================ */}
      <div className="sticky top-0 z-20 bg-white border-b -mx-6 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/slp/companies"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              事業者名簿
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-xl font-bold truncate">{displayName}</h1>
            <span className="text-sm text-muted-foreground flex-shrink-0">
              (No. {record.companyNo})
            </span>
            {/* 本日商談バッジ・商談未完了バッジは「商談セッション管理」カード側に集約 */}
            {isDirty && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 flex-shrink-0">
                未保存の変更あり
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleSave}
              disabled={isPending || !isDirty}
              size="sm"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {isPending ? "保存中..." : "保存"}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
          </div>
        </div>
      </div>

      {/* 重複候補の警告バッジ */}
      {duplicateCandidates.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-700">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                この事業者には{duplicateCandidates.length}件の重複候補があります
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
                {duplicateCandidates.map((c) => (
                  <li key={c.candidateId} className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/slp/companies/${c.otherRecordId}`}
                      className="font-medium hover:underline"
                    >
                      ID {c.otherRecordId}: {c.otherCompanyName ?? "(未登録)"}
                    </Link>
                    <span className="text-amber-600">
                      ({c.reasons.join(", ")})
                    </span>
                    <Link
                      href={`/slp/companies/merge?a=${record.id}&b=${c.otherRecordId}`}
                      className="text-blue-600 hover:underline"
                    >
                      統合する →
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm(
                            "この2社は重複ではないとマークしますか？以降この組み合わせは候補に表示されません"
                          )
                        )
                          return;
                        try {
                          const result = await markAsNotDuplicate(
                            record.id,
                            c.otherRecordId
                          );
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("重複候補から除外しました");
                          router.refresh();
                        } catch {
                          toast.error("操作に失敗しました");
                        }
                      }}
                      className="text-slate-600 hover:underline"
                    >
                      重複ではない
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          タブ
          ============================================ */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">基本情報</TabsTrigger>
          <TabsTrigger value="finance">金額・契約</TabsTrigger>
          <TabsTrigger value="briefing">商談</TabsTrigger>
          <TabsTrigger value="contacts">担当者</TabsTrigger>
          <TabsTrigger value="documents">提出書類</TabsTrigger>
          <TabsTrigger value="contact-histories">接触履歴</TabsTrigger>
        </TabsList>

        {/* ============================================
            タブ1: 基本情報
            ============================================ */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 事業形態 */}
                <div className="md:col-span-2">
                  <Label>事業形態</Label>
                  <div className="flex gap-4 mt-1.5">
                    {[
                      { value: "corporation", label: "法人" },
                      { value: "sole_proprietor", label: "個人事業主" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="businessType"
                          value={opt.value}
                          checked={businessType === opt.value}
                          onChange={(e) => setBusinessType(e.target.value)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                    {/* クリアボタンは非表示（必ず法人か個人事業主の選択が必要） */}
                  </div>
                </div>
                <div>
                  <Label>{businessType === "sole_proprietor" ? "屋号(個人名可)" : "企業名"}</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={businessType === "sole_proprietor" ? "○○商店 / 山田太郎" : "株式会社○○"}
                  />
                </div>
                {businessType === "corporation" && (
                  <div>
                    <Label>法人番号</Label>
                    <Input
                      value={corporateNumber}
                      onChange={(e) => setCorporateNumber(e.target.value)}
                      placeholder="1234567890123"
                      maxLength={13}
                    />
                  </div>
                )}
                <div>
                  <Label>代表者名</Label>
                  <Input
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>代表者(担当者から選択)</Label>
                  <Select
                    value={primaryContactId}
                    onValueChange={(v) => {
                      setPrimaryContactIdState(v);
                      // 選択した担当者の情報で代表者フィールドを自動入力
                      if (v !== UNSET) {
                        const contact = record.contacts.find((c) => c.id === parseInt(v, 10));
                        if (contact) {
                          setRepresentativeName(contact.name ?? "");
                          setRepresentativePhone(contact.phone ?? "");
                          setRepresentativeEmail(contact.email ?? "");
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>未設定</SelectItem>
                      {record.contacts.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name ?? `(担当者#${c.id})`}
                          {c.lineFriendLabel ? ` [${c.lineFriendLabel}]` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>代表者電話番号</Label>
                  <Input
                    value={representativePhone}
                    onChange={(e) => setRepresentativePhone(e.target.value)}
                    placeholder="090-1234-5678"
                  />
                </div>
                <div>
                  <Label>代表者メールアドレス</Label>
                  <Input
                    value={representativeEmail}
                    onChange={(e) => setRepresentativeEmail(e.target.value)}
                    placeholder="taro@example.com"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>業種</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => openMasterModal("industry")}
                      title="業種マスタを管理"
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      管理
                    </Button>
                  </div>
                  <MasterSelect
                    options={industryOptions}
                    value={industryId}
                    onChange={setIndustryId}
                  />
                </div>
                <div>
                  <Label>従業員数</Label>
                  {record.employeeCountFormAnswer && (
                    <div className="mb-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      💡 フォーム回答:{" "}
                      <span className="font-semibold">
                        {record.employeeCountFormAnswer}
                      </span>
                    </div>
                  )}
                  <Input
                    type="number"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    placeholder="50"
                  />
                </div>
                <div>
                  <Label>都道府県</Label>
                  <Select
                    value={prefecture || UNSET}
                    onValueChange={(v) => setPrefecture(v === UNSET ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>未設定</SelectItem>
                      {PREFECTURES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{businessType === "sole_proprietor" ? "事業用電話番号" : "企業電話番号"}</Label>
                  <Input
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="03-1234-5678"
                  />
                </div>
                <div>
                  <Label>{businessType === "sole_proprietor" ? "事業用メールアドレス" : "企業メールアドレス"}</Label>
                  <Input
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="info@example.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>{businessType === "sole_proprietor" ? "事業用住所" : "本店所在地"}</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="東京都港区..."
                  />
                </div>
                <div>
                  <Label>管轄の年金事務所</Label>
                  <Input
                    value={pensionOffice}
                    onChange={(e) => setPensionOffice(e.target.value)}
                    placeholder="渋谷年金事務所"
                  />
                </div>
                <div>
                  <Label>年金事務所担当者名</Label>
                  <Input
                    value={pensionOfficerName}
                    onChange={(e) => setPensionOfficerName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>担当営業</Label>
                  <Select
                    value={salesStaffId !== null ? String(salesStaffId) : UNSET}
                    onValueChange={(v) => setSalesStaffId(v === UNSET ? null : parseInt(v, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>未設定</SelectItem>
                      {staffOptions.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>流入経路</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => openMasterModal("flow_source")}
                      title="流入経路マスタを管理"
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      管理
                    </Button>
                  </div>
                  <MasterSelect
                    options={flowSourceOptions}
                    value={flowSourceId}
                    onChange={setFlowSourceId}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>ステータス①</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => openMasterModal("status1")}
                      title="ステータス①マスタを管理"
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      管理
                    </Button>
                  </div>
                  <MasterSelect
                    options={status1Options}
                    value={status1Id}
                    onChange={setStatus1Id}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>ステータス②</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => openMasterModal("status2")}
                      title="ステータス②マスタを管理"
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      管理
                    </Button>
                  </div>
                  <MasterSelect
                    options={status2Options}
                    value={status2Id}
                    onChange={setStatus2Id}
                  />
                </div>
                <div>
                  <Label>最終接触日</Label>
                  <DatePicker
                    value={lastContactDate}
                    onChange={setLastContactDate}
                  />
                </div>
                <div>
                  <Label>年間人件費（役員様分）（円）</Label>
                  {record.annualLaborCostExecutiveFormAnswer && (
                    <div className="mb-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      💡 フォーム回答:{" "}
                      <span className="font-semibold">
                        {record.annualLaborCostExecutiveFormAnswer}
                      </span>
                    </div>
                  )}
                  <Input
                    type="number"
                    value={annualLaborCostExecutive}
                    onChange={(e) => setAnnualLaborCostExecutive(e.target.value)}
                    placeholder="例: 20000000"
                  />
                </div>
                <div>
                  <Label>年間人件費（従業員様分）（円）</Label>
                  {record.annualLaborCostEmployeeFormAnswer && (
                    <div className="mb-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      💡 フォーム回答:{" "}
                      <span className="font-semibold">
                        {record.annualLaborCostEmployeeFormAnswer}
                      </span>
                    </div>
                  )}
                  <Input
                    type="number"
                    value={annualLaborCostEmployee}
                    onChange={(e) => setAnnualLaborCostEmployee(e.target.value)}
                    placeholder="例: 30000000"
                  />
                </div>
                <div>
                  <Label>平均月給（円）</Label>
                  <Input
                    type="number"
                    value={averageMonthlySalary}
                    onChange={(e) => setAverageMonthlySalary(e.target.value)}
                    placeholder="例: 300000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================
            タブ2: 金額・契約
            ============================================ */}
        <TabsContent value="finance">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">初期・月額</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>初期導入費用（円）</Label>
                    <Input
                      type="number"
                      value={initialFee}
                      onChange={(e) => setInitialFee(e.target.value)}
                      placeholder="150000"
                    />
                  </div>
                  <div>
                    <Label>初期導入人数</Label>
                    <Input
                      type="number"
                      value={initialPeopleCount}
                      onChange={(e) => setInitialPeopleCount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>利用料／月（円）</Label>
                    <Input
                      type="number"
                      value={monthlyFee}
                      onChange={(e) => setMonthlyFee(e.target.value)}
                      placeholder="2980"
                    />
                  </div>
                  <div>
                    <Label>利用人数／月</Label>
                    <Input
                      type="number"
                      value={monthlyPeopleCount}
                      onChange={(e) => setMonthlyPeopleCount(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">契約・支払日</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>契約日</Label>
                    <DatePicker value={contractDate} onChange={setContractDate} />
                  </div>
                  <div>
                    <Label>請求書送付日</Label>
                    <DatePicker value={invoiceSentDate} onChange={setInvoiceSentDate} />
                  </div>
                  <div>
                    <Label>前回の支払日</Label>
                    <DatePicker value={lastPaymentDate} onChange={setLastPaymentDate} />
                  </div>
                  <div>
                    <Label>次回の支払日</Label>
                    <DatePicker value={nextPaymentDate} onChange={setNextPaymentDate} />
                  </div>
                  <div>
                    <Label>着金日</Label>
                    <DatePicker value={paymentReceivedDate} onChange={setPaymentReceivedDate} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">想定金額</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>想定最大還付人数</Label>
                    <Input
                      type="number"
                      value={estMaxRefundPeople}
                      onChange={(e) => setEstMaxRefundPeople(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>想定最大還付金額（円）</Label>
                    <Input
                      type="number"
                      value={estMaxRefundAmount}
                      onChange={(e) => setEstMaxRefundAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>想定弊社売上（円）</Label>
                    <Input
                      type="number"
                      value={estOurRevenue}
                      onChange={(e) => setEstOurRevenue(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>想定代理店支払金額（円）</Label>
                    <Input
                      type="number"
                      value={estAgentPayment}
                      onChange={(e) => setEstAgentPayment(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">確定金額</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>確定還付人数</Label>
                    <Input
                      type="number"
                      value={confirmedRefundPeople}
                      onChange={(e) => setConfirmedRefundPeople(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>確定還付金額（円）</Label>
                    <Input
                      type="number"
                      value={confirmedRefundAmount}
                      onChange={(e) => setConfirmedRefundAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>確定弊社売上（円）</Label>
                    <Input
                      type="number"
                      value={confirmedOurRevenue}
                      onChange={(e) => setConfirmedOurRevenue(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>確定代理店支払金額（円）</Label>
                    <Input
                      type="number"
                      value={confirmedAgentPayment}
                      onChange={(e) => setConfirmedAgentPayment(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================
            タブ3: 商談（概要案内・導入希望商談のセッション管理）
            ============================================ */}
        <TabsContent value="briefing">
          {meetingSessionsSlot}
        </TabsContent>

        {/* ============================================
            タブ4: 担当者
            ============================================ */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">担当者</CardTitle>
              <Button size="sm" variant="outline" onClick={openAddContact}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                追加
              </Button>
            </CardHeader>
            <CardContent>
              {record.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  担当者が登録されていません
                </p>
              ) : (
                <div className="space-y-2">
                  {record.contacts.map((c) => (
                    <div key={c.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.name ?? "(名前なし)"}</span>
                          {c.isPrimary && (
                            <Badge variant="secondary" className="text-amber-700 bg-amber-50">
                              <Star className="h-3 w-3 mr-1" />
                              主担当
                            </Badge>
                          )}
                          {c.role && <Badge variant="outline">{c.role}</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          {!c.isPrimary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimary(c.id)}
                              title="主担当に設定"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditContact(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDeleteContact(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {c.email}
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </span>
                        )}
                        {c.lineFriendLabel && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {c.lineFriendLabel}
                          </span>
                        )}
                        {c.receivesSessionNotifications ? (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <BellRing className="h-3 w-3" /> 商談通知ON
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <BellOff className="h-3 w-3" /> 商談通知OFF
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                ※ 担当者の追加・編集・削除は即座に反映されます（保存ボタン不要）
              </p>
            </CardContent>
          </Card>

          {/* AS担当・紹介者・代理店（担当者ごとの自動解決） */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                AS担当・紹介者・代理店
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                担当者のLINEから紹介者チェーンを自動で辿って解決します。AS担当のみ手動上書き可能です。
              </p>
            </CardHeader>
            <CardContent>
              {asResolutions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  担当者が登録されていません
                </p>
              ) : (
                <div className="space-y-3">
                  {asResolutions.map((asEntry) => {
                    const refEntry = referrerResolutions.find(
                      (r) => r.contactId === asEntry.contactId
                    );
                    const agEntry = agencyResolutions.find(
                      (a) => a.contactId === asEntry.contactId
                    );
                    const hasAgencyWarning =
                      (agEntry?.agencies.length ?? 0) > 1;
                    return (
                      <div
                        key={asEntry.contactId}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="font-medium text-sm">
                          {asEntry.contactDisplay}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          {/* AS担当 */}
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              AS担当
                            </Label>
                            <div className="mt-1">
                              {asEntry.effectiveAsName ? (
                                <Badge
                                  variant={
                                    asEntry.isManual ? "default" : "secondary"
                                  }
                                >
                                  {asEntry.effectiveAsName}
                                  {asEntry.isManual && "(手動)"}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">
                                  なし
                                </span>
                              )}
                            </div>
                            {asEntry.isManual && (
                              <div className="text-xs text-amber-700 mt-1 space-y-0.5">
                                <div>
                                  元のAS: {asEntry.autoAsName ?? "なし"}
                                </div>
                                <div>理由: {asEntry.manualAsReason}</div>
                                {asEntry.manualAsChangedByName && (
                                  <div>
                                    変更者: {asEntry.manualAsChangedByName}
                                    {asEntry.manualAsChangedAt &&
                                      ` (${new Date(asEntry.manualAsChangedAt).toLocaleString("ja-JP")})`}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex gap-1 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openAsOverrideDialog(asEntry)}
                              >
                                {asEntry.isManual ? "上書き編集" : "手動上書き"}
                              </Button>
                              {asEntry.isManual && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    handleClearAsOverride(asEntry.contactId)
                                  }
                                >
                                  解除
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* 紹介者 */}
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              紹介者
                            </Label>
                            <div className="mt-1">
                              {!refEntry || refEntry.referrers.length === 0 ? (
                                <span className="text-muted-foreground">
                                  なし
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  {refEntry.referrers.map((r) => (
                                    <div key={r.lineFriendId}>{r.label}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 代理店 */}
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              代理店（1次のみ）
                            </Label>
                            <div className="mt-1">
                              {!agEntry || agEntry.agencies.length === 0 ? (
                                <span className="text-muted-foreground">
                                  なし
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  {agEntry.agencies.map((a) => (
                                    <div key={a.agencyId}>
                                      <Link
                                        href={`/slp/agencies/${a.agencyId}`}
                                        className="text-blue-600 hover:underline"
                                      >
                                        {a.label}
                                      </Link>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {hasAgencyWarning && (
                              <div className="text-xs text-amber-600 mt-1">
                                ⚠ 1人の担当者から複数の1次代理店が見つかりました
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {multipleAgencyWarnings.length > 0 && (
                <div className="mt-3 p-2 border border-amber-300 bg-amber-50 rounded text-xs text-amber-800">
                  <div className="font-medium mb-1">⚠ 警告</div>
                  {multipleAgencyWarnings.map((w, i) => (
                    <div key={i}>
                      {w.contactDisplay}: {w.agencyLabels.join(" / ")}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================
            タブ5: 提出書類
            ============================================ */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                提出書類{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  （全{record.submittedDocuments.length}件）
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SlpCompanyDocumentsView documents={record.submittedDocuments} />
              <p className="text-xs text-muted-foreground mt-3">
                ※ 書類の削除（論理削除）は即座に反映されます（保存ボタン不要）
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================
            タブ6: 接触履歴（企業単位の全接触履歴 + 商談打ち合わせ紐付け）
            ============================================ */}
        <TabsContent value="contact-histories">
          {contactHistoriesSlot}
        </TabsContent>
      </Tabs>

      {/* ============================================
          以下、各種モーダル
          ============================================ */}

      {/* 担当者 追加/編集モーダル */}
      {/* AS手動上書きダイアログ */}
      <Dialog open={asOverrideDialogOpen} onOpenChange={setAsOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AS担当を手動上書き</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <span className="text-muted-foreground">担当者: </span>
              <span className="font-medium">
                {asOverrideTarget?.contactDisplay}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">自動解決値: </span>
              <span>{asOverrideTarget?.autoAsName ?? "なし"}</span>
            </div>
            <div>
              <Label>手動設定するAS担当 *</Label>
              <Select
                value={asOverrideAsId}
                onValueChange={setAsOverrideAsId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ASを選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>選択してください</SelectItem>
                  {asOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>変更理由 *</Label>
              <Textarea
                value={asOverrideReason}
                onChange={(e) => setAsOverrideReason(e.target.value)}
                placeholder="例: 紹介者の登録ミスのため正しい担当ASに変更"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAsOverrideDialogOpen(false)}
              disabled={asOverridePending}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSaveAsOverride}
              disabled={
                asOverridePending ||
                asOverrideAsId === UNSET ||
                !asOverrideReason.trim()
              }
            >
              {asOverridePending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "担当者を編集" : "担当者を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名前</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label>役割</Label>
              <Select value={formRoleSelect} onValueChange={setFormRoleSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未設定</SelectItem>
                  <SelectItem value="代表者">代表者</SelectItem>
                  <SelectItem value="主担当者">主担当者</SelectItem>
                  <SelectItem value="other">その他（手入力）</SelectItem>
                </SelectContent>
              </Select>
              {formRoleSelect === "other" && (
                <Input
                  className="mt-2"
                  placeholder="役割を入力"
                  value={formRoleCustom}
                  onChange={(e) => setFormRoleCustom(e.target.value)}
                />
              )}
            </div>
            <div>
              <Label>メールアドレス</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>電話番号</Label>
              <Input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>公式LINE</Label>
              <Select value={formLineFriendId} onValueChange={setFormLineFriendId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {lineFriendOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-start gap-2 rounded border p-3 bg-muted/30 cursor-pointer">
              <Checkbox
                checked={formReceivesSessionNotifications}
                onCheckedChange={(v) =>
                  setFormReceivesSessionNotifications(v === true)
                }
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  商談の通知をLINEで受け取る
                </div>
                <p className="text-xs text-muted-foreground">
                  ONにすると、この担当者が紐づく事業者の商談について、確定・変更・キャンセル・前日/1時間前リマインドなどの通知がこの方のLINEに届きます。
                  予約を自分自身が取った商談については、この設定に関わらず必ず通知が届きます。
                </p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveContact} disabled={contactPending}>
              {contactPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* マスタ管理モーダル */}
      {masterModalKind !== null && (
        <MasterManagementModal
          open={masterModalKind !== null}
          onOpenChange={(open) => {
            if (!open) setMasterModalKind(null);
          }}
          kind={masterModalKind}
        />
      )}
    </div>
  );
}

// ReservationHistorySection は新「商談セッション管理」カード側の変更履歴モーダルへ移行済み
