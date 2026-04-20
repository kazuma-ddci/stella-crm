"use client";

import { useState, useMemo, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  ArrowRight,
  Save,
  Loader2,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Star,
  Phone,
  Mail,
  Landmark,
  MapPin,
} from "lucide-react";
import { updateStpCompany, updateMasterCompanyFromStp } from "../../actions";
import {
  addContact,
  updateContact,
  deleteContact,
} from "@/app/companies/contact-actions";
import {
  addLocation,
  updateLocation,
  deleteLocation,
} from "@/app/companies/location-actions";
import {
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "@/app/companies/bank-account-actions";

// ============================================
// 型定義
// ============================================

type MasterCompanyData = {
  id: number;
  companyCode: string;
  name: string;
  nameKana: string | null;
  corporateNumber: string | null;
  companyType: string | null;
  websiteUrl: string | null;
  industry: string | null;
  revenueScale: string | null;
  employeeCount: number | null;
  note: string | null;
  closingDay: number | null;
  paymentMonthOffset: number | null;
  paymentDay: number | null;
  isInvoiceRegistered: boolean;
  invoiceRegistrationNumber: string | null;
  contacts: Array<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    isPrimary: boolean;
    note: string | null;
  }>;
  locations: Array<{
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
    note: string | null;
  }>;
  bankAccounts: Array<{
    id: number;
    bankName: string;
    bankCode: string;
    branchName: string;
    branchCode: string;
    accountNumber: string;
    accountHolderName: string;
    note: string | null;
  }>;
};

type OverviewTabProps = {
  stpCompanyId: number;
  masterCompany: MasterCompanyData;
  company: {
    id: number;
    companyId: number;
    companyName: string;
    industryType: string | null;
    industry: string | null;
    plannedHires: number | null;
    note: string | null;
    contractNote: string | null;
    leadAcquiredDate: string | null;
    leadValidity: string | null;
    hasDeal: string | null;
    operationStatus: string | null;
    currentStageName: string | null;
    currentStageId: number | null;
    nextTargetStageName: string | null;
    nextTargetDate: string | null;
    salesStaffName: string | null;
    adminStaffName: string | null;
    agentName: string | null;
    leadSourceName: string | null;
    forecast: string | null;
    pendingReason: string | null;
    lostReason: string | null;
    billingCompanyName: string | null;
    billingAddress: string | null;
    jobPostingStartDate: string | null;
  };
  latestContract: {
    jobMedia: string | null;
    contractPlan: string;
    monthlyFee: number;
    performanceFee: number;
    initialFee: number;
    contractStartDate: string;
    contractEndDate: string | null;
    status: string;
    operationStaffName: string | null;
    accountId: string | null;
  } | null;
  onTabChange?: (tab: string) => void;
};

const UNSET = "__unset__";

const INDUSTRY_TYPE_OPTIONS = [
  { value: "general", label: "一般" },
  { value: "dispatch", label: "派遣" },
];

const VALIDITY_OPTIONS = [
  { value: "有効", label: "有効" },
];

const DEAL_OPTIONS = [
  { value: "有り", label: "有り" },
  { value: "無し", label: "無し" },
];

const FORECAST_OPTIONS = [
  { value: "MIN", label: "MIN" },
  { value: "落とし", label: "落とし" },
  { value: "MAX", label: "MAX" },
  { value: "来月", label: "来月" },
  { value: "辞退", label: "辞退" },
];

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  active: "契約中",
  scheduled: "契約予定",
  cancelled: "解約",
  dormant: "休眠",
};

function formatCurrency(n: number): string {
  if (!n) return "-";
  return `¥${n.toLocaleString("ja-JP")}`;
}

// ============================================
// FieldBlock コンポーネント（ベンダーページと同じパターン）
// ============================================

function FieldBlock({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs text-gray-600 font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <FieldBlock label={label}>
      <div className="text-sm py-2 px-3 bg-gray-50 rounded-md border min-h-[36px]">
        {value || <span className="text-gray-400">-</span>}
      </div>
    </FieldBlock>
  );
}

// ============================================
// メインコンポーネント
// ============================================

export function OverviewTab({
  stpCompanyId,
  masterCompany,
  company,
  latestContract,
  onTabChange,
}: OverviewTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 連絡先管理の状態
  const [contacts, setContacts] = useState(masterCompany.contacts);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<typeof contacts[0] | null>(null);
  const [contactForm, setContactForm] = useState({
    name: "", email: "", phone: "", department: "", isPrimary: false, note: "",
  });
  const [contactSaving, setContactSaving] = useState(false);

  const openAddContact = () => {
    setEditingContact(null);
    setContactForm({ name: "", email: "", phone: "", department: "", isPrimary: false, note: "" });
    setContactDialogOpen(true);
  };

  const openEditContact = (c: typeof contacts[0]) => {
    setEditingContact(c);
    setContactForm({
      name: c.name, email: c.email || "", phone: c.phone || "",
      department: c.department || "", isPrimary: c.isPrimary, note: c.note || "",
    });
    setContactDialogOpen(true);
  };

  const handleSaveContact = async () => {
    if (!contactForm.name.trim()) { toast.error("名前は必須です"); return; }
    setContactSaving(true);
    try {
      if (editingContact) {
        const result = await updateContact(editingContact.id, contactForm);
        if (!result.ok) { toast.error(result.error); return; }
        setContacts((prev) => prev.map((c) => c.id === editingContact.id
          ? { ...c, ...contactForm }
          : contactForm.isPrimary ? { ...c, isPrimary: false } : c
        ));
        toast.success("連絡先を更新しました");
      } else {
        const result = await addContact(masterCompany.id, contactForm);
        if (!result.ok) { toast.error(result.error); return; }
        const newContact = result.data!;
        setContacts((prev) => contactForm.isPrimary
          ? [...prev.map((c) => ({ ...c, isPrimary: false })), { id: newContact.id, name: newContact.name, email: newContact.email, phone: newContact.phone, department: newContact.department, isPrimary: newContact.isPrimary, note: newContact.note }]
          : [...prev, { id: newContact.id, name: newContact.name, email: newContact.email, phone: newContact.phone, department: newContact.department, isPrimary: newContact.isPrimary, note: newContact.note }]
        );
        toast.success("連絡先を追加しました");
      }
      setContactDialogOpen(false);
      router.refresh();
    } catch { toast.error("エラーが発生しました"); }
    finally { setContactSaving(false); }
  };

  const handleDeleteContact = async (id: number) => {
    if (!confirm("この連絡先を削除しますか？")) return;
    const result = await deleteContact(id);
    if (result.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("連絡先を削除しました");
      router.refresh();
    } else { toast.error(result.error); }
  };

  const handleSetPrimary = async (c: typeof contacts[0]) => {
    const result = await updateContact(c.id, { ...c, isPrimary: true });
    if (result.ok) {
      setContacts((prev) => prev.map((ct) => ({ ...ct, isPrimary: ct.id === c.id })));
      toast.success("主連絡先を変更しました");
      router.refresh();
    } else { toast.error(result.error); }
  };

  // 拠点管理の状態
  const [locations, setLocations] = useState(masterCompany.locations);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<typeof locations[0] | null>(null);
  const [locationForm, setLocationForm] = useState({ name: "", address: "", phone: "", email: "", isPrimary: false, note: "" });
  const [locationSaving, setLocationSaving] = useState(false);

  const openAddLocation = () => { setEditingLocation(null); setLocationForm({ name: "", address: "", phone: "", email: "", isPrimary: false, note: "" }); setLocationDialogOpen(true); };
  const openEditLocation = (l: typeof locations[0]) => { setEditingLocation(l); setLocationForm({ name: l.name, address: l.address || "", phone: l.phone || "", email: l.email || "", isPrimary: l.isPrimary, note: l.note || "" }); setLocationDialogOpen(true); };

  const handleSaveLocation = async () => {
    if (!locationForm.name.trim()) { toast.error("拠点名は必須です"); return; }
    setLocationSaving(true);
    try {
      if (editingLocation) {
        const result = await updateLocation(editingLocation.id, locationForm);
        if (!result.ok) { toast.error(result.error); return; }
        setLocations((prev) => prev.map((l) => l.id === editingLocation.id ? { ...l, ...locationForm } : locationForm.isPrimary ? { ...l, isPrimary: false } : l));
        toast.success("拠点を更新しました");
      } else {
        const result = await addLocation(masterCompany.id, locationForm);
        if (!result.ok) { toast.error(result.error); return; }
        const d = result.data!;
        setLocations((prev) => locationForm.isPrimary
          ? [...prev.map((l) => ({ ...l, isPrimary: false })), { id: d.id, name: d.name, address: d.address, phone: d.phone, email: d.email, isPrimary: d.isPrimary, note: d.note }]
          : [...prev, { id: d.id, name: d.name, address: d.address, phone: d.phone, email: d.email, isPrimary: d.isPrimary, note: d.note }]
        );
        toast.success("拠点を追加しました");
      }
      setLocationDialogOpen(false); router.refresh();
    } catch { toast.error("エラーが発生しました"); } finally { setLocationSaving(false); }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!confirm("この拠点を削除しますか？")) return;
    const result = await deleteLocation(id);
    if (result.ok) { setLocations((prev) => prev.filter((l) => l.id !== id)); toast.success("拠点を削除しました"); router.refresh(); }
    else { toast.error(result.error); }
  };

  // 銀行口座管理の状態
  const [bankAccounts, setBankAccounts] = useState(masterCompany.bankAccounts);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<typeof bankAccounts[0] | null>(null);
  const [bankForm, setBankForm] = useState({ bankName: "", bankCode: "", branchName: "", branchCode: "", accountNumber: "", accountHolderName: "", note: "" });
  const [bankSaving, setBankSaving] = useState(false);

  const openAddBank = () => { setEditingBank(null); setBankForm({ bankName: "", bankCode: "", branchName: "", branchCode: "", accountNumber: "", accountHolderName: "", note: "" }); setBankDialogOpen(true); };
  const openEditBank = (b: typeof bankAccounts[0]) => { setEditingBank(b); setBankForm({ bankName: b.bankName, bankCode: b.bankCode, branchName: b.branchName, branchCode: b.branchCode, accountNumber: b.accountNumber, accountHolderName: b.accountHolderName, note: b.note || "" }); setBankDialogOpen(true); };

  const handleSaveBank = async () => {
    if (!bankForm.bankName.trim() || !bankForm.accountNumber.trim()) { toast.error("銀行名と口座番号は必須です"); return; }
    setBankSaving(true);
    try {
      if (editingBank) {
        const result = await updateBankAccount(editingBank.id, bankForm);
        if (!result.ok) { toast.error(result.error); return; }
        setBankAccounts((prev) => prev.map((b) => b.id === editingBank.id ? { ...b, ...bankForm } : b));
        toast.success("銀行口座を更新しました");
      } else {
        const result = await addBankAccount(masterCompany.id, bankForm);
        if (!result.ok) { toast.error(result.error); return; }
        const d = result.data!;
        setBankAccounts((prev) => [...prev, { id: d.id, bankName: d.bankName, bankCode: d.bankCode, branchName: d.branchName, branchCode: d.branchCode, accountNumber: d.accountNumber, accountHolderName: d.accountHolderName, note: d.note }]);
        toast.success("銀行口座を追加しました");
      }
      setBankDialogOpen(false); router.refresh();
    } catch { toast.error("エラーが発生しました"); } finally { setBankSaving(false); }
  };

  const handleDeleteBank = async (id: number) => {
    if (!confirm("この銀行口座を削除しますか？")) return;
    const result = await deleteBankAccount(id);
    if (result.ok) { setBankAccounts((prev) => prev.filter((b) => b.id !== id)); toast.success("銀行口座を削除しました"); router.refresh(); }
    else { toast.error(result.error); }
  };

  // 全顧客マスタ フォーム状態
  const [mcName, setMcName] = useState(masterCompany.name || "");
  const [mcNameKana, setMcNameKana] = useState(masterCompany.nameKana || "");
  const [mcCorporateNumber, setMcCorporateNumber] = useState(masterCompany.corporateNumber || "");
  const [mcCompanyType, setMcCompanyType] = useState(masterCompany.companyType || "");
  const [mcWebsiteUrl, setMcWebsiteUrl] = useState(masterCompany.websiteUrl || "");
  const [mcIndustry, setMcIndustry] = useState(masterCompany.industry || "");
  const [mcRevenueScale, setMcRevenueScale] = useState(masterCompany.revenueScale || "");
  const [mcEmployeeCount, setMcEmployeeCount] = useState(masterCompany.employeeCount?.toString() || "");
  const [mcNote, setMcNote] = useState(masterCompany.note || "");
  const [mcClosingDay, setMcClosingDay] = useState(masterCompany.closingDay?.toString() ?? "");
  const [mcPaymentMonthOffset, setMcPaymentMonthOffset] = useState(masterCompany.paymentMonthOffset?.toString() ?? "");
  const [mcPaymentDay, setMcPaymentDay] = useState(masterCompany.paymentDay?.toString() ?? "");

  // STP企業 フォーム状態
  const [industryType, setIndustryType] = useState(company.industryType || "");
  const [plannedHires, setPlannedHires] = useState(company.plannedHires?.toString() || "");
  const [leadAcquiredDate, setLeadAcquiredDate] = useState(company.leadAcquiredDate || "");
  const [leadValidity, setLeadValidity] = useState(company.leadValidity || "");
  const [hasDeal, setHasDeal] = useState(company.hasDeal || "");
  const [forecast, setForecast] = useState(company.forecast || "");
  const [operationStatus, setOperationStatus] = useState(company.operationStatus || "");
  const [billingCompanyName, setBillingCompanyName] = useState(company.billingCompanyName || "");
  const [billingAddress, setBillingAddress] = useState(company.billingAddress || "");
  const [note, setNote] = useState(company.note || "");
  const [contractNote, setContractNote] = useState(company.contractNote || "");
  const [pendingReason, setPendingReason] = useState(company.pendingReason || "");
  const [lostReason, setLostReason] = useState(company.lostReason || "");
  const [jobPostingStartDate, setJobPostingStartDate] = useState(company.jobPostingStartDate || "");

  // 未保存変更の検出
  const currentValues = useMemo(() => JSON.stringify({
    mcName, mcNameKana, mcCorporateNumber, mcCompanyType, mcWebsiteUrl,
    mcIndustry, mcRevenueScale, mcEmployeeCount, mcNote,
    mcClosingDay, mcPaymentMonthOffset, mcPaymentDay,
    industryType, plannedHires, leadAcquiredDate, leadValidity, hasDeal,
    forecast, operationStatus, billingCompanyName, billingAddress,
    note, contractNote, pendingReason, lostReason, jobPostingStartDate,
  }), [
    mcName, mcNameKana, mcCorporateNumber, mcCompanyType, mcWebsiteUrl,
    mcIndustry, mcRevenueScale, mcEmployeeCount, mcNote,
    mcClosingDay, mcPaymentMonthOffset, mcPaymentDay,
    industryType, plannedHires, leadAcquiredDate, leadValidity, hasDeal,
    forecast, operationStatus, billingCompanyName, billingAddress,
    note, contractNote, pendingReason, lostReason, jobPostingStartDate,
  ]);

  const [savedValues, setSavedValues] = useState(currentValues);
  const isDirty = currentValues !== savedValues;

  useNavigationGuard(isDirty);

  // リンククリック時の離脱防止
  const guardNavigation = useCallback((e: MouseEvent) => {
    if (!isDirty) return;
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;
    const href = target.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
    if (!confirm("保存していないデータがあります。移動してもよろしいですか？")) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [isDirty]);

  useEffect(() => {
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [guardNavigation]);

  // 保存（全顧客マスタ + STP企業 両方を一括保存）
  const handleSave = () => {
    startTransition(async () => {
      try {
        // 全顧客マスタの更新
        const mcData: Record<string, unknown> = {
          name: mcName,
          nameKana: mcNameKana || null,
          corporateNumber: mcCorporateNumber || null,
          companyType: mcCompanyType || null,
          websiteUrl: mcWebsiteUrl || null,
          industry: mcIndustry || null,
          revenueScale: mcRevenueScale || null,
          employeeCount: mcEmployeeCount || null,
          note: mcNote || null,
          closingDay: mcClosingDay || null,
          paymentMonthOffset: mcPaymentMonthOffset || null,
          paymentDay: mcPaymentDay || null,
        };
        const mcResult = await updateMasterCompanyFromStp(masterCompany.id, mcData);
        if (!mcResult.ok) {
          toast.error(mcResult.error);
          return;
        }

        // STP企業情報の更新
        const stpData: Record<string, unknown> = {
          industryType: industryType || null,
          plannedHires: plannedHires ? parseInt(plannedHires, 10) : null,
          leadAcquiredDate: leadAcquiredDate || null,
          leadValidity: leadValidity || null,
          hasDeal: hasDeal || null,
          forecast: forecast || null,
          operationStatus: operationStatus || null,
          billingCompanyName: billingCompanyName || null,
          billingAddress: billingAddress || null,
          note: note || null,
          contractNote: contractNote || null,
          pendingReason: pendingReason || null,
          lostReason: lostReason || null,
          jobPostingStartDate: jobPostingStartDate || null,
        };
        const stpResult = await updateStpCompany(stpCompanyId, stpData);
        if (!stpResult.ok) {
          toast.error(stpResult.error);
          return;
        }

        toast.success("保存しました");
        setSavedValues(currentValues);
        router.refresh();
      } catch {
        toast.error("保存に失敗しました");
      }
    });
  };

  const COMPANY_TYPE_OPTIONS = [
    { value: "法人", label: "法人" },
    { value: "個人", label: "個人" },
  ];

  const CLOSING_DAY_OPTIONS = [
    { value: "0", label: "月末" },
    ...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}日` })),
  ];

  const PAYMENT_MONTH_OPTIONS = [
    { value: "1", label: "翌月" },
    { value: "2", label: "翌々月" },
    { value: "3", label: "3ヶ月後" },
  ];

  return (
    <div className="space-y-6">
      {/* 全顧客マスタ情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            全顧客マスタ情報
            <Badge variant="outline" className="text-xs font-normal">
              {masterCompany.companyCode}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <FieldBlock label="企業名 *">
              <Input value={mcName} onChange={(e) => setMcName(e.target.value)} />
            </FieldBlock>
            <FieldBlock label="企業名フリガナ">
              <Input value={mcNameKana} onChange={(e) => setMcNameKana(e.target.value)} placeholder="カタカナ" />
            </FieldBlock>
            <FieldBlock label="法人番号">
              <Input value={mcCorporateNumber} onChange={(e) => setMcCorporateNumber(e.target.value)} placeholder="13桁" />
            </FieldBlock>
            <FieldBlock label="区分">
              <Select value={mcCompanyType || UNSET} onValueChange={(v) => setMcCompanyType(v === UNSET ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="未選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {COMPANY_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <FieldBlock label="企業HP">
              <Input value={mcWebsiteUrl} onChange={(e) => setMcWebsiteUrl(e.target.value)} placeholder="https://" />
            </FieldBlock>
            <FieldBlock label="業界">
              <Input value={mcIndustry} onChange={(e) => setMcIndustry(e.target.value)} placeholder="例: 建設" />
            </FieldBlock>
            <FieldBlock label="売上規模">
              <Input value={mcRevenueScale} onChange={(e) => setMcRevenueScale(e.target.value)} placeholder="例: 1億〜5億" />
            </FieldBlock>
            <FieldBlock label="従業員数">
              <Input type="number" value={mcEmployeeCount} onChange={(e) => setMcEmployeeCount(e.target.value)} placeholder="例: 50" />
            </FieldBlock>
          </div>
          <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-3">
            <FieldBlock label="締め日">
              <Select value={mcClosingDay || UNSET} onValueChange={(v) => setMcClosingDay(v === UNSET ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="未選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {CLOSING_DAY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock label="支払月">
              <Select value={mcPaymentMonthOffset || UNSET} onValueChange={(v) => setMcPaymentMonthOffset(v === UNSET ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="未選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {PAYMENT_MONTH_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock label="支払日">
              <Select value={mcPaymentDay || UNSET} onValueChange={(v) => setMcPaymentDay(v === UNSET ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="未選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {CLOSING_DAY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReadOnlyField
              label="インボイス登録"
              value={masterCompany.isInvoiceRegistered
                ? `登録済み${masterCompany.invoiceRegistrationNumber ? ` (${masterCompany.invoiceRegistrationNumber})` : ""}`
                : "未登録"}
            />
          </div>
          <FieldBlock label="メモ（全顧客マスタ）">
            <Textarea value={mcNote} onChange={(e) => setMcNote(e.target.value)} rows={3} placeholder="全顧客マスタのメモ" />
          </FieldBlock>
        </CardContent>
      </Card>

      {/* 連絡先 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              連絡先
              <Badge variant="secondary">{contacts.length}件</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openAddContact}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              連絡先が登録されていません
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.isPrimary && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200" variant="outline">
                          <Star className="h-3 w-3 mr-0.5 fill-amber-400" />
                          主連絡先
                        </Badge>
                      )}
                      {c.department && (
                        <span className="text-xs text-gray-500">{c.department}</span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600">
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
                    {c.note && <p className="text-xs text-gray-400 mt-1">{c.note}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    {!c.isPrimary && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSetPrimary(c)} title="主連絡先にする">
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditContact(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteContact(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 連絡先追加・編集ダイアログ */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "連絡先を編集" : "連絡先を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FieldBlock label="名前 *">
              <Input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} />
            </FieldBlock>
            <div className="grid grid-cols-2 gap-3">
              <FieldBlock label="メールアドレス">
                <Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
              </FieldBlock>
              <FieldBlock label="電話番号">
                <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
              </FieldBlock>
            </div>
            <FieldBlock label="部署">
              <Input value={contactForm.department} onChange={(e) => setContactForm((f) => ({ ...f, department: e.target.value }))} />
            </FieldBlock>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPrimary"
                checked={contactForm.isPrimary}
                onCheckedChange={(v) => setContactForm((f) => ({ ...f, isPrimary: !!v }))}
              />
              <Label htmlFor="isPrimary" className="text-sm">主連絡先にする</Label>
            </div>
            <FieldBlock label="備考">
              <Textarea value={contactForm.note} onChange={(e) => setContactForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </FieldBlock>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveContact} disabled={contactSaving}>
              {contactSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingContact ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 企業拠点 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              企業拠点
              <Badge variant="secondary">{locations.length}件</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openAddLocation}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">拠点が登録されていません</div>
          ) : (
            <div className="space-y-3">
              {locations.map((l) => (
                <div key={l.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{l.name}</span>
                      {l.isPrimary && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200" variant="outline">
                          <Star className="h-3 w-3 mr-0.5 fill-amber-400" />主要拠点
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-600">
                      {l.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.address}</span>}
                      {l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
                      {l.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</span>}
                    </div>
                    {l.note && <p className="text-xs text-gray-400 mt-1">{l.note}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLocation(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteLocation(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 拠点追加・編集ダイアログ */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingLocation ? "拠点を編集" : "拠点を追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FieldBlock label="拠点名 *">
              <Input value={locationForm.name} onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))} placeholder="例: 本社" />
            </FieldBlock>
            <FieldBlock label="住所">
              <Input value={locationForm.address} onChange={(e) => setLocationForm((f) => ({ ...f, address: e.target.value }))} />
            </FieldBlock>
            <div className="grid grid-cols-2 gap-3">
              <FieldBlock label="電話番号">
                <Input value={locationForm.phone} onChange={(e) => setLocationForm((f) => ({ ...f, phone: e.target.value }))} />
              </FieldBlock>
              <FieldBlock label="メールアドレス">
                <Input type="email" value={locationForm.email} onChange={(e) => setLocationForm((f) => ({ ...f, email: e.target.value }))} />
              </FieldBlock>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="locPrimary" checked={locationForm.isPrimary} onCheckedChange={(v) => setLocationForm((f) => ({ ...f, isPrimary: !!v }))} />
              <Label htmlFor="locPrimary" className="text-sm">主要拠点にする</Label>
            </div>
            <FieldBlock label="備考">
              <Textarea value={locationForm.note} onChange={(e) => setLocationForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </FieldBlock>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveLocation} disabled={locationSaving}>
              {locationSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingLocation ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 銀行口座 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              銀行口座
              <Badge variant="secondary">{bankAccounts.length}件</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openAddBank}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">銀行口座が登録されていません</div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((b) => (
                <div key={b.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{b.bankName} {b.branchName}</div>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600">
                      <span>口座番号: {b.accountNumber}</span>
                      <span>名義: {b.accountHolderName}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
                      <span>銀行コード: {b.bankCode}</span>
                      <span>支店コード: {b.branchCode}</span>
                    </div>
                    {b.note && <p className="text-xs text-gray-400 mt-1">{b.note}</p>}
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBank(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteBank(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 銀行口座追加・編集ダイアログ */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingBank ? "銀行口座を編集" : "銀行口座を追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldBlock label="銀行名 *">
                <Input value={bankForm.bankName} onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))} />
              </FieldBlock>
              <FieldBlock label="銀行コード">
                <Input value={bankForm.bankCode} onChange={(e) => setBankForm((f) => ({ ...f, bankCode: e.target.value }))} placeholder="4桁" />
              </FieldBlock>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldBlock label="支店名">
                <Input value={bankForm.branchName} onChange={(e) => setBankForm((f) => ({ ...f, branchName: e.target.value }))} />
              </FieldBlock>
              <FieldBlock label="支店コード">
                <Input value={bankForm.branchCode} onChange={(e) => setBankForm((f) => ({ ...f, branchCode: e.target.value }))} placeholder="3桁" />
              </FieldBlock>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldBlock label="口座番号 *">
                <Input value={bankForm.accountNumber} onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))} />
              </FieldBlock>
              <FieldBlock label="口座名義人">
                <Input value={bankForm.accountHolderName} onChange={(e) => setBankForm((f) => ({ ...f, accountHolderName: e.target.value }))} />
              </FieldBlock>
            </div>
            <FieldBlock label="備考">
              <Textarea value={bankForm.note} onChange={(e) => setBankForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </FieldBlock>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveBank} disabled={bankSaving}>
              {bankSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBank ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STP企業情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            STP企業情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <FieldBlock label="業種区分">
              <Select
                value={industryType || UNSET}
                onValueChange={(v) => setIndustryType(v === UNSET ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {INDUSTRY_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock label="採用予定人数">
              <Input
                type="number"
                value={plannedHires}
                onChange={(e) => setPlannedHires(e.target.value)}
                placeholder="例: 5"
              />
            </FieldBlock>
          </div>
        </CardContent>
      </Card>

      {/* 営業・パイプライン */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            営業・パイプライン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <ReadOnlyField label="流入経路" value={company.leadSourceName} />
            <FieldBlock label="リード獲得日">
              <DatePicker
                value={leadAcquiredDate}
                onChange={setLeadAcquiredDate}
                placeholder="未設定"
              />
            </FieldBlock>
            <FieldBlock label="有効性">
              <Select
                value={leadValidity || UNSET}
                onValueChange={(v) => setLeadValidity(v === UNSET ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {VALIDITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <FieldBlock label="案件有無">
              <Select
                value={hasDeal || UNSET}
                onValueChange={(v) => setHasDeal(v === UNSET ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {DEAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          </div>
          <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <FieldBlock label="ヨミ">
              <Select
                value={forecast || UNSET}
                onValueChange={(v) => setForecast(v === UNSET ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {FORECAST_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
            <ReadOnlyField
              label="現在パイプライン"
              value={company.currentStageName}
            />
            <ReadOnlyField
              label="ネクストパイプライン"
              value={company.nextTargetStageName}
            />
            <ReadOnlyField
              label="目標日"
              value={company.nextTargetDate}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <ReadOnlyField label="担当営業" value={company.salesStaffName} />
            <ReadOnlyField label="担当事務" value={company.adminStaffName} />
            <ReadOnlyField label="代理店" value={company.agentName} />
            <FieldBlock label="運用ステータス">
              <Input
                value={operationStatus}
                onChange={(e) => setOperationStatus(e.target.value)}
                placeholder="未設定"
              />
            </FieldBlock>
          </div>
        </CardContent>
      </Card>

      {/* 契約サマリー */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            契約サマリー（最新の契約）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestContract ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-5 md:grid-cols-3">
                <ReadOnlyField label="求人媒体" value={latestContract.jobMedia} />
                <ReadOnlyField
                  label="契約プラン"
                  value={latestContract.contractPlan === "monthly" ? "月額" : "成果報酬"}
                />
                <ReadOnlyField label="月額" value={formatCurrency(latestContract.monthlyFee)} />
                <ReadOnlyField label="成果報酬単価" value={formatCurrency(latestContract.performanceFee)} />
                <ReadOnlyField label="初期費用" value={formatCurrency(latestContract.initialFee)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-5 md:grid-cols-3">
                <ReadOnlyField label="契約開始日" value={latestContract.contractStartDate} />
                <ReadOnlyField label="契約終了日" value={latestContract.contractEndDate} />
                <ReadOnlyField
                  label="ステータス"
                  value={CONTRACT_STATUS_LABELS[latestContract.status] || latestContract.status}
                />
                <ReadOnlyField label="担当運用" value={latestContract.operationStaffName} />
                <ReadOnlyField label="アカウントID" value={latestContract.accountId} />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="link"
                  size="sm"
                  className="text-blue-600"
                  onClick={() => onTabChange?.("contracts")}
                >
                  契約管理タブで詳細を見る
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">
              契約履歴がありません
            </div>
          )}
        </CardContent>
      </Card>

      {/* 運用情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            請求先・運用情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
            <FieldBlock label="請求先企業名">
              <Input
                value={billingCompanyName}
                onChange={(e) => setBillingCompanyName(e.target.value)}
                placeholder="未設定"
              />
            </FieldBlock>
            <FieldBlock label="請求先住所" className="lg:col-span-2">
              <Input
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="未設定"
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            <FieldBlock label="求人掲載開始日">
              <Input
                value={jobPostingStartDate}
                onChange={(e) => setJobPostingStartDate(e.target.value)}
                placeholder="例: 2026年4月1日〜"
              />
            </FieldBlock>
          </div>
        </CardContent>
      </Card>

      {/* メモ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            メモ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldBlock label="企業メモ">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="企業に関するメモ"
              />
            </FieldBlock>
            <FieldBlock label="契約メモ">
              <Textarea
                value={contractNote}
                onChange={(e) => setContractNote(e.target.value)}
                rows={4}
                placeholder="契約に関するメモ"
              />
            </FieldBlock>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldBlock label="検討理由">
              <Textarea
                value={pendingReason}
                onChange={(e) => setPendingReason(e.target.value)}
                rows={2}
                placeholder="検討中の場合の理由"
              />
            </FieldBlock>
            <FieldBlock label="失注理由">
              <Textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                rows={2}
                placeholder="失注の場合の理由"
              />
            </FieldBlock>
          </div>
        </CardContent>
      </Card>

      {/* 保存ボタン（固定表示） */}
      <div className="sticky bottom-4 flex justify-end z-10">
        <Button
          onClick={handleSave}
          disabled={isPending || !isDirty}
          className={`shadow-lg ${isDirty ? "bg-blue-600 hover:bg-blue-700" : ""}`}
          size="lg"
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存
          {isDirty && (
            <Badge variant="secondary" className="ml-2 bg-white/20 text-white text-xs">
              変更あり
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );
}
