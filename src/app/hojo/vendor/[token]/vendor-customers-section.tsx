"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import {
  addPreApplicationByVendor,
  updatePreApplicationByVendor,
  addPostApplicationByVendor,
  updatePostApplicationByVendor,
  getPreApplicationDetail,
  getPostApplicationDetail,
} from "./actions";

// ---- Types ----

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

type Props = {
  preApplicationData: PreAppRecord[];
  postApplicationData: PostAppRecord[];
  vendorId?: number;
  canEdit?: boolean;
};

// ---- Helpers ----

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function ReferenceGuide({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 rounded-xl border border-[#a7f3d0] bg-gradient-to-r from-[#d1fae5]/80 to-[#ecfdf5]/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-5 py-3 text-sm text-[#10b981] font-medium hover:bg-[#a7f3d0]/50 transition-colors"
      >
        <div className="w-6 h-6 rounded-md bg-[#a7f3d0] flex items-center justify-center shrink-0">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-[#10b981]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#10b981]" />}
        </div>
        記入例・書き方ガイドを見る
      </button>
      {open && (
        <div className="px-5 pb-4 pt-1 border-t border-[#a7f3d0]">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-white/60 rounded-lg p-4">{content}</pre>
        </div>
      )}
    </div>
  );
}

// ---- Pre-Application Tab ----

const PRE_APP_GUIDE = `■ 詳細メモの書き方:
申請者名：
[記録]
法人or個人：
事業内容：
売上：
システム：セキュリティクラウド
枠：インボイス枠
貸付：あり/なし
gBizID：あり/なし
次のアクション：
申請可否：あり/なし
次の日程：
メモ：

■ 主な入力例:
・区分: クライアント
・ステータス: 申請完了
・事業体: 法人
・業種: 建築業
・貸付: あり / なし
・売上帯: 2000万〜2499万
・申請システム: セキュリティクラウド`;

function PreApplicationTab({ data, vendorId, canEdit }: { data: PreAppRecord[]; vendorId?: number; canEdit: boolean }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }));

  const openNew = () => {
    setEditId(null);
    setForm({});
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const result = await getPreApplicationDetail(id, vendorId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setEditId(id);
      setForm(result.data);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      const result = editId
        ? await updatePreApplicationByVendor(editId, vendorId, form)
        : await addPreApplicationByVendor(vendorId, form);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ReferenceGuide content={PRE_APP_GUIDE} />
      {canEdit && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openNew} className="gap-1.5 shadow-sm bg-gradient-to-r from-[#10b981] to-[#86efac] hover:opacity-90 text-white"><Plus className="h-4 w-4" />新規追加</Button>
        </div>
      )}
      <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-[#10b981]/5 to-[#86efac]/5">
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">申請者名</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">区分</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">ステータス</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">事業体</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">業種</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">売上帯</TableHead>
              {canEdit && <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold sticky right-0 z-30 bg-slate-50/80 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-slate-400 py-12">データがありません</TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.id} className="group/row hover:bg-slate-50/50 transition-colors">
                  <TableCell className="whitespace-nowrap text-sm font-medium text-slate-700">{r.applicantName || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.category || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.status || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.businessEntity || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.industry || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.revenueRange || "-"}</TableCell>
                  {canEdit && (
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-slate-50/50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-700" onClick={() => openEdit(r.id)} disabled={loading}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "概要案内 編集" : "概要案内 新規追加"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <FormGrid>
              <FormField label="申請者名"><Input placeholder="例: 山田太郎" value={String(form.applicantName ?? "")} onChange={(e) => set("applicantName", e.target.value)} /></FormField>
              <FormField label="紹介者"><Input placeholder="例: 田中一郎" value={String(form.referrer ?? "")} onChange={(e) => set("referrer", e.target.value)} /></FormField>
              <FormField label="営業担当者"><Input placeholder="例: 鈴木花子" value={String(form.salesStaff ?? "")} onChange={(e) => set("salesStaff", e.target.value)} /></FormField>
              <FormField label="区分"><Input placeholder="例: クライアント" value={String(form.category ?? "")} onChange={(e) => set("category", e.target.value)} /></FormField>
              <FormField label="ステータス"><Input placeholder="例: 申請完了" value={String(form.status ?? "")} onChange={(e) => set("status", e.target.value)} /></FormField>
              <FormField label="見込み度合い"><Input placeholder="例: A" value={String(form.prospectLevel ?? "")} onChange={(e) => set("prospectLevel", e.target.value)} /></FormField>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="詳細メモ"><Textarea placeholder="詳細メモを入力" rows={4} value={String(form.detailMemo ?? "")} onChange={(e) => set("detailMemo", e.target.value)} /></FormField>
              </div>
              <FormField label="次のアクション"><Input placeholder="例: 資料送付" value={String(form.nextAction ?? "")} onChange={(e) => set("nextAction", e.target.value)} /></FormField>
              <FormField label="次の連絡日"><DatePicker value={String(form.nextContactDate ?? "")} onChange={(v) => set("nextContactDate", v)} /></FormField>
              <FormField label="概要案内日"><DatePicker value={String(form.overviewBriefingDate ?? "")} onChange={(v) => set("overviewBriefingDate", v)} /></FormField>
              <FormField label="MTG録画"><Input placeholder="例: https://..." value={String(form.mtgRecordingUrl ?? "")} onChange={(e) => set("mtgRecordingUrl", e.target.value)} /></FormField>
              <FormField label="案内担当者"><Input placeholder="例: 佐藤太郎" value={String(form.briefingStaff ?? "")} onChange={(e) => set("briefingStaff", e.target.value)} /></FormField>
              <FormField label="電話番号"><Input placeholder="例: 090-1234-5678" value={String(form.phone ?? "")} onChange={(e) => set("phone", e.target.value)} /></FormField>
              <FormField label="事業体"><Input placeholder="例: 法人" value={String(form.businessEntity ?? "")} onChange={(e) => set("businessEntity", e.target.value)} /></FormField>
              <FormField label="業種"><Input placeholder="例: 建築業" value={String(form.industry ?? "")} onChange={(e) => set("industry", e.target.value)} /></FormField>
              <FormField label="システム"><Input placeholder="例: セキュリティクラウド" value={String(form.systemType ?? "")} onChange={(e) => set("systemType", e.target.value)} /></FormField>
              <FormField label="貸付"><Input placeholder="例: あり / なし" value={String(form.hasLoan ?? "")} onChange={(e) => set("hasLoan", e.target.value)} /></FormField>
              <FormField label="売上帯"><Input placeholder="例: 2000万〜2499万" value={String(form.revenueRange ?? "")} onChange={(e) => set("revenueRange", e.target.value)} /></FormField>
              <FormField label="重要タグ"><Input placeholder="例: 重要" value={String(form.importantTags ?? "")} onChange={(e) => set("importantTags", e.target.value)} /></FormField>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="貸付×インボイス（貸付なし/インボイスあり、貸付なし/インボイスなし(現金)、貸付あり/インボイスあり、貸付あり/インボイスなし(現金) のいずれか）">
                  <Input value={String(form.loanPattern ?? "")} onChange={(e) => set("loanPattern", e.target.value)} />
                </FormField>
              </div>
              <FormField label="紹介者報酬%"><Input type="number" step="0.01" value={String(form.referrerRewardPct ?? "")} onChange={(e) => set("referrerRewardPct", e.target.value)} /></FormField>
              <FormField label="代理店①番号"><Input value={String(form.agent1Number ?? "")} onChange={(e) => set("agent1Number", e.target.value)} /></FormField>
              <FormField label="代理店①報酬%"><Input type="number" step="0.01" value={String(form.agent1RewardPct ?? "")} onChange={(e) => set("agent1RewardPct", e.target.value)} /></FormField>
              <FormField label="報酬合計"><Input type="number" value={String(form.totalReward ?? "")} onChange={(e) => set("totalReward", e.target.value)} /></FormField>
              <FormField label="ダブルチェック者"><Input value={String(form.doubleChecker ?? "")} onChange={(e) => set("doubleChecker", e.target.value)} /></FormField>
              <FormField label="おかわり判定"><Input value={String(form.repeatJudgment ?? "")} onChange={(e) => set("repeatJudgment", e.target.value)} /></FormField>
              <FormField label="賃上げ可否"><Input value={String(form.wageRaiseEligible ?? "")} onChange={(e) => set("wageRaiseEligible", e.target.value)} /></FormField>
              <FormField label="過去導入商品名"><Input value={String(form.pastProduct ?? "")} onChange={(e) => set("pastProduct", e.target.value)} /></FormField>
              <FormField label="検討後失注日／離脱日"><DatePicker value={String(form.lostDate ?? "")} onChange={(v) => set("lostDate", v)} /></FormField>
              <FormField label="代理店契約書URL"><Input placeholder="例: https://..." value={String(form.agentContractUrl ?? "")} onChange={(e) => set("agentContractUrl", e.target.value)} /></FormField>
              <FormField label="書類取得開始日"><DatePicker value={String(form.docCollectionStart ?? "")} onChange={(v) => set("docCollectionStart", v)} /></FormField>
              <FormField label="書類提出日"><DatePicker value={String(form.docSubmissionDate ?? "")} onChange={(v) => set("docSubmissionDate", v)} /></FormField>
              <FormField label="事業者名"><Input placeholder="例: 株式会社○○" value={String(form.businessName ?? "")} onChange={(e) => set("businessName", e.target.value)} /></FormField>
              <FormField label="書類①"><Input value={String(form.doc1 ?? "")} onChange={(e) => set("doc1", e.target.value)} /></FormField>
              <FormField label="書類②"><Input value={String(form.doc2 ?? "")} onChange={(e) => set("doc2", e.target.value)} /></FormField>
              <FormField label="書類③"><Input value={String(form.doc3 ?? "")} onChange={(e) => set("doc3", e.target.value)} /></FormField>
              <FormField label="書類④"><Input value={String(form.doc4 ?? "")} onChange={(e) => set("doc4", e.target.value)} /></FormField>
              <FormField label="書類⑤（賃金台帳）"><Input value={String(form.doc5 ?? "")} onChange={(e) => set("doc5", e.target.value)} /></FormField>
              <FormField label="IT戦略ナビwithPDF"><Input value={String(form.itStrategyNaviPdf ?? "")} onChange={(e) => set("itStrategyNaviPdf", e.target.value)} /></FormField>
              <FormField label="従業員有無"><Input value={String(form.hasEmployees ?? "")} onChange={(e) => set("hasEmployees", e.target.value)} /></FormField>
              <FormField label="gBizID TOPスクショ"><Input value={String(form.gbizidScreenshot ?? "")} onChange={(e) => set("gbizidScreenshot", e.target.value)} /></FormField>
              <FormField label="gBizID アドレス"><Input value={String(form.gbizidAddress ?? "")} onChange={(e) => set("gbizidAddress", e.target.value)} /></FormField>
              <FormField label="自己宣言ID(11桁)"><Input value={String(form.selfDeclarationId ?? "")} onChange={(e) => set("selfDeclarationId", e.target.value)} /></FormField>
              <FormField label="反社チェック"><Input value={String(form.antiSocialCheck ?? "")} onChange={(e) => set("antiSocialCheck", e.target.value)} /></FormField>
              <FormField label="開業／設立年月日"><DatePicker value={String(form.establishmentDate ?? "")} onChange={(v) => set("establishmentDate", v)} /></FormField>
              <FormField label="資本金"><Input value={String(form.capital ?? "")} onChange={(e) => set("capital", e.target.value)} /></FormField>
              <FormField label="決算月"><Input placeholder="例: 3月" value={String(form.fiscalMonth ?? "")} onChange={(e) => set("fiscalMonth", e.target.value)} /></FormField>
              <FormField label="売上高"><Input type="number" value={String(form.revenue ?? "")} onChange={(e) => set("revenue", e.target.value)} /></FormField>
              <FormField label="粗利益"><Input type="number" value={String(form.grossProfit ?? "")} onChange={(e) => set("grossProfit", e.target.value)} /></FormField>
              <FormField label="営業利益"><Input type="number" value={String(form.operatingProfit ?? "")} onChange={(e) => set("operatingProfit", e.target.value)} /></FormField>
              <FormField label="経常利益"><Input type="number" value={String(form.ordinaryProfit ?? "")} onChange={(e) => set("ordinaryProfit", e.target.value)} /></FormField>
              <FormField label="減価償却費"><Input type="number" value={String(form.depreciation ?? "")} onChange={(e) => set("depreciation", e.target.value)} /></FormField>
              <FormField label="人件費"><Input type="number" value={String(form.laborCost ?? "")} onChange={(e) => set("laborCost", e.target.value)} /></FormField>
              <FormField label="資本金または準備金"><Input value={String(form.capitalOrReserve ?? "")} onChange={(e) => set("capitalOrReserve", e.target.value)} /></FormField>
              <FormField label="役員報酬総額"><Input type="number" value={String(form.executiveCompensation ?? "")} onChange={(e) => set("executiveCompensation", e.target.value)} /></FormField>
              <FormField label="給与支払い総額（前年度実績値）"><Input type="number" value={String(form.totalSalaryPrevYear ?? "")} onChange={(e) => set("totalSalaryPrevYear", e.target.value)} /></FormField>
              <FormField label="※参考程度 計画数値(1年度目)"><Input value={String(form.planYear1 ?? "")} onChange={(e) => set("planYear1", e.target.value)} /></FormField>
              <FormField label="※参考程度 計画数値(2年度目)"><Input value={String(form.planYear2 ?? "")} onChange={(e) => set("planYear2", e.target.value)} /></FormField>
              <FormField label="※参考程度 計画数値(3年度目)"><Input value={String(form.planYear3 ?? "")} onChange={(e) => set("planYear3", e.target.value)} /></FormField>
              <FormField label="加点①対象"><Input value={String(form.bonus1Target ?? "")} onChange={(e) => set("bonus1Target", e.target.value)} /></FormField>
              <FormField label="加点①資料"><Input value={String(form.bonus1Doc ?? "")} onChange={(e) => set("bonus1Doc", e.target.value)} /></FormField>
              <FormField label="加点②対象"><Input value={String(form.bonus2Target ?? "")} onChange={(e) => set("bonus2Target", e.target.value)} /></FormField>
              <FormField label="加点②資料"><Input value={String(form.bonus2Doc ?? "")} onChange={(e) => set("bonus2Doc", e.target.value)} /></FormField>
              <FormField label="事業場内最低賃金"><Input value={String(form.minWage ?? "")} onChange={(e) => set("minWage", e.target.value)} /></FormField>
              <FormField label="申請システム"><Input placeholder="例: セキュリティクラウド" value={String(form.applicationSystem ?? "")} onChange={(e) => set("applicationSystem", e.target.value)} /></FormField>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="事業内容文章（申請文章）"><Textarea rows={3} value={String(form.businessDescriptionDraft ?? "")} onChange={(e) => set("businessDescriptionDraft", e.target.value)} /></FormField>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="3.ビジネスプロセスの改善に向けて ∟その他（フリー記載）"><Textarea rows={3} value={String(form.businessProcessNote ?? "")} onChange={(e) => set("businessProcessNote", e.target.value)} /></FormField>
              </div>
              <FormField label="HP"><Input placeholder="例: https://..." value={String(form.homepageUrl ?? "")} onChange={(e) => set("homepageUrl", e.target.value)} /></FormField>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="事業内容"><Textarea rows={3} value={String(form.businessDescription ?? "")} onChange={(e) => set("businessDescription", e.target.value)} /></FormField>
              </div>
              <FormField label="挑戦課題のタイトル"><Input value={String(form.challengeTitle ?? "")} onChange={(e) => set("challengeTitle", e.target.value)} /></FormField>
              <FormField label="挑戦課題の解決の目標"><Input value={String(form.challengeGoal ?? "")} onChange={(e) => set("challengeGoal", e.target.value)} /></FormField>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="成長マッチング 事業内容"><Textarea rows={3} value={String(form.growthMatchingDescription ?? "")} onChange={(e) => set("growthMatchingDescription", e.target.value)} /></FormField>
              </div>
              <FormField label="情報入力者"><Input value={String(form.dataEntryStaff ?? "")} onChange={(e) => set("dataEntryStaff", e.target.value)} /></FormField>
              <FormField label="情報入力 確認"><Input value={String(form.dataEntryConfirmed ?? "")} onChange={(e) => set("dataEntryConfirmed", e.target.value)} /></FormField>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="事業内容文章（最終）"><Textarea rows={3} value={String(form.businessDescriptionFinal ?? "")} onChange={(e) => set("businessDescriptionFinal", e.target.value)} /></FormField>
              </div>
              <FormField label="業種コード"><Input value={String(form.industryCode ?? "")} onChange={(e) => set("industryCode", e.target.value)} /></FormField>
              <FormField label="事業所数"><Input type="number" value={String(form.officeCount ?? "")} onChange={(e) => set("officeCount", e.target.value)} /></FormField>
              <FormField label="正規雇用"><Input type="number" value={String(form.empRegular ?? "")} onChange={(e) => set("empRegular", e.target.value)} /></FormField>
              <FormField label="契約社員"><Input type="number" value={String(form.empContract ?? "")} onChange={(e) => set("empContract", e.target.value)} /></FormField>
              <FormField label="パートアルバイト"><Input type="number" value={String(form.empPartTime ?? "")} onChange={(e) => set("empPartTime", e.target.value)} /></FormField>
              <FormField label="派遣社員"><Input type="number" value={String(form.empDispatch ?? "")} onChange={(e) => set("empDispatch", e.target.value)} /></FormField>
              <FormField label="その他"><Input type="number" value={String(form.empOther ?? "")} onChange={(e) => set("empOther", e.target.value)} /></FormField>
              <FormField label="1段目"><Input value={String(form.wageTable1 ?? "")} onChange={(e) => set("wageTable1", e.target.value)} /></FormField>
              <FormField label="2段目"><Input value={String(form.wageTable2 ?? "")} onChange={(e) => set("wageTable2", e.target.value)} /></FormField>
              <FormField label="3段目"><Input value={String(form.wageTable3 ?? "")} onChange={(e) => set("wageTable3", e.target.value)} /></FormField>
            </FormGrid>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Post-Application Tab ----

const POST_APP_GUIDE = `■ 主な入力例:
・交付申請番号: KSN01-0000001
・担当者アドレス: example@gmail.com
・資料保管: GoogleドライブURL
・存在資料: 申請支援契約書, 請求明細書, 従業員一覧, 支払証憑, 口座情報, ソフトウェアキャプチャ, 利用規約
・おかわり判定: 概要案内シートより転記
・ベンダーパターン: 株式会社○○②
・ツールパターン: システムクラウド①`;

function PostApplicationTab({ data, vendorId, canEdit }: { data: PostAppRecord[]; vendorId?: number; canEdit: boolean }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }));

  const openNew = () => {
    setEditId(null);
    setForm({});
    setModalOpen(true);
  };

  const openEdit = async (id: number) => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const result = await getPostApplicationDetail(id, vendorId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setEditId(id);
      setForm(result.data);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      const result = editId
        ? await updatePostApplicationByVendor(editId, vendorId, form)
        : await addPostApplicationByVendor(vendorId, form);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setModalOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ReferenceGuide content={POST_APP_GUIDE} />
      {canEdit && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openNew} className="gap-1.5 shadow-sm bg-gradient-to-r from-[#10b981] to-[#86efac] hover:opacity-90 text-white"><Plus className="h-4 w-4" />新規追加</Button>
        </div>
      )}
      <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-[#10b981]/5 to-[#86efac]/5">
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">BPO</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">申請者名</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">交付申請番号</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">補助金ステータス</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">貸付</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold">完了日</TableHead>
              {canEdit && <TableHead className="text-[11px] uppercase tracking-wider text-[#10b981] font-semibold sticky right-0 z-30 bg-slate-50/80 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-slate-400 py-12">データがありません</TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.id} className="group/row hover:bg-slate-50/50 transition-colors">
                  <TableCell className="whitespace-nowrap">
                    {r.isBpo ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#d1fae5] text-[#10b981] ring-1 ring-[#a7f3d0]">BPO</span>
                    ) : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium text-slate-700">{r.applicantName || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.grantApplicationNumber || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.subsidyStatus || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.hasLoan ? "あり" : "なし"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-600">{r.completedDate || "-"}</TableCell>
                  {canEdit && (
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-slate-50/50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-700" onClick={() => openEdit(r.id)} disabled={loading}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "交付申請 編集" : "交付申請 新規追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 基本情報 */}
            <Card>
              <CardHeader className="py-3 bg-[#ecfdf5]/60"><CardTitle className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">基本情報</CardTitle></CardHeader>
              <CardContent>
                <FormGrid>
                  <FormField label="BPO">
                    <div className="flex items-center gap-2 h-9">
                      <Checkbox
                        checked={form.isBpo === true || form.isBpo === "true"}
                        onCheckedChange={(checked) => set("isBpo", checked === true)}
                      />
                      <span className="text-sm">BPO案件</span>
                    </div>
                  </FormField>
                  <FormField label="申請者名"><Input placeholder="例: 山田太郎" value={String(form.applicantName ?? "")} onChange={(e) => set("applicantName", e.target.value)} /></FormField>
                  <FormField label="紹介者"><Input value={String(form.referrer ?? "")} onChange={(e) => set("referrer", e.target.value)} /></FormField>
                  <FormField label="営業担当者"><Input value={String(form.salesStaff ?? "")} onChange={(e) => set("salesStaff", e.target.value)} /></FormField>
                  <FormField label="申請完了日"><DatePicker value={String(form.applicationCompletedDate ?? "")} onChange={(v) => set("applicationCompletedDate", v)} /></FormField>
                  <FormField label="申請担当者"><Input value={String(form.applicationStaff ?? "")} onChange={(e) => set("applicationStaff", e.target.value)} /></FormField>
                  <FormField label="交付申請番号"><Input placeholder="例: KSN01-0000001" value={String(form.grantApplicationNumber ?? "")} onChange={(e) => set("grantApplicationNumber", e.target.value)} /></FormField>
                  <FormField label="次のアクション"><Input value={String(form.nextAction ?? "")} onChange={(e) => set("nextAction", e.target.value)} /></FormField>
                  <FormField label="次の連絡日"><DatePicker value={String(form.nextContactDate ?? "")} onChange={(v) => set("nextContactDate", v)} /></FormField>
                  <FormField label="資料保管URL"><Input placeholder="例: GoogleドライブURL" value={String(form.documentStorageUrl ?? "")} onChange={(e) => set("documentStorageUrl", e.target.value)} /></FormField>
                  <FormField label="存在資料"><Input placeholder="例: 申請支援契約書, 請求明細書" value={String(form.existingDocuments ?? "")} onChange={(e) => set("existingDocuments", e.target.value)} /></FormField>
                  <FormField label="担当者アドレス"><Input placeholder="例: example@gmail.com" value={String(form.staffEmail ?? "")} onChange={(e) => set("staffEmail", e.target.value)} /></FormField>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <FormField label="メモ"><Textarea rows={3} value={String(form.memo ?? "")} onChange={(e) => set("memo", e.target.value)} /></FormField>
                  </div>
                </FormGrid>
              </CardContent>
            </Card>

            {/* 申請状況 */}
            <Card>
              <CardHeader className="py-3 bg-[#ecfdf5]/60"><CardTitle className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">申請状況</CardTitle></CardHeader>
              <CardContent>
                <FormGrid>
                  <FormField label="成長マッチングURL"><Input value={String(form.growthMatchingUrl ?? "")} onChange={(e) => set("growthMatchingUrl", e.target.value)} /></FormField>
                  <FormField label="成長マッチングステータス"><Input value={String(form.growthMatchingStatus ?? "")} onChange={(e) => set("growthMatchingStatus", e.target.value)} /></FormField>
                  <FormField label="賃上げ"><Input value={String(form.wageRaise ?? "")} onChange={(e) => set("wageRaise", e.target.value)} /></FormField>
                  <FormField label="省力化ナビ"><Input value={String(form.laborSavingNavi ?? "")} onChange={(e) => set("laborSavingNavi", e.target.value)} /></FormField>
                  <FormField label="インボイス登録"><Input value={String(form.invoiceRegistration ?? "")} onChange={(e) => set("invoiceRegistration", e.target.value)} /></FormField>
                  <FormField label="おかわり判定"><Input value={String(form.repeatJudgment ?? "")} onChange={(e) => set("repeatJudgment", e.target.value)} /></FormField>
                </FormGrid>
              </CardContent>
            </Card>

            {/* IT導入補助金 */}
            <Card>
              <CardHeader className="py-3 bg-[#ecfdf5]/60"><CardTitle className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">IT導入補助金</CardTitle></CardHeader>
              <CardContent>
                <FormGrid>
                  <FormField label="補助金申請者名"><Input value={String(form.subsidyApplicantName ?? "")} onChange={(e) => set("subsidyApplicantName", e.target.value)} /></FormField>
                  <FormField label="都道府県"><Input value={String(form.prefecture ?? "")} onChange={(e) => set("prefecture", e.target.value)} /></FormField>
                  <FormField label="募集回"><Input value={String(form.recruitmentRound ?? "")} onChange={(e) => set("recruitmentRound", e.target.value)} /></FormField>
                  <FormField label="申請類型"><Input value={String(form.applicationType ?? "")} onChange={(e) => set("applicationType", e.target.value)} /></FormField>
                  <FormField label="補助金ステータス"><Input value={String(form.subsidyStatus ?? "")} onChange={(e) => set("subsidyStatus", e.target.value)} /></FormField>
                  <FormField label="補助金ステータス更新日"><DatePicker value={String(form.subsidyStatusUpdated ?? "")} onChange={(v) => set("subsidyStatusUpdated", v)} /></FormField>
                  <FormField label="補助金ベンダー名"><Input value={String(form.subsidyVendorName ?? "")} onChange={(e) => set("subsidyVendorName", e.target.value)} /></FormField>
                  <FormField label="ITツール名"><Input value={String(form.itToolName ?? "")} onChange={(e) => set("itToolName", e.target.value)} /></FormField>
                  <FormField label="補助金対象金額"><Input type="number" value={String(form.subsidyTargetAmount ?? "")} onChange={(e) => set("subsidyTargetAmount", e.target.value)} /></FormField>
                  <FormField label="補助金申請金額"><Input type="number" value={String(form.subsidyAppliedAmount ?? "")} onChange={(e) => set("subsidyAppliedAmount", e.target.value)} /></FormField>
                  <FormField label="交付決定日"><DatePicker value={String(form.grantDecisionDate ?? "")} onChange={(v) => set("grantDecisionDate", v)} /></FormField>
                  <FormField label="交付決定金額"><Input type="number" value={String(form.grantDecisionAmount ?? "")} onChange={(e) => set("grantDecisionAmount", e.target.value)} /></FormField>
                  <FormField label="確定承認日"><DatePicker value={String(form.confirmationApprovalDate ?? "")} onChange={(v) => set("confirmationApprovalDate", v)} /></FormField>
                  <FormField label="補助金確定金額"><Input type="number" value={String(form.subsidyConfirmedAmount ?? "")} onChange={(e) => set("subsidyConfirmedAmount", e.target.value)} /></FormField>
                </FormGrid>
              </CardContent>
            </Card>

            {/* 貸付 */}
            <Card>
              <CardHeader className="py-3 bg-[#ecfdf5]/60"><CardTitle className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">貸付</CardTitle></CardHeader>
              <CardContent>
                <FormGrid>
                  <FormField label="貸付">
                    <div className="flex items-center gap-2 h-9">
                      <Checkbox
                        checked={form.hasLoan === true || form.hasLoan === "true"}
                        onCheckedChange={(checked) => set("hasLoan", checked === true)}
                      />
                      <span className="text-sm">貸付あり</span>
                    </div>
                  </FormField>
                  <FormField label="完了日"><DatePicker value={String(form.completedDate ?? "")} onChange={(v) => set("completedDate", v)} /></FormField>
                </FormGrid>
              </CardContent>
            </Card>

            {/* その他 */}
            <Card>
              <CardHeader className="py-3 bg-[#ecfdf5]/60"><CardTitle className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">その他</CardTitle></CardHeader>
              <CardContent>
                <FormGrid>
                  <FormField label="ベンダーパターン"><Input placeholder="例: 株式会社○○②" value={String(form.vendorPattern ?? "")} onChange={(e) => set("vendorPattern", e.target.value)} /></FormField>
                  <FormField label="ツールパターン"><Input placeholder="例: システムクラウド①" value={String(form.toolPattern ?? "")} onChange={(e) => set("toolPattern", e.target.value)} /></FormField>
                </FormGrid>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Main Component ----

export function VendorCustomersSection({
  preApplicationData,
  postApplicationData,
  vendorId,
  canEdit = false,
}: Props) {
  return (
    <Tabs defaultValue="pre">
      <TabsList>
        <TabsTrigger value="pre">~概要案内</TabsTrigger>
        <TabsTrigger value="post">交付申請~</TabsTrigger>
      </TabsList>

      <TabsContent value="pre">
        <PreApplicationTab data={preApplicationData} vendorId={vendorId} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="post">
        <PostApplicationTab data={postApplicationData} vendorId={vendorId} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
