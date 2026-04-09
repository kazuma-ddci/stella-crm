"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "textarea" | "radio" | "select" | "date";
  inputType?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  options?: string[];
  helpText?: string;
  validation?: { pattern: RegExp; message: string };
};

type SectionDef = {
  key: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  condition?: (a: Record<string, string>) => boolean;
};

// ---------------------------------------------------------------------------
// セクション定義（スクリーンショット準拠）
// ---------------------------------------------------------------------------

const SECTIONS: SectionDef[] = [
  // ── セクション1: 基本情報 ──
  {
    key: "sec1",
    title: "基本情報",
    fields: [
      { key: "tradeName", label: "屋号", required: true, placeholder: "例) 山田商店" },
      { key: "industry", label: "業種", required: true, placeholder: "回答を入力" },
      { key: "mainPhone", label: "電話番号はメインの？", required: true, placeholder: "例）", inputType: "tel", inputMode: "tel" },
      { key: "contactPerson", label: "先方", required: true, placeholder: "回答を入力" },
      { key: "contactPerson2", label: "先方2", placeholder: "回答を入力" },
      {
        key: "businessDescription",
        label: "事業の内容（会社として事業や経営としている事柄の内容を具体的で記入ください）",
        required: true, type: "textarea", placeholder: "回答を入力",
      },
      { key: "maxMonthlySales", label: "最大月商", placeholder: "回答を入力" },
      { key: "industryCode", label: "業種コード・「類似業種」", required: true, placeholder: "回答を入力" },
      {
        key: "constructionLicense",
        label: "建設業：「建設業者」",
        required: true, type: "textarea", placeholder: "回答を入力",
      },
      { key: "employeeCount", label: "従業員数（※正社員のみ パート・アルバイト除く）", required: true, placeholder: "回答を入力", inputMode: "numeric" },
    ],
  },

  // ── 振込先選択 ──
  {
    key: "bank-select",
    title: "振込先アカウントの確認",
    description: "ゆうちょ口座の場合はセクション2で、その他の銀行の場合はセクション3で回答ください。",
    fields: [
      {
        key: "bankType", label: "振込先の口座", required: true, type: "radio",
        options: ["ゆうちょ銀行", "その他の銀行"],
      },
    ],
  },

  // ── セクション2: ゆうちょ銀行 ──
  {
    key: "sec2",
    title: "セクション2: ゆうちょ口座の場合は下記セクションで回答ください",
    condition: (a) => a.bankType === "ゆうちょ銀行",
    fields: [
      {
        key: "yuchoAccountType", label: "口座種別", required: true, type: "select",
        options: ["振替口座", "総合口座"],
      },
      {
        key: "yuchoHighValue",
        label: "高額な手数を要し主務大臣に係る金融機関を入力ください？",
        type: "radio", options: ["はい", "キャンセル対象外"],
      },
    ],
  },
  {
    key: "sec2-yucho-detail",
    title: "ゆうちょ銀行の場合は下記セクションで回答ください",
    condition: (a) => a.bankType === "ゆうちょ銀行",
    fields: [
      { key: "yuchoBank", label: "ゆうちょ銀行", placeholder: "回答を入力" },
      { key: "yuchoSymbol", label: "記号", required: true, placeholder: "回答を入力", inputMode: "numeric" },
      { key: "yuchoBranchNumber", label: "本店番号", placeholder: "回答を入力" },
      { key: "yuchoNumber", label: "番号", required: true, placeholder: "回答を入力", inputMode: "numeric" },
      { key: "yuchoHolderName", label: "口座名義人", required: true, placeholder: "回答を入力" },
      { key: "yuchoHolderNameKana", label: "口座名義人（カタカナ）", required: true, placeholder: "回答を入力" },
    ],
  },

  // ── セクション3: その他の銀行 ──
  {
    key: "sec3",
    title: "セクション3:（口座情報）ゆうちょ以外の口座をご利用の場合回答ください",
    condition: (a) => a.bankType === "その他の銀行",
    fields: [
      {
        key: "otherBankCode", label: "その金融機関コード",
        helpText: "半角4桁 例：0001",
        required: true, placeholder: "回答を入力", inputMode: "numeric",
        validation: { pattern: /^\d{4}$/, message: "4桁の数字で入力してください" },
      },
      {
        key: "otherBankName", label: "金融機関名",
        helpText: "正式名称（〇〇銀行、○○信用金庫等）",
        required: true, placeholder: "回答を入力",
      },
      {
        key: "otherBranchCode", label: "支店機関コード",
        helpText: "半角3桁 例：001",
        required: true, placeholder: "回答を入力", inputMode: "numeric",
        validation: { pattern: /^\d{3}$/, message: "3桁の数字で入力してください" },
      },
      {
        key: "otherBranchName", label: "支店名",
        helpText: "正式名称（例：新宿支店）",
        required: true, placeholder: "回答を入力",
      },
      {
        key: "otherDeliveryCode", label: "配送コード",
        helpText: "半角4桁",
        placeholder: "回答を入力", inputMode: "numeric",
      },
      {
        key: "otherDepositType", label: "口座種別", required: true, type: "radio",
        options: ["普通（税振）", "当座"],
      },
      {
        key: "otherAccountNumber", label: "口座番号",
        helpText: "半角7桁",
        required: true, placeholder: "回答を入力", inputMode: "numeric",
        validation: { pattern: /^\d{7}$/, message: "7桁の数字で入力してください" },
      },
      { key: "otherHolderName", label: "口座名義人", required: true, placeholder: "回答を入力" },
      { key: "otherHolderNameKana", label: "口座名義人（カタカナ）", required: true, placeholder: "回答を入力" },
    ],
  },

  // ── セクション4: 口座確認書類 ──
  {
    key: "sec4",
    title: "セクション4:（口座確認書類）口座情報を確認する書類をご準備のこと",
    fields: [
      { key: "accountDocDate", label: "口座情報", type: "date" },
      {
        key: "accountDocDesc",
        label: "口座開設（経過及び許可に関する確認書類）予約確認と名義の認証確認をファイル添付ください",
        type: "textarea", placeholder: "書類に関する備考を記入してください",
      },
      {
        key: "accountDocCredit",
        label: "口座情報（クレジット：入力された代表者名義の確認者のクレジットカードのカラーコピー）",
        type: "textarea", placeholder: "該当する場合は記入してください",
      },
    ],
  },

  // ── セクション5: 事業情報 ──
  {
    key: "sec5",
    title: "セクション5:（事業情報）ITツールの情報を書類を添付のこと",
    fields: [
      { key: "orderInfo", label: "発注情報", type: "date" },
      {
        key: "businessContent",
        label: "事業内容：どのような事業を行っていますか？",
        required: true, type: "textarea", placeholder: "回答を入力",
      },
      { key: "serviceName", label: "名称・サービス名の確認", required: true, placeholder: "回答を入力" },
      { key: "developmentTimeline", label: "開発の見通し（工事期間がある場合）", placeholder: "回答を入力" },
      {
        key: "previousYearOverview",
        label: "前年の事業概要（前年度の売上と、会社の大きな変更は、経緯含めて）",
        required: true, type: "textarea", placeholder: "回答を入力",
      },
    ],
  },

  // ── セクション6: ITツール情報 ──
  {
    key: "sec6",
    title: "セクション6: 事業関連情報の確認",
    fields: [
      { key: "itBudget", label: "予算・金額情報", required: true, placeholder: "回答を入力" },
      {
        key: "itCategory",
        label: "カテゴリフィルタとソフトウェアの情報を確認してください",
        required: true, type: "textarea", placeholder: "回答を入力",
      },
      {
        key: "itToolTarget",
        label: "ツール又は通信名（「大分類」「中分類」「小分類」「顧客管理」のうち入力）",
        required: true, type: "textarea",
        helpText: "ターゲット又はカテゴリに該当する導入するITツール名を入力してください",
        placeholder: "回答を入力",
      },
      {
        key: "itToolType",
        label: "ターゲット又はカテゴリ",
        required: true, type: "radio",
        options: [
          "通常枠（A類型）", "通常枠（B類型）",
          "インボイス枠（インボイス対応類型）", "インボイス枠（電子取引類型）",
          "セキュリティ対策推進枠", "複数社連携IT導入枠",
        ],
      },
      { key: "accountingSoftware", label: "類別で使用（会計ソフト等で向き）", placeholder: "回答を入力" },
      {
        key: "futureBusinessPlan",
        label: "2次年度の事業の目標、今後の課題と展開していますか？",
        required: true, type: "textarea",
        helpText: "お客様の課題に（部分に）して、「現在の損失」「部品のコスト」「顧客からの要望」「改善が必要」「品質のコスト」「効率のコスト」「売り上げのコスト」のいずれかに当てはまるか記入してください。",
        placeholder: "回答を入力",
      },
    ],
  },

  // ── セクション7: 事業実績・財務 ──
  {
    key: "sec7",
    title: "セクション7: 事業実績・財務の確認",
    fields: [
      { key: "financeDate", label: "主な顧客先の情報", type: "date" },
      {
        key: "businessEnvironment",
        label: "主な経営環境の変化",
        helpText: "主な経営環境の変化で会計に影響した内容を記入してください。",
        type: "textarea", placeholder: "回答を入力",
      },
      {
        key: "supplierInfo",
        label: "主な取引先情報を含め、予想した情報について",
        helpText: "勘定科目を含む（経理情報）、予測金額、支払い条件等の支払い情報を記入してください。",
        type: "textarea", placeholder: "回答を入力",
      },
      {
        key: "expenseInfo",
        label: "先端取引技術を含む全体：経費類、為替など会社別の情報",
        type: "textarea", placeholder: "回答を入力",
      },
      {
        key: "overseasInfo",
        label: "海外からの生産需要を受ける事業もある場合",
        type: "textarea", placeholder: "回答を入力",
      },
    ],
  },

  // ── セクション8: 事業概要情報 ──
  {
    key: "sec8",
    title: "セクション8: 事業概要情報",
    fields: [
      { key: "bizOverviewDate", label: "事業種別の情報", type: "date" },
      {
        key: "publicDisclosure",
        label: "事業記録において公表する必要がある情報、顧客に関連が出るスキル、項目",
        type: "textarea", placeholder: "回答を入力",
      },
      {
        key: "systemInfo",
        label: "メインシステム通信と、その他の状態",
        type: "textarea", placeholder: "回答を入力",
      },
      {
        key: "futureManagement",
        label: "今後、このシステムの管理で管理する？（顧客管理を含む？）",
        type: "textarea", placeholder: "回答を入力",
      },
    ],
  },

  // ── セクション9: 賃金等 ──
  {
    key: "sec9",
    title: "セクション9: 賃金等に関して",
    fields: [
      { key: "wageDate", label: "選択", type: "date" },
      { key: "wage", label: "賃金（今年分の、全の給与）", required: true, placeholder: "回答を入力" },
      { key: "procedureOther", label: "手順（以外）、対話？", placeholder: "回答を入力" },
      { key: "wageAdditional", label: "賃金（以外）追加？", placeholder: "回答を入力" },
      { key: "annualIncome", label: "年初金", placeholder: "回答を入力" },
      { key: "wageOtherAdditional", label: "手順（以外の）追加？", placeholder: "回答を入力" },
      { key: "wageYearEnd", label: "賃金（件末年次の確認）", placeholder: "回答を入力" },
      {
        key: "dataSubmissionNote",
        label: "企業選択大含む・必要な通知解除申を提起して",
        type: "textarea", placeholder: "回答を入力",
      },
    ],
  },

  // ── セクション10: メールアドレス ──
  {
    key: "sec10",
    title: "セクション10: 事業用メールアドレス等",
    fields: [
      {
        key: "businessEmail", label: "事業用メールアドレス",
        placeholder: "回答を入力", inputType: "email", inputMode: "email",
        validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "正しいメールアドレスを入力してください" },
      },
      {
        key: "recentBusinessPlan",
        label: "近々の事業実施（来年）・経営・予定もインデバイスかなど",
        type: "textarea", placeholder: "回答を入力",
      },
      {
        key: "futurePlan",
        label: "今後の事業について…事業計画のセット",
        type: "textarea", placeholder: "回答を入力",
      },
      { key: "personalAnnual", label: "個人の計・年初・実績関連", type: "textarea", placeholder: "回答を入力" },
    ],
  },
];

// ---------------------------------------------------------------------------
// フィールドレンダラー
// ---------------------------------------------------------------------------

function FormField({
  field, value, onChange, error, errorMessage,
}: {
  field: FieldDef; value: string; onChange: (v: string) => void; error?: boolean; errorMessage?: string;
}) {
  const errCls = error ? "border-red-500 focus-visible:ring-red-500" : "";
  return (
    <div className="space-y-1.5 py-3 border-b border-gray-100 last:border-b-0" data-field-key={field.key}>
      <Label className="text-sm font-medium text-gray-800">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {field.helpText && <p className="text-xs text-gray-500 leading-relaxed">{field.helpText}</p>}

      {field.type === "radio" && field.options ? (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-col gap-1.5 pt-1">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value={o} id={`${field.key}_${o}`} />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </RadioGroup>
      ) : field.type === "select" && field.options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={errCls}><SelectValue placeholder="選択" /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={`min-h-[72px] text-sm ${errCls}`} />
      ) : field.type === "date" ? (
        <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={`max-w-[200px] text-sm ${errCls}`} />
      ) : (
        <Input type={field.inputType || "text"} inputMode={field.inputMode} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={`text-sm ${errCls}`} />
      )}
      {error && <p className="text-xs text-red-500">{errorMessage || "この項目は必須です"}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function BusinessPlanFormPage() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") || "";

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(key: string, val: string) {
    setAnswers((p) => ({ ...p, [key]: val }));
    setErrors((p) => { const n = new Map(p); n.delete(key); return n; });
  }

  function validate(): boolean {
    const errs = new Map<string, string>();
    for (const sec of SECTIONS) {
      if (sec.condition && !sec.condition(answers)) continue;
      for (const f of sec.fields) {
        const v = answers[f.key]?.trim() ?? "";
        if (f.required && !v) errs.set(f.key, "この項目は必須です");
        else if (v && f.validation?.pattern && !f.validation.pattern.test(v)) errs.set(f.key, f.validation.message);
      }
    }
    setErrors(errs);
    if (errs.size > 0) {
      const k = errs.keys().next().value;
      if (k) document.querySelector(`[data-field-key="${k}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return errs.size === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/hojo/form/business-plan/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, answers }),
      });
      if (!res.ok) throw new Error("送信失敗");
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      alert("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-xl shadow border p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">送信が完了しました</h2>
          <p className="text-sm text-gray-600">情報回収フォームの送信が完了しました。ご協力ありがとうございます。</p>
        </div>
      </div>
    );
  }

  const visible = SECTIONS.filter((s) => !s.condition || s.condition(answers));

  return (
    <div className="min-h-screen bg-[#f0ebf8] py-6 px-4">
      <div className="max-w-[640px] mx-auto space-y-3">
        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow border-t-[10px] border-t-purple-700 overflow-hidden">
          <div className="px-6 py-5">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              中小企業デジタル化支援制度に伴う事業<br />計画書作成のための情報回収フォーム
            </h1>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              事業計画書を弊社で作成いたします。作成する上で必要な情報の入力をお願いいたします。下記に記載のない場合はお電話で別途確認させて頂きます。
            </p>
            <p className="text-sm text-red-600 mt-3">* 必須の質問です</p>
          </div>
        </div>

        {visible.map((section) => (
          <div key={section.key} className="bg-white rounded-xl shadow border-l-4 border-l-transparent overflow-hidden">
            {/* セクションヘッダー（紫帯） */}
            <div className="bg-purple-700 px-5 py-2.5">
              <h2 className="text-white font-semibold text-sm">{section.title}</h2>
            </div>
            {section.description && (
              <p className="text-xs text-gray-500 px-6 pt-3">{section.description}</p>
            )}
            <div className="px-6 pb-4">
              {section.fields.map((field) => (
                <FormField
                  key={field.key} field={field} value={answers[field.key] || ""}
                  onChange={(v) => handleChange(field.key, v)}
                  error={errors.has(field.key)} errorMessage={errors.get(field.key)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 送信ボタン */}
        <div className="flex justify-between items-center pt-2 pb-8">
          <Button onClick={handleSubmit} disabled={submitting}
            className="bg-purple-700 hover:bg-purple-800 text-white px-8 rounded">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />送信中</> : "送信"}
          </Button>
          <button type="button" className="text-sm text-purple-700 hover:underline"
            onClick={() => { setAnswers({}); setErrors(new Map()); }}>
            フォームをクリア
          </button>
        </div>
      </div>
    </div>
  );
}
