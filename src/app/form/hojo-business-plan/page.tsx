"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "textarea" | "radio";
  inputType?: "email" | "tel" | "number" | "text";
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
  condition?: (answers: Record<string, string>) => boolean;
};

// ---------------------------------------------------------------------------
// セクション定義
// ---------------------------------------------------------------------------

const SECTIONS: SectionDef[] = [
  // ── セクション1: 基本情報 ──
  {
    key: "sec1",
    title: "基本情報",
    fields: [
      { key: "tradeName", label: "屋号", required: true, placeholder: "例) 山田商店" },
      { key: "industry", label: "業種", required: true, placeholder: "例) 飲食業" },
      { key: "mainPhone", label: "電話番号（メイン）", required: true, placeholder: "例) 09012345678", inputType: "tel", inputMode: "tel" },
      { key: "contactPerson", label: "先方", required: true, placeholder: "例) 山田 太郎" },
      { key: "contactPerson2", label: "先方2", placeholder: "例) 佐藤 花子" },
      {
        key: "businessDescription", label: "事業の内容（会社として事業や経営としている事柄の内容を具体的に記入ください）",
        required: true, type: "textarea", placeholder: "事業内容を具体的に記入してください",
      },
      { key: "maxMonthlySales", label: "最大月商", placeholder: "例) 500万円" },
      { key: "industryCode", label: "業種コード・「類似業種」", required: true, placeholder: "例) I-5011" },
      {
        key: "constructionLicense", label: "建設業「建設業の許可を取得していますか？」",
        required: true, type: "radio", options: ["はい", "いいえ", "該当しない"],
      },
      { key: "employeeCount", label: "従業員数（※正社員のみ パート・アルバイト除く）", required: true, placeholder: "例) 5", inputMode: "numeric" },
    ],
  },

  // ── 振込先の選択 ──
  {
    key: "bank-select",
    title: "振込先アカウントの確認",
    description: "ゆうちょ口座の場合はセクション2、その他の銀行の場合はセクション3で回答ください。",
    fields: [
      { key: "bankType", label: "振込先の口座", required: true, type: "radio", options: ["ゆうちょ銀行", "その他の銀行"] },
    ],
  },

  // ── セクション2: ゆうちょ銀行 ──
  {
    key: "sec2-yucho",
    title: "セクション2: 振込先のアカウント情報（ゆうちょ銀行の場合）",
    description: "ゆうちょ口座の場合は下記セクションで回答ください。",
    condition: (a) => a.bankType === "ゆうちょ銀行",
    fields: [
      { key: "yuchoAccountType", label: "口座種別", required: true, type: "radio", options: ["振替口座", "総合口座"] },
      {
        key: "yuchoHighValue", label: "高額な手数を要する主務大臣に係る金融機関を入力ください？",
        type: "radio", options: ["はい", "キャンセル対象外"],
      },
      { key: "yuchoSymbol", label: "記号", required: true, placeholder: "例) 12345", inputMode: "numeric" },
      { key: "yuchoBranchNumber", label: "本店番号", placeholder: "例) 123" },
      { key: "yuchoNumber", label: "番号", required: true, placeholder: "例) 12345678", inputMode: "numeric" },
      { key: "yuchoHolderName", label: "口座名義人", required: true, placeholder: "例) 山田 太郎" },
      { key: "yuchoHolderNameKana", label: "口座名義人（カタカナ）", required: true, placeholder: "例) ヤマダ タロウ" },
    ],
  },

  // ── セクション3: その他の銀行 ──
  {
    key: "sec3-other-bank",
    title: "セクション3: 振込先のアカウント情報（ゆうちょ以外の場合）",
    description: "ゆうちょ以外の銀行をご利用の場合回答ください。",
    condition: (a) => a.bankType === "その他の銀行",
    fields: [
      {
        key: "bankCode", label: "金融機関コード", required: true, placeholder: "半角4桁 例) 0001", inputMode: "numeric",
        validation: { pattern: /^\d{4}$/, message: "4桁の数字で入力してください" },
      },
      { key: "bankName", label: "金融機関名", required: true, placeholder: "正式名称（〇〇銀行、○○信用金庫など）" },
      {
        key: "branchCode", label: "支店コード", required: true, placeholder: "半角3桁 例) 001", inputMode: "numeric",
        validation: { pattern: /^\d{3}$/, message: "3桁の数字で入力してください" },
      },
      { key: "branchName", label: "支店名", required: true, placeholder: "例) 新宿支店" },
      {
        key: "deliveryCode", label: "配送コード", placeholder: "半角4桁 例) 1209", inputMode: "numeric",
      },
      { key: "depositType", label: "預金種別", required: true, type: "radio", options: ["普通（税振）", "当座"] },
      {
        key: "accountNumber", label: "口座番号", required: true, placeholder: "半角7桁", inputMode: "numeric",
        validation: { pattern: /^\d{7}$/, message: "7桁の数字で入力してください" },
      },
      { key: "accountHolderName", label: "口座名義人", required: true, placeholder: "例) 山田 太郎" },
      { key: "accountHolderNameKana", label: "口座名義人（カタカナ）", required: true, placeholder: "例) ヤマダ タロウ" },
    ],
  },

  // ── セクション4: 口座確認書類 ──
  {
    key: "sec4-account-doc",
    title: "セクション4: 口座確認書類",
    description: "口座情報を確認する書類に関する情報を入力してください。口座開設確認書の写し、予備書を含む確認書類を事務局にてファイル添付ください。",
    fields: [
      {
        key: "accountDocType", label: "口座確認書類", required: true, type: "radio",
        options: ["通帳の写し（表紙と通帳を開いた1・2ページ目）", "キャッシュカードの写し", "ネットバンキングの画面キャプチャ", "その他"],
      },
      {
        key: "accountDocCreditCard", label: "口座情報（クレジット：入力された代表者名義のクレジットカードでもよい）",
        type: "textarea", placeholder: "該当する場合は記入してください",
      },
    ],
  },

  // ── セクション5: 事業情報 ──
  {
    key: "sec5-business",
    title: "セクション5: 事業情報",
    description: "ITツール等の情報を入力のこと。",
    fields: [
      { key: "orderDate", label: "発注情報", placeholder: "例) 2026/04/01" },
      { key: "businessContent", label: "事業内容：どのような事業を展開していますか？", required: true, type: "textarea", placeholder: "事業内容を記入してください" },
      { key: "serviceName", label: "名称・サービス名確認", required: true, placeholder: "例) ○○クラウド" },
      {
        key: "businessOverview", label: "事業の計画実績は？（見込みの入力）", type: "textarea",
        placeholder: "事業計画の概要を記入してください",
      },
      {
        key: "developmentTimeline", label: "開発の見通し（工事期間がある場合）", placeholder: "例) 3ヶ月",
      },
      {
        key: "previousYearOverview", label: "前年の事業概要（前年度の売上と、会社の大きな変更は、経緯含めて）",
        required: true, type: "textarea", placeholder: "前年度の事業概要を記入してください",
      },
    ],
  },

  // ── セクション6: ITツール情報 ──
  {
    key: "sec6-it",
    title: "セクション6: ITツール情報",
    description: "導入予定のITツールに関する情報を入力してください。",
    fields: [
      { key: "itBudget", label: "予算・金額情報", required: true, placeholder: "例) 100万円" },
      {
        key: "itCategory", label: "カテゴリ（ソフトウェアのカテゴリ1と2を選ぶもの、重複してもOK）",
        required: true, type: "textarea",
        helpText: "大分類・中分類・小分類を記入（顧客管理、会計、勤怠、受発注、決済、施工管理、建設業許認可 等）",
        placeholder: "例) 大分類: 汎用ソフトウェア / 小分類: 顧客管理",
      },
      { key: "itToolName", label: "ツール名称・サービス名の確認", required: true, placeholder: "例) セキュリティクラウド" },
      {
        key: "itToolCategory", label: "ターゲット又はカテゴリに該当する導入するITツール名",
        required: true, type: "radio",
        options: [
          "通常枠（A類型）", "通常枠（B類型）",
          "インボイス枠（インボイス対応類型）", "インボイス枠（電子取引類型）",
          "セキュリティ対策推進枠", "複数社連携IT導入枠",
        ],
      },
      { key: "accountingSoftware", label: "類別で使用（会計ソフト等で向き）", placeholder: "例) freee、マネーフォワード等" },
      {
        key: "futureBusinessPlan", label: "2次年度の事業の目標、今後の課題と展開していますか？",
        required: true, type: "textarea",
        helpText: "お客様の課題に対して、「現在の損失」「部品コスト」「顧客からの要望」「改善が必要な品質」「効率のコスト」「売り上げ」のいずれかに当てはまるか記入してください。",
        placeholder: "今後の事業計画や課題について記入してください",
      },
    ],
  },

  // ── セクション7: 事業実績・財務 ──
  {
    key: "sec7-finance",
    title: "セクション7: 事業実績・財務の確認",
    description: "下記項目は必ず事業実績のもとに記入してください。",
    fields: [
      { key: "mainClientInfo", label: "主な顧客先の情報", required: true, type: "textarea", placeholder: "主要な取引先名を記入" },
      {
        key: "businessEnvironment", label: "主な経営環境の変化",
        type: "textarea", placeholder: "主な経営環境の変化で事業に影響した内容を記入してください",
      },
      {
        key: "supplierInfo", label: "主な取引先情報を含む予想した情報について",
        type: "textarea",
        helpText: "勘定科目を含む（経理情報）、予測金額、支払条件等の情報",
        placeholder: "主な仕入先・外注先の情報を記入してください",
      },
      {
        key: "expenseInfo", label: "先端取引技術を含む全体：経費類、為替など会社別の情報",
        type: "textarea", placeholder: "直近の決算情報や経費の概要を記入してください",
      },
      {
        key: "overseasInfo", label: "海外からの生産需要があれば記入ください",
        type: "textarea", placeholder: "海外との取引がある場合は記入してください",
      },
    ],
  },

  // ── セクション8: 事業概要(その他) ──
  {
    key: "sec8-overview",
    title: "セクション8: 事業概要情報",
    description: "下記内容を含む事業概要情報を記入してください。",
    fields: [
      { key: "businessCategory", label: "事業種別の情報", placeholder: "例) 金属加工" },
      {
        key: "publicDisclosure", label: "事業記録において公表する必要がある情報、顧客に関連が出る項目",
        type: "textarea", placeholder: "該当する場合は記入してください",
      },
      { key: "systemInfo", label: "メインシステム通信と、その状態", type: "textarea", placeholder: "現在使用しているシステム情報" },
      {
        key: "futureManagement", label: "今後、このシステムの管理をどうする予定ですか？（顧客管理を含む）",
        type: "textarea", placeholder: "今後のシステム管理計画を記入してください",
      },
    ],
  },

  // ── セクション9: 賃金等 ──
  {
    key: "sec9-wage",
    title: "セクション9: 賃金等に関して",
    description: "下記項目は必ず賃金情報をもとに記入してください。",
    fields: [
      { key: "minWage", label: "事業場内最低賃金", required: true, placeholder: "例) 1050円", inputMode: "numeric" },
      {
        key: "wageIncreasePlan", label: "賃上げの計画について", required: true, type: "radio",
        options: ["1年で+30円以上の賃上げ予定あり", "1年で+45円以上の賃上げ予定あり", "賃上げ予定なし"],
      },
      { key: "salary", label: "報酬（月額）", placeholder: "例) 250,000円" },
      { key: "salaryOther", label: "報酬（月額以外の手当）", placeholder: "例) 通勤手当" },
      { key: "annualIncome", label: "年初金", placeholder: "例) 3,000,000円" },
      { key: "salaryAdditional", label: "賃金（件末年次の確認）", placeholder: "確認がある場合記入" },
    ],
  },

  // ── セクション10: メールアドレス ──
  {
    key: "sec10-email",
    title: "セクション10: 事業用メールアドレス等",
    fields: [
      {
        key: "businessEmail", label: "事業用メールアドレス", placeholder: "例) info@example.co.jp",
        inputType: "email", inputMode: "email",
        validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "正しいメールアドレスを入力してください" },
      },
      {
        key: "recentBusinessPlan", label: "近々の事業実施（来年）・経営・予定について",
        type: "textarea", placeholder: "今後の事業計画があれば記入してください",
      },
      {
        key: "personalNotes", label: "個人情報・年初・実績関連", type: "textarea",
        placeholder: "その他連絡事項があれば記入してください",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// フィールドレンダラー
// ---------------------------------------------------------------------------

function FormFieldRenderer({
  field, value, onChange, error, errorMessage,
}: {
  field: FieldDef; value: string; onChange: (v: string) => void; error?: boolean; errorMessage?: string;
}) {
  const cls = error ? "border-red-500 focus-visible:ring-red-500" : "";
  return (
    <div className="space-y-2" data-field-key={field.key}>
      <Label className="text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.helpText && <p className="text-xs text-gray-500">{field.helpText}</p>}

      {field.type === "radio" && field.options ? (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-col gap-2 pt-1">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`${field.key}_${opt}`} />
              <Label htmlFor={`${field.key}_${opt}`} className="font-normal cursor-pointer text-sm">{opt}</Label>
            </div>
          ))}
        </RadioGroup>
      ) : field.type === "textarea" ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={`min-h-[80px] ${cls}`} />
      ) : (
        <Input type={field.inputType || "text"} inputMode={field.inputMode} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />
      )}
      {error && <p className="text-xs text-red-500 mt-1">{errorMessage || "この項目は必須です"}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインページ
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-lg shadow-md border p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">送信が完了しました</h2>
          <p className="text-sm text-gray-600">情報回収フォームの送信が完了しました。ご協力ありがとうございます。</p>
        </div>
      </div>
    );
  }

  const visible = SECTIONS.filter((s) => !s.condition || s.condition(answers));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md border overflow-hidden">
          <div className="h-2 bg-purple-600" />
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900">
              中小企業デジタル化支援制度に伴う事業計画書作成のための情報回収フォーム
            </h1>
            <p className="text-sm text-gray-600 mt-3">
              事業計画書を弊社で作成いたします。作成する上で必要な情報の入力をお願いいたします。
              下記に記載のない場合はお電話にて別途確認させて頂きます。
            </p>
            <p className="text-xs text-red-500 mt-2">* 必須の質問です</p>
          </div>
        </div>

        {visible.map((section) => (
          <div key={section.key} className="bg-white rounded-lg shadow-md border overflow-hidden">
            <div className="bg-purple-50 border-b border-purple-100 px-6 py-3">
              <h2 className="font-semibold text-purple-900 text-sm">{section.title}</h2>
            </div>
            {section.description && (
              <div className="px-6 pt-3">
                <p className="text-xs text-gray-500">{section.description}</p>
              </div>
            )}
            <div className="px-6 py-5 space-y-5">
              {section.fields.map((field) => (
                <FormFieldRenderer
                  key={field.key} field={field} value={answers[field.key] || ""}
                  onChange={(v) => handleChange(field.key, v)}
                  error={errors.has(field.key)} errorMessage={errors.get(field.key)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-lg shadow-md border p-6">
          <Button onClick={handleSubmit} disabled={submitting}
            className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
            {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />送信中...</> : "送信"}
          </Button>
        </div>
      </div>
    </div>
  );
}
