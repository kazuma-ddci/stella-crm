"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { updatePostApplicationDetail } from "../actions";

type Props = {
  data: Record<string, string | number | boolean>;
  canEdit: boolean;
  vendorOptions: { value: string; label: string }[];
};

// BPOレコードの場合のみスタッフが編集可能なフィールド（Excelの「ここ」マーク12項目）
const BPO_FIELDS = new Set([
  "memo", "applicationCompletedDate", "applicationStaff",
  "grantApplicationNumber", "nextAction", "nextContactDate",
  "staffEmail", "growthMatchingUrl", "growthMatchingStatus",
  "wageRaise", "laborSavingNavi", "invoiceRegistration",
]);

const BpoTag = () => (
  <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">BPO</span>
);

export function PostApplicationDetail({ data, canEdit, vendorOptions }: Props) {
  const [form, setForm] = useState<Record<string, unknown>>(data);
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updatePostApplicationDetail(data.id as number, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("保存しました");
    } finally {
      setSaving(false);
    }
  };

  // BPOフィールドはisBpo=trueの場合のみ編集可能
  const isFieldEditable = (key: string) =>
    canEdit && (!BPO_FIELDS.has(key) || form.isBpo === true);

  const renderInput = (key: string, label: string, placeholder?: string) => (
    <div>
      <Label htmlFor={key}>{label}{BPO_FIELDS.has(key) && <BpoTag />}</Label>
      <Input
        id={key}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        disabled={!isFieldEditable(key)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderTextarea = (key: string, label: string, rows = 3) => (
    <div className="col-span-full">
      <Label htmlFor={key}>{label}{BPO_FIELDS.has(key) && <BpoTag />}</Label>
      <Textarea
        id={key}
        rows={rows}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        disabled={!isFieldEditable(key)}
      />
    </div>
  );

  const renderDate = (key: string, label: string) => (
    <div>
      <Label>{label}{BPO_FIELDS.has(key) && <BpoTag />}</Label>
      <DatePicker
        value={String(form[key] ?? "")}
        onChange={(v) => set(key, v)}
        disabled={!isFieldEditable(key)}
      />
    </div>
  );

  const renderNumber = (key: string, label: string) => (
    <div>
      <Label htmlFor={key}>{label}{BPO_FIELDS.has(key) && <BpoTag />}</Label>
      <Input
        id={key}
        type="number"
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        disabled={!isFieldEditable(key)}
      />
    </div>
  );

  // Timeline step for process management
  const renderProcessStep = (dateKey: string, completedKey: string, label: string) => {
    const isCompleted = String(form[completedKey] ?? "") !== "" && String(form[completedKey] ?? "") !== "false";
    return (
      <div className="flex items-start gap-3 p-3 border rounded-lg">
        <div className="pt-1">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-gray-300" />
          )}
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>{label} 日</Label>
            <DatePicker
              value={String(form[dateKey] ?? "")}
              onChange={(v) => set(dateKey, v)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label>{label} 完了</Label>
            <Input
              value={String(form[completedKey] ?? "")}
              onChange={(e) => set(completedKey, e.target.value)}
              placeholder="完了時に入力"
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>
    );
  };

  // Reward block for agent
  const renderRewardBlock = (
    prefix: string,
    label: string
  ) => (
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-medium text-sm">{label}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {renderInput(`${prefix}Number`, "番号")}
        {renderInput(`${prefix}LineName`, "LINE名")}
        {renderNumber(`${prefix}Pct`, "報酬率(%)")}
        {renderNumber(`${prefix}Amount`, "報酬額")}
        {renderDate(`${prefix}PaymentDate`, "支払日")}
        {renderInput(`${prefix}PaymentCompleted`, "支払完了")}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/hojo/grant-customers/post-application"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          交付申請一覧に戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold">
        交付申請 詳細 - {String(form.applicantName || "(未設定)")}
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
          {renderInput("applicantName", "申請者名", "例: 山田太郎")}
          {renderInput("referrer", "紹介者", "例: 鈴木一郎")}
          {renderInput("salesStaff", "営業担当", "例: 佐藤花子")}
          {renderDate("applicationCompletedDate", "申請完了日")}
          {renderInput("applicationStaff", "申請担当")}
          {renderInput("grantApplicationNumber", "交付申請番号", "例: KSN01-0000001")}
          {renderDate("nextContactDate", "次回連絡日")}
          {renderInput("documentStorageUrl", "書類保管URL")}
          {renderInput("staffEmail", "担当メール", "例: staff@example.com")}
          <div className="flex items-center gap-2">
            <Checkbox
              id="isBpo"
              checked={form.isBpo === true}
              onCheckedChange={(v) => set("isBpo", v === true)}
              disabled={!canEdit}
            />
            <Label htmlFor="isBpo">BPO</Label>
          </div>
          {renderTextarea("memo", "メモ")}
          {renderTextarea("nextAction", "次のアクション")}
          {renderTextarea("existingDocuments", "既存書類")}
        </CardContent>
      </Card>

      {/* 申請状況チェック */}
      <Card>
        <CardHeader><CardTitle>申請状況チェック</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("growthMatchingUrl", "成長マッチングURL")}
          {renderInput("growthMatchingStatus", "成長マッチング状況")}
          {renderInput("wageRaise", "賃上げ")}
          {renderInput("laborSavingNavi", "省力化ナビ")}
          {renderInput("invoiceRegistration", "インボイス登録")}
          {renderInput("repeatJudgment", "リピート判定")}
        </CardContent>
      </Card>

      {/* IT導入補助金データ */}
      <Card>
        <CardHeader><CardTitle>IT導入補助金データ</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("subsidyApplicantName", "補助金申請者名", "例: 株式会社サンプル")}
          {renderInput("prefecture", "都道府県", "例: 東京都")}
          {renderInput("recruitmentRound", "募集回", "例: 第1回")}
          {renderInput("applicationType", "申請種別", "例: インボイス枠")}
          {renderInput("subsidyStatus", "補助金ステータス")}
          {renderDate("subsidyStatusUpdated", "ステータス更新日")}
          {renderInput("subsidyVendorName", "補助金ベンダー名")}
          {renderInput("itToolName", "ITツール名", "例: セキュリティクラウド")}
          {renderNumber("subsidyTargetAmount", "補助金対象額")}
          {renderNumber("subsidyAppliedAmount", "補助金申請額")}
          {renderDate("grantDecisionDate", "交付決定日")}
          {renderNumber("grantDecisionAmount", "交付決定額")}
          {renderDate("confirmationApprovalDate", "確定承認日")}
          {renderNumber("subsidyConfirmedAmount", "補助金確定額")}
        </CardContent>
      </Card>

      {/* プロセス管理 */}
      <Card>
        <CardHeader><CardTitle>プロセス管理</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {renderProcessStep("deliveryDate", "deliveryCompleted", "納品")}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-3 border rounded-lg">
            {renderInput("employeeListUrl", "従業員名簿URL")}
            {renderInput("employeeListFormUrl", "従業員名簿フォームURL")}
            {renderInput("employeeListCreated", "従業員名簿作成")}
          </div>
          {renderProcessStep("performanceReportDate", "performanceReportCompleted", "実績報告")}
          {renderProcessStep("confirmationDate", "confirmationCompleted", "確認")}
          {renderProcessStep("grantDate", "grantCompleted", "交付")}
          {renderProcessStep("refundDate", "refundCompleted", "返金")}
          {renderProcessStep("subsidyPaymentDate", "subsidyPaymentCompleted", "補助金支払")}
          <div className="p-3 border rounded-lg">
            {renderDate("completedDate", "完了日")}
          </div>
        </CardContent>
      </Card>

      {/* 貸付管理 */}
      <Card>
        <CardHeader><CardTitle>貸付管理</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("loanSurveyResponse", "貸付アンケート回答")}
          <div className="flex items-center gap-2">
            <Checkbox
              id="hasLoan"
              checked={form.hasLoan === true}
              onCheckedChange={(v) => set("hasLoan", v === true)}
              disabled={!canEdit}
            />
            <Label htmlFor="hasLoan">貸付あり</Label>
          </div>
          {renderDate("loanMtgDate", "貸付MTG日")}
          {renderInput("loanMtgCompleted", "貸付MTG完了")}
          {renderInput("loanMtgStaff", "貸付MTG担当")}
          {renderInput("loanLocation", "貸付場所")}
          {renderNumber("loanAmount", "貸付額")}
          {renderInput("loanCash", "現金")}
          {renderInput("loanDoubleChecker", "ダブルチェック")}
          {renderDate("loanPaymentDate", "貸付支払日")}
          {renderInput("loanTime", "貸付時間")}
          {renderInput("loanPaymentCompleted", "貸付支払完了")}
        </CardContent>
      </Card>

      {/* 報酬管理 */}
      <Card>
        <CardHeader><CardTitle>報酬管理</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {renderRewardBlock("referrer", "紹介者")}
          {renderRewardBlock("agent1", "代理店 1")}
          {renderRewardBlock("agent2", "代理店 2")}
          {renderRewardBlock("agent3", "代理店 3")}
        </CardContent>
      </Card>

      {/* その他 */}
      <Card>
        <CardHeader><CardTitle>その他</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderInput("vendorPattern", "ベンダーパターン", "例: パターンA")}
          {renderInput("toolPattern", "ツールパターン", "例: パターンB")}
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <div key={`wageTable${n}`}>
              <Label htmlFor={`wageTable${n}`}>賃金テーブル{n}</Label>
              <Input
                id={`wageTable${n}`}
                value={String(form[`wageTable${n}`] ?? "")}
                onChange={(e) => set(`wageTable${n}`, e.target.value)}
                disabled={!canEdit}
              />
            </div>
          ))}
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
