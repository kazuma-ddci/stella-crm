"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { updatePreApplicationDetail } from "../actions";

type Props = {
  data: Record<string, string | number | boolean>;
  canEdit: boolean;
  vendorOptions: { value: string; label: string }[];
};

export function PreApplicationDetail({ data, canEdit, vendorOptions }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>(data);
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreApplicationDetail(data.id as number, form);
      toast.success("保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (key: string, label: string, opts?: { type?: string; className?: string }) => (
    <div className={opts?.className}>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={opts?.type ?? "text"}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        disabled={!canEdit}
      />
    </div>
  );

  const renderTextarea = (key: string, label: string, rows = 3) => (
    <div className="col-span-full">
      <Label htmlFor={key}>{label}</Label>
      <Textarea
        id={key}
        rows={rows}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        disabled={!canEdit}
      />
    </div>
  );

  const renderDate = (key: string, label: string) => (
    <div>
      <Label>{label}</Label>
      <DatePicker
        value={String(form[key] ?? "")}
        onChange={(v) => set(key, v)}
        disabled={!canEdit}
      />
    </div>
  );

  const renderNumber = (key: string, label: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        disabled={!canEdit}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/hojo/grant-customers/pre-application"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          概要案内一覧に戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold">
        概要案内 詳細 - {String(form.applicantName || "(未設定)")}
      </h1>

      {/* 基本情報 */}
      <Card>
        <CardHeader><CardTitle>基本情報</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>ベンダー</Label>
            <Select
              value={String(form.vendorId ?? "")}
              onValueChange={(v) => set("vendorId", v)}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                {vendorOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {renderInput("applicantName", "申請者名")}
          {renderInput("referrer", "紹介者")}
          {renderInput("salesStaff", "営業担当")}
          {renderInput("category", "カテゴリ")}
          {renderInput("status", "ステータス")}
          {renderInput("prospectLevel", "見込度")}
          {renderInput("phone", "電話番号")}
          {renderInput("businessEntity", "事業形態")}
          {renderInput("industry", "業種")}
          <div className="flex items-center gap-2">
            <Checkbox
              id="isBpo"
              checked={form.isBpo === true}
              onCheckedChange={(v) => set("isBpo", v === true)}
              disabled={!canEdit}
            />
            <Label htmlFor="isBpo">BPO</Label>
          </div>
        </CardContent>
      </Card>

      {/* 対応状況 */}
      <Card>
        <CardHeader><CardTitle>対応状況</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderTextarea("detailMemo", "詳細メモ")}
          {renderTextarea("nextAction", "次のアクション")}
          {renderDate("nextContactDate", "次回連絡日")}
          {renderDate("overviewBriefingDate", "概要案内日")}
          {renderInput("mtgRecordingUrl", "MTG録画URL")}
          {renderInput("briefingStaff", "案内担当")}
        </CardContent>
      </Card>

      {/* 契約・報酬 */}
      <Card>
        <CardHeader><CardTitle>契約・報酬</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("systemType", "システム種別")}
          {renderInput("hasLoan", "貸付有無")}
          {renderInput("revenueRange", "売上規模")}
          {renderInput("importantTags", "重要タグ")}
          {renderInput("loanPattern", "貸付パターン")}
          {renderNumber("referrerRewardPct", "紹介者報酬率(%)")}
          {renderInput("agent1Number", "代理店①番号")}
          {renderNumber("agent1RewardPct", "代理店①報酬率(%)")}
          {renderNumber("totalReward", "合計報酬")}
          {renderInput("doubleChecker", "ダブルチェック担当")}
          {renderInput("repeatJudgment", "リピート判定")}
          {renderInput("wageRaiseEligible", "賃上げ対象")}
          {renderInput("pastProduct", "過去商材")}
          {renderDate("lostDate", "失注日")}
        </CardContent>
      </Card>

      {/* 提出書類 */}
      <Card>
        <CardHeader><CardTitle>提出書類</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("agentContractUrl", "代理店契約URL")}
          {renderDate("docCollectionStart", "書類収集開始日")}
          {renderDate("docSubmissionDate", "書類提出日")}
          {renderInput("businessName", "事業名")}
          {renderInput("doc1", "書類1")}
          {renderInput("doc2", "書類2")}
          {renderInput("doc3", "書類3")}
          {renderInput("doc4", "書類4")}
          {renderInput("doc5", "書類5")}
          {renderInput("itStrategyNaviPdf", "IT戦略ナビPDF")}
          {renderInput("hasEmployees", "従業員有無")}
          {renderInput("gbizidScreenshot", "gBizIDスクショ")}
          {renderInput("gbizidAddress", "gBizID住所")}
          {renderInput("selfDeclarationId", "自己宣言ID")}
          {renderInput("antiSocialCheck", "反社チェック")}
        </CardContent>
      </Card>

      {/* 企業財務 */}
      <Card>
        <CardHeader><CardTitle>企業財務</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderDate("establishmentDate", "設立日")}
          {renderInput("capital", "資本金")}
          {renderInput("fiscalMonth", "決算月")}
          {renderNumber("revenue", "売上")}
          {renderNumber("grossProfit", "粗利")}
          {renderNumber("operatingProfit", "営業利益")}
          {renderNumber("ordinaryProfit", "経常利益")}
          {renderNumber("depreciation", "減価償却費")}
          {renderNumber("laborCost", "人件費")}
          {renderInput("capitalOrReserve", "資本金又は出資金")}
          {renderNumber("executiveCompensation", "役員報酬")}
          {renderNumber("totalSalaryPrevYear", "前年度給与総額")}
          {renderInput("planYear1", "計画1年目")}
          {renderInput("planYear2", "計画2年目")}
          {renderInput("planYear3", "計画3年目")}
          {renderInput("bonus1Target", "加点①対象")}
          {renderInput("bonus1Doc", "加点①書類")}
          {renderInput("bonus2Target", "加点②対象")}
          {renderInput("bonus2Doc", "加点②書類")}
          {renderInput("minWage", "最低賃金")}
        </CardContent>
      </Card>

      {/* 申請文書 */}
      <Card>
        <CardHeader><CardTitle>申請文書</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("applicationSystem", "申請システム")}
          {renderTextarea("businessDescriptionDraft", "事業概要（下書き）", 4)}
          {renderTextarea("businessProcessNote", "業務プロセスメモ", 4)}
          {renderInput("homepageUrl", "ホームページURL")}
          {renderTextarea("businessDescription", "事業概要", 4)}
          {renderInput("challengeTitle", "課題タイトル")}
          {renderTextarea("challengeGoal", "課題目標", 4)}
          {renderTextarea("growthMatchingDescription", "成長マッチング記述", 4)}
          {renderInput("dataEntryStaff", "データ入力担当")}
          {renderInput("dataEntryConfirmed", "データ入力確認")}
          {renderTextarea("businessDescriptionFinal", "事業概要（確定版）", 4)}
        </CardContent>
      </Card>

      {/* 従業員・事業所 */}
      <Card>
        <CardHeader><CardTitle>従業員・事業所</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("industryCode", "業種コード")}
          {renderNumber("officeCount", "事業所数")}
          {renderNumber("empRegular", "正社員数")}
          {renderNumber("empContract", "契約社員数")}
          {renderNumber("empPartTime", "パート数")}
          {renderNumber("empDispatch", "派遣数")}
          {renderNumber("empOther", "その他従業員数")}
        </CardContent>
      </Card>

      {/* 賃金テーブル */}
      <Card>
        <CardHeader><CardTitle>賃金テーブル</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) =>
            renderInput(`wageTable${n}`, `賃金テーブル${n}`, { key: `wageTable${n}` } as never)
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      )}
    </div>
  );
}
