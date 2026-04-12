"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineCell } from "@/components/inline-cell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { recordVendorPasswordResetRequest, updateVendorFields, addWholesaleAccount, updateWholesaleAccountByVendor, deleteWholesaleAccountByVendor } from "./actions";
import { Trash2, Plus, Pencil, FileText, ClipboardList, Banknote, Copy, Check, Eye } from "lucide-react";
import Link from "next/link";
import { VendorPortalLayout } from "./vendor-portal-layout";
import { PortalLoginWrapper } from "@/components/alkes-portal";
import type { VendorSection } from "./vendor-portal-layout";
import { VendorContractsSection } from "./vendor-contracts-section";
import { VendorActivitiesSection } from "./vendor-activities-section";
import { VendorCustomersSection } from "./vendor-customers-section";
import { VendorLoanSection } from "./vendor-loan-section";
import type { LoanSubmissionRow } from "./vendor-loan-section";
import { VendorProgressSection } from "./vendor-progress-section";
import type { ProgressRow } from "./vendor-progress-section";

type FormSubmissionData = {
  id: number;
  submittedAt: string;
  answers: Record<string, unknown>;
};

type ApplicantRecord = {
  id: number; lineFriendUid: string; lineName: string; applicantName: string; statusName: string;
  formAnswerDate: string; subsidyDesiredDate: string; subsidyAmount: number | null;
  paymentReceivedAmount: number | null; paymentReceivedDate: string;
  subsidyReceivedDate: string; vendorMemo: string;
  formSubmission: FormSubmissionData | null;
};

type WholesaleRecord = {
  id: number; supportProviderName: string; companyName: string; email: string;
  softwareSalesContractUrl: string;
  recruitmentRound: number | null; adoptionDate: string; issueRequestDate: string;
  accountApprovalDate: string; grantDate: string; toolCost: number | null; invoiceStatus: string;
};

type ContractRecord = {
  id: number; lineNumber: string; lineName: string; referralUrl: string;
  assignedAs: string; consultingStaff: string; companyName: string;
  representativeName: string; mainContactName: string; customerEmail: string;
  customerPhone: string; contractDate: string; contractPlan: string;
  contractAmount: number | string; serviceType: string; caseStatus: string;
  hasScSales: boolean; hasSubsidyConsulting: boolean; hasBpoSupport: boolean;
  consultingPlan: string; successFee: number | string; startDate: string;
  endDate: string; billingStatus: string; paymentStatus: string;
  revenueRecordingDate: string; grossProfit: number | string; notes: string;
};

type ConsultingTask = {
  id: number;
  taskType: "vendor" | "consulting_team";
  content: string;
  deadline: string;
  priority: string;
  completed: boolean;
};

type ActivityRecord = {
  id: number; activityDate: string; contactMethod: string; vendorIssue: string;
  vendorNextAction: string; nextDeadline: string;
  tasks: ConsultingTask[];
  attachmentUrls: string[]; recordingUrls: string[]; screenshotUrls: string[]; notes: string;
};

type PreAppRecord = {
  id: number; applicantName: string; referrer: string; salesStaff: string;
  category: string; status: string; prospectLevel: string; nextContactDate: string;
  overviewBriefingDate: string; briefingStaff: string; phone: string;
  businessEntity: string; industry: string; systemType: string; hasLoan: string;
  revenueRange: string; businessName: string;
};

type PostAppRecord = {
  id: number; isBpo: boolean; applicantName: string; memo: string;
  referrer: string; salesStaff: string; applicationCompletedDate: string;
  applicationStaff: string; grantApplicationNumber: string; nextAction: string;
  nextContactDate: string; subsidyStatus: string; subsidyApplicantName: string;
  prefecture: string; recruitmentRound: string; applicationType: string;
  itToolName: string; hasLoan: boolean; completedDate: string;
};

type VendorContactInfo = {
  id: number; name: string; role: string; email: string; phone: string; isPrimary: boolean;
};

type VendorInfo = {
  scLabel: string;
  assignedAs: string | null;
  consultingStaffNames: string[];
  companyName: string;
  contacts: VendorContactInfo[];
  kickoffMtg: string | null;
  consultingPlan: string | null;
  consultingPlanContractStatus: string | null;
  consultingPlanContractDate: string | null;
  consultingPlanEndDate: string | null;
  scWholesalePlan: string | null;
  scWholesaleContractStatus: string | null;
  scWholesaleContractDate: string | null;
  scWholesaleEndDate: string | null;
  grantApplicationBpoContractStatus: string | null;
  grantApplicationBpoContractDate: string | null;
  subsidyConsulting: boolean;
  grantApplicationBpo: boolean;
  loanUsage: boolean;
  loanUsageKickoffMtg: string | null;
  vendorSharedMemo: string | null;
};

type Props = {
  authenticated: boolean; isVendor: boolean; canEdit?: boolean;
  applicantData: ApplicantRecord[]; wholesaleData: WholesaleRecord[];
  contractsData: ContractRecord[]; activitiesData: ActivityRecord[];
  preApplicationData: PreAppRecord[]; postApplicationData: PostAppRecord[];
  loanCorporateData: LoanSubmissionRow[]; loanIndividualData: LoanSubmissionRow[];
  loanProgressData: ProgressRow[];
  vendorName: string; vendorToken: string; vendorId?: number;
  allVendors: { id: number; name: string; token: string }[];
  userName?: string;
  vendorInfo: VendorInfo;
};

// ========== ログインフォーム ==========
function LoginForm({ vendorName, vendorToken }: { vendorName: string; vendorToken: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const result = await signIn("credentials", { identifier: email, password, redirect: false });
      if (result?.error) {
        if (result.code === "pending_approval") setError("アカウントは認証待ち中です。しばらくお待ちください。");
        else if (result.code === "suspended") setError("アカウントが停止されています。");
        else setError("メールアドレスまたはパスワードが正しくありません");
      } else router.refresh();
    } catch { setError("ログインに失敗しました"); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (email.trim()) await recordVendorPasswordResetRequest(email.trim());
    setShowForgotPassword(true);
  };

  return (
    <PortalLoginWrapper title={vendorName} subtitle="パートナーポータルにログイン">
          {showForgotPassword ? (
            <div className="text-center space-y-4">
              <p className="text-gray-600">お手数ですが、担当スタッフへご連絡ください。</p>
              <Button variant="outline" onClick={() => setShowForgotPassword(false)}>ログインに戻る</Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">メールアドレス</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="password">パスワード</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-[#3b9d9d] to-[#6fb789] hover:opacity-90 text-white" disabled={loading}>{loading ? "ログイン中..." : "ログイン"}</Button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={handleForgotPassword} className="text-blue-600 hover:underline">パスワードを忘れた方</button>
                <Link href={`/hojo/vendor/${vendorToken}/register`} className="text-blue-600 hover:underline">アカウント登録</Link>
              </div>
            </form>
          )}
    </PortalLoginWrapper>
  );
}

// ========== フォームURLコピーボタン ==========
function FormUrlCopyButton({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/form/hojo-business-plan?uid=${uid}`
    : `/form/hojo-business-plan?uid=${uid}`;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1">
      {copied ? <><Check className="h-3 w-3 text-green-500" />コピー済</> : <><Copy className="h-3 w-3" />フォームURL</>}
    </Button>
  );
}

// ========== 回答データモーダル ==========
const ANSWER_SECTIONS = [
  { title: "基本情報", path: "basic", fields: [
    ["tradeName", "屋号"], ["openingDate", "開業年月日"], ["fullName", "氏名"],
    ["officeAddress", "事業所所在地"], ["phone", "電話番号"], ["email", "メールアドレス"],
    ["employeeCount", "従業員数"], ["homepageUrl", "ホームページURL"],
  ]},
  { title: "口座情報", path: "bankAccount", fields: [
    ["bankType", "金融機関"], ["yuchoSymbol", "記号"], ["yuchoPassbookNumber", "通帳番号"],
    ["yuchoAccountHolder", "口座名義人"], ["yuchoAccountHolderKana", "フリガナ"],
    ["otherBankName", "金融機関名"], ["otherBankCode", "金融機関コード"],
    ["otherBranchName", "支店名"], ["otherBranchCode", "支店コード"],
    ["otherAccountType", "口座種別"], ["otherAccountNumber", "口座番号"],
    ["otherAccountHolder", "口座名義人"], ["otherAccountHolderKana", "フリガナ"],
  ]},
  { title: "事業概要", path: "businessOverview", fields: [
    ["businessContent", "事業内容"], ["mainProductService", "主力商品・サービス"],
    ["businessStrength", "特徴・強み"], ["openingBackground", "開業の経緯"],
    ["businessScale", "事業規模"],
  ]},
  { title: "市場・競合情報", path: "marketCompetition", fields: [
    ["targetMarket", "ターゲット市場"], ["targetCustomerProfile", "ターゲット顧客層"],
    ["competitors", "競合"], ["strengthsAndChallenges", "強みと課題"],
  ]},
  { title: "支援制度申請関連", path: "supportApplication", fields: [
    ["supportPurpose", "目的"], ["supportGoal", "実現したいこと"],
    ["investmentPlan", "具体的計画"], ["expectedOutcome", "期待される成果"],
  ]},
  { title: "事業体制とご経歴", path: "businessStructure", fields: [
    ["ownerCareer", "経歴・スキル"], ["staffRoles", "スタッフの役割"],
    ["futureHiring", "必要な人材"],
  ]},
  { title: "事業計画", path: "businessPlan", fields: [
    ["shortTermGoal", "短期目標(1年)"], ["midTermGoal", "中期目標(3年)"],
    ["longTermGoal", "長期目標(5年)"], ["salesStrategy", "販売戦略・PR計画"],
  ]},
  { title: "財務情報", path: "financial", fields: [
    ["futureInvestmentPlan", "投資計画と必要資金"], ["debtInfo", "借入状況"],
  ]},
];

function FormAnswerModal({ data, open, onClose }: { data: FormSubmissionData; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>フォーム回答データ</DialogTitle>
          <p className="text-sm text-muted-foreground">
            回答日時: {new Date(data.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </p>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          {ANSWER_SECTIONS.map((section) => {
            const sectionData = data.answers[section.path] as Record<string, string> | undefined;
            if (!sectionData) return null;
            const hasValue = section.fields.some(([key]) => sectionData[key]);
            if (!hasValue) return null;
            return (
              <div key={section.path}>
                <h3 className="text-sm font-bold text-gray-900 border-b pb-1 mb-3">{section.title}</h3>
                <dl className="space-y-2">
                  {section.fields.map(([key, label]) => {
                    const v = sectionData[key];
                    if (!v) return null;
                    return (
                      <div key={key}>
                        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                        <dd className="text-sm whitespace-pre-wrap bg-gray-50 rounded p-2 mt-0.5">{v}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== 助成金申請者管理タブ ==========
function ApplicantTab({ data, canEdit, vendorId }: { data: ApplicantRecord[]; canEdit: boolean; vendorId?: number }) {
  const [editRecord, setEditRecord] = useState<ApplicantRecord | null>(null);
  const [editData, setEditData] = useState({ subsidyDesiredDate: "", subsidyAmount: "", vendorMemo: "" });
  const [saving, setSaving] = useState(false);
  const [viewSubmission, setViewSubmission] = useState<FormSubmissionData | null>(null);
  const router = useRouter();

  const openEdit = (r: ApplicantRecord) => {
    setEditRecord(r);
    setEditData({ subsidyDesiredDate: r.subsidyDesiredDate, subsidyAmount: r.subsidyAmount != null ? String(r.subsidyAmount) : "", vendorMemo: r.vendorMemo });
  };

  const saveModal = async () => {
    if (!editRecord || !vendorId) return;
    setSaving(true);
    try {
      const result = await updateVendorFields(editRecord.id, vendorId, { subsidyDesiredDate: editData.subsidyDesiredDate || null, subsidyAmount: editData.subsidyAmount ? Number(editData.subsidyAmount) : null, vendorMemo: editData.vendorMemo || null });
      if (!result.ok) { alert(result.error); return; }
      setEditRecord(null); router.refresh();
    } finally { setSaving(false); }
  };

  const inlineSave = async (id: number, field: string, value: string) => {
    if (!vendorId) return;
    const payload: Record<string, unknown> = {};
    if (field === "subsidyDesiredDate") payload.subsidyDesiredDate = value || null;
    if (field === "subsidyAmount") payload.subsidyAmount = value ? Number(value) : null;
    if (field === "vendorMemo") payload.vendorMemo = value || null;
    const result = await updateVendorFields(id, vendorId, payload);
    if (!result.ok) { alert(result.error); return; }
    router.refresh();
  };

  const fmt = (n: number | null) => n == null ? "-" : `¥${n.toLocaleString()}`;

  return (
    <>
      <div className="overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>LINE名</TableHead><TableHead>申請者名</TableHead><TableHead>ステータス</TableHead><TableHead>フォームURL</TableHead><TableHead>フォーム回答日</TableHead><TableHead>回答データ</TableHead>
            <TableHead>助成金着金希望日</TableHead><TableHead>助成金額</TableHead><TableHead>原資金額</TableHead><TableHead>原資着金日</TableHead>
            <TableHead>助成金着金日</TableHead><TableHead>備考</TableHead>
            {canEdit && <TableHead className="w-[60px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={canEdit ? 13 : 12} className="text-center text-gray-500 py-8">データがありません</TableCell></TableRow>
            : data.map((r) => (
              <TableRow key={r.id} className="group/row">
                <TableCell className="whitespace-nowrap">{r.lineName}</TableCell><TableCell className="whitespace-nowrap">{r.applicantName}</TableCell><TableCell className="whitespace-nowrap">{r.statusName}</TableCell>
                <TableCell><FormUrlCopyButton uid={r.lineFriendUid} /></TableCell>
                <TableCell className="whitespace-nowrap">{r.formAnswerDate}</TableCell>
                <TableCell>
                  {r.formSubmission ? (
                    <button onClick={() => setViewSubmission(r.formSubmission)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
                      <Eye className="h-3 w-3" />回答を見る
                    </button>
                  ) : <span className="text-gray-400">-</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.subsidyDesiredDate} onSave={(v) => inlineSave(r.id, "subsidyDesiredDate", v)} type="date">{r.subsidyDesiredDate || "-"}</InlineCell> : r.subsidyDesiredDate || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.subsidyAmount != null ? String(r.subsidyAmount) : ""} onSave={(v) => inlineSave(r.id, "subsidyAmount", v)} type="number">{fmt(r.subsidyAmount)}</InlineCell> : fmt(r.subsidyAmount)}</TableCell>
                <TableCell className="whitespace-nowrap">{fmt(r.paymentReceivedAmount)}</TableCell><TableCell className="whitespace-nowrap">{r.paymentReceivedDate}</TableCell><TableCell className="whitespace-nowrap">{r.subsidyReceivedDate}</TableCell>
                <TableCell className="max-w-[200px]">{canEdit ? <InlineCell value={r.vendorMemo} onSave={(v) => inlineSave(r.id, "vendorMemo", v)} type="textarea">{r.vendorMemo || "-"}</InlineCell> : r.vendorMemo || "-"}</TableCell>
                {canEdit && <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]"><Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>申請者情報の編集</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>助成金着金希望日</Label><DatePicker value={editData.subsidyDesiredDate} onChange={(v) => setEditData({ ...editData, subsidyDesiredDate: v })} /></div>
            <div className="space-y-1"><Label>助成金額</Label><Input type="number" value={editData.subsidyAmount} onChange={(e) => setEditData({ ...editData, subsidyAmount: e.target.value })} /></div>
            <div className="space-y-1"><Label>備考</Label><Textarea value={editData.vendorMemo} onChange={(e) => setEditData({ ...editData, vendorMemo: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditRecord(null)}>キャンセル</Button><Button onClick={saveModal} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {viewSubmission && (
        <FormAnswerModal data={viewSubmission} open={true} onClose={() => setViewSubmission(null)} />
      )}
    </>
  );
}

// ========== 卸アカウント管理タブ ==========
function WholesaleTab({ data, canEdit, vendorId }: { data: WholesaleRecord[]; canEdit: boolean; vendorId?: number }) {
  const [editRecord, setEditRecord] = useState<WholesaleRecord | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Record<string, string>>({});
  const router = useRouter();

  const openEdit = (r: WholesaleRecord) => {
    setEditRecord(r);
    setEditData({
      supportProviderName: r.supportProviderName, companyName: r.companyName, email: r.email,
      softwareSalesContractUrl: r.softwareSalesContractUrl,
      recruitmentRound: r.recruitmentRound != null ? String(r.recruitmentRound) : "",
      adoptionDate: r.adoptionDate, issueRequestDate: r.issueRequestDate, grantDate: r.grantDate,
    });
  };

  const saveModal = async () => {
    if (!editRecord || !vendorId) return;
    setSaving(true);
    try {
      const result = await updateWholesaleAccountByVendor(editRecord.id, vendorId, { ...editData, recruitmentRound: editData.recruitmentRound ? Number(editData.recruitmentRound) : null });
      if (!result.ok) { alert(result.error); return; }
      setEditRecord(null); router.refresh();
    } finally { setSaving(false); }
  };

  const inlineSave = async (id: number, field: string, value: string) => {
    if (!vendorId) return;
    const payload: Record<string, unknown> = { [field]: field === "recruitmentRound" ? (value ? Number(value) : null) : (value || null) };
    const result = await updateWholesaleAccountByVendor(id, vendorId, payload);
    if (!result.ok) { alert(result.error); return; }
    router.refresh();
  };

  const handleAdd = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      const result = await addWholesaleAccount(vendorId, { ...newData, recruitmentRound: newData.recruitmentRound ? Number(newData.recruitmentRound) : null });
      if (!result.ok) { alert(result.error); return; }
      setAdding(false); setNewData({}); router.refresh();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!vendorId || !confirm("削除しますか？")) return;
    const result = await deleteWholesaleAccountByVendor(id, vendorId);
    if (!result.ok) { alert(result.error); return; }
    router.refresh();
  };

  const fmtCost = (n: number | null) => n == null ? "-" : `${n}万円`;

  const editableFields = [
    { key: "supportProviderName", label: "支援事業者名", type: "text" as const },
    { key: "companyName", label: "会社名(補助事業社、納品先）", type: "text" as const },
    { key: "email", label: "メールアドレス(アカウント)", type: "text" as const },
    { key: "softwareSalesContractUrl", label: "ソフトウェア販売契約書", type: "url" as const, placeholder: "https://..." },
    { key: "recruitmentRound", label: "募集回", type: "number" as const },
    { key: "adoptionDate", label: "採択日", type: "date" as const },
    { key: "issueRequestDate", label: "発行依頼日", type: "date" as const },
    { key: "grantDate", label: "交付日", type: "date" as const },
  ];

  return (
    <>
      <div className="space-y-4">
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={() => { setAdding(true); setNewData({}); }} className="gap-2"><Plus className="h-4 w-4" />新規追加</Button>
          </div>
        )}
        <div className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-12">No.</TableHead>
              <TableHead>支援事業者名</TableHead><TableHead>会社名(補助事業社、納品先）</TableHead><TableHead>メールアドレス(アカウント)</TableHead>
              <TableHead>ソフトウェア販売契約書</TableHead><TableHead>募集回</TableHead><TableHead>採択日</TableHead><TableHead>発行依頼日</TableHead><TableHead>アカウント承認日</TableHead>
              <TableHead>交付日</TableHead><TableHead>ツール代(税別)万円</TableHead><TableHead>請求入金状況</TableHead>
              {canEdit && <TableHead className="w-[80px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {data.length === 0 ? <TableRow><TableCell colSpan={canEdit ? 13 : 12} className="text-center text-gray-500 py-8">データがありません</TableCell></TableRow>
              : data.map((r, idx) => (
                <TableRow key={r.id} className="group/row">
                  <TableCell className="text-gray-500">{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.supportProviderName} onSave={(v) => inlineSave(r.id, "supportProviderName", v)}>{r.supportProviderName || "-"}</InlineCell> : r.supportProviderName || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.companyName} onSave={(v) => inlineSave(r.id, "companyName", v)}>{r.companyName || "-"}</InlineCell> : r.companyName || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.email} onSave={(v) => inlineSave(r.id, "email", v)}>{r.email || "-"}</InlineCell> : r.email || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.softwareSalesContractUrl} onSave={(v) => inlineSave(r.id, "softwareSalesContractUrl", v)}>{r.softwareSalesContractUrl ? <a href={r.softwareSalesContractUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">リンク</a> : "-"}</InlineCell> : r.softwareSalesContractUrl ? <a href={r.softwareSalesContractUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">リンク</a> : "-"}</TableCell>
                  <TableCell>{canEdit ? <InlineCell value={r.recruitmentRound != null ? String(r.recruitmentRound) : ""} onSave={(v) => inlineSave(r.id, "recruitmentRound", v)} type="number">{r.recruitmentRound ?? "-"}</InlineCell> : r.recruitmentRound ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.adoptionDate} onSave={(v) => inlineSave(r.id, "adoptionDate", v)} type="date">{r.adoptionDate || "-"}</InlineCell> : r.adoptionDate || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.issueRequestDate} onSave={(v) => inlineSave(r.id, "issueRequestDate", v)} type="date">{r.issueRequestDate || "-"}</InlineCell> : r.issueRequestDate || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.accountApprovalDate}</TableCell>
                  <TableCell className="whitespace-nowrap">{canEdit ? <InlineCell value={r.grantDate} onSave={(v) => inlineSave(r.id, "grantDate", v)} type="date">{r.grantDate || "-"}</InlineCell> : r.grantDate || "-"}</TableCell>
                  <TableCell>{fmtCost(r.toolCost)}</TableCell><TableCell className="whitespace-nowrap">{r.invoiceStatus}</TableCell>
                  {canEdit && (
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 新規追加モーダル */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>卸アカウント新規追加</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editableFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                {f.type === "date" ? <DatePicker value={newData[f.key] || ""} onChange={(v) => setNewData({ ...newData, [f.key]: v })} />
                : <Input type={f.type} value={newData[f.key] || ""} onChange={(e) => setNewData({ ...newData, [f.key]: e.target.value })} min={f.type === "number" ? "1" : undefined} placeholder={"placeholder" in f ? f.placeholder : undefined} />}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdding(false)}>キャンセル</Button><Button onClick={handleAdd} disabled={saving}>{saving ? "追加中..." : "追加"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集モーダル */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>卸アカウント編集</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editableFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                {f.type === "date" ? <DatePicker value={editData[f.key] || ""} onChange={(v) => setEditData({ ...editData, [f.key]: v })} />
                : <Input type={f.type} value={editData[f.key] || ""} onChange={(e) => setEditData({ ...editData, [f.key]: e.target.value })} min={f.type === "number" ? "1" : undefined} />}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditRecord(null)}>キャンセル</Button><Button onClick={saveModal} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== プレースホルダーセクション ==========
function PlaceholderSection({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Icon className="h-12 w-12 mb-4" />
        <p className="text-lg">{message}</p>
      </CardContent>
    </Card>
  );
}

// ========== メインコンポーネント ==========
const VALID_SECTIONS: VendorSection[] = ["consulting-contract", "consulting-activity", "consulting-customer", "wholesale", "grant", "loan", "loan-progress"];

function VendorDataPage({ applicantData, wholesaleData, contractsData, activitiesData, preApplicationData, postApplicationData, loanCorporateData, loanIndividualData, loanProgressData, isVendor, canEdit = false, vendorId, vendorName, allVendors, vendorToken, userName, vendorInfo }: Omit<Props, "authenticated">) {
  // SSRと一致する初期値を使い、マウント後にハッシュから復元
  const [activeSection, setActiveSection] = useState<VendorSection>("consulting-contract");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (VALID_SECTIONS.includes(hash as VendorSection)) {
      setActiveSection(hash as VendorSection);
    }
  }, []);

  const handleSectionChange = useCallback((section: VendorSection) => {
    setActiveSection(section);
    window.history.replaceState(null, "", `#${section}`);
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case "wholesale":
        return <WholesaleTab data={wholesaleData} canEdit={canEdit} vendorId={vendorId} />;
      case "grant":
        return <ApplicantTab data={applicantData} canEdit={canEdit} vendorId={vendorId} />;
      case "consulting-contract":
        return <VendorContractsSection data={contractsData} vendorInfo={vendorInfo} />;
      case "consulting-activity":
        return <VendorActivitiesSection data={activitiesData} vendorId={vendorId!} canEdit={canEdit} />;
      case "consulting-customer":
        return <VendorCustomersSection preApplicationData={preApplicationData} postApplicationData={postApplicationData} vendorId={vendorId} canEdit={canEdit} />;
      case "loan":
        return <VendorLoanSection vendorToken={vendorToken} vendorId={vendorId!} canEdit={canEdit} corporateSubmissions={loanCorporateData} individualSubmissions={loanIndividualData} />;
      case "loan-progress":
        return <VendorProgressSection data={loanProgressData} vendorId={vendorId!} canEdit={canEdit} />;
    }
  };

  return (
    <VendorPortalLayout
      authenticated={true}
      isVendor={isVendor}
      canEdit={canEdit}
      vendorName={vendorName}
      vendorToken={vendorToken}
      allVendors={allVendors}
      userName={userName}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
      {renderSection()}
    </VendorPortalLayout>
  );
}

export function VendorClientPage({ authenticated, isVendor, canEdit = false, applicantData, wholesaleData, contractsData, activitiesData, preApplicationData, postApplicationData, loanCorporateData, loanIndividualData, loanProgressData, vendorName, vendorToken, vendorId, allVendors, userName, vendorInfo }: Props) {
  if (!authenticated) return <LoginForm vendorName={vendorName} vendorToken={vendorToken} />;
  return (
    <div className={isVendor ? "min-h-screen" : ""}>
      <VendorDataPage applicantData={applicantData} wholesaleData={wholesaleData} contractsData={contractsData} activitiesData={activitiesData} preApplicationData={preApplicationData} postApplicationData={postApplicationData} loanCorporateData={loanCorporateData} loanIndividualData={loanIndividualData} loanProgressData={loanProgressData} isVendor={isVendor} canEdit={canEdit} vendorId={vendorId} vendorName={vendorName} allVendors={allVendors} vendorToken={vendorToken} userName={userName} vendorInfo={vendorInfo} />
    </div>
  );
}
