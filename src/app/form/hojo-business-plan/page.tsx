"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  HojoFormLayout,
  HojoFormHeader,
  HojoFormSection,
  HojoFormComplete,
  HojoFormActions,
} from "@/components/hojo-external-portal";
import { Upload, X, FileText } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "textarea" | "radio" | "select" | "date" | "file";
  inputType?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  options?: string[];
  helpText?: string;
  validation?: { pattern: RegExp; message: string };
  accept?: string;
};

type SectionDef = {
  key: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  condition?: (a: Record<string, string>) => boolean;
};

type UploadedFile = {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

// ---------------------------------------------------------------------------
// セクション定義（PDF準拠 全45問）
// ---------------------------------------------------------------------------

const SECTIONS: SectionDef[] = [
  // ── 基本情報 (Q1-Q8) ──
  {
    key: "basic",
    title: "基本情報",
    fields: [
      {
        key: "tradeName",
        label: "①屋号",
        required: true,
        placeholder: "例）山田商店",
      },
      {
        key: "openingDate",
        label: "②開業年月日",
        required: true,
        placeholder: "例: 2019年1月7日",
        helpText: "例: 2019年1月7日",
      },
      {
        key: "fullName",
        label: "③氏名",
        required: true,
        placeholder: "回答を入力",
      },
      {
        key: "officeAddress",
        label: "④事業所の所在地（ご自宅を事業所としている場合はその住所をご記入ください）",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "phone",
        label: "⑤連絡先（電話番号）",
        required: true,
        placeholder: "回答を入力",
        inputType: "tel",
        inputMode: "tel",
      },
      {
        key: "email",
        label: "⑥連絡先（メールアドレス）",
        required: true,
        placeholder: "回答を入力",
        inputType: "email",
        inputMode: "email",
        validation: {
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: "正しいメールアドレスを入力してください",
        },
      },
      {
        key: "employeeCount",
        label: "⑦従業員数（ご自身を含めた人数）",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
      },
      {
        key: "homepageUrl",
        label: "⑧ホームページURL（ホームページがない場合は「なし」とご回答ください）",
        required: true,
        placeholder: "回答を入力",
      },
    ],
  },

  // ── 口座情報: 金融機関選択 (Q9) ──
  {
    key: "bank-select",
    title: "口座情報",
    fields: [
      {
        key: "bankType",
        label: "助成金を受ける際にご利用される金融機関をお選びください",
        required: true,
        type: "radio",
        options: ["ゆうちょ銀行", "他の金融機関"],
        helpText: "1つだけマークしてください。",
      },
    ],
  },

  // ── ゆうちょ銀行 (Q10-Q13) ──
  {
    key: "yucho",
    title: "ゆうちょ銀行",
    condition: (a) => a.bankType === "ゆうちょ銀行",
    fields: [
      {
        key: "yuchoSymbol",
        label: "①記号",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角5桁",
        validation: { pattern: /^\d{5}$/, message: "半角5桁の数字で入力してください" },
      },
      {
        key: "yuchoPassbookNumber",
        label: "②通帳番号",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角最大8桁",
        validation: { pattern: /^\d{1,8}$/, message: "半角8桁以内の数字で入力してください" },
      },
      {
        key: "yuchoAccountHolder",
        label: "③口座名義人",
        required: true,
        placeholder: "回答を入力",
      },
      {
        key: "yuchoAccountHolderKana",
        label: "④口座名義人（フリガナ）",
        required: true,
        placeholder: "回答を入力",
      },
    ],
  },

  // ── 他の金融機関 (Q14-Q21) ──
  {
    key: "other-bank",
    title: "他の金融機関",
    condition: (a) => a.bankType === "他の金融機関",
    fields: [
      {
        key: "otherBankName",
        label: "①金融機関名",
        required: true,
        placeholder: "回答を入力",
        helpText: "正式名称（〇〇銀行、△△信用金庫など）",
      },
      {
        key: "otherBankCode",
        label: "②金融機関コード",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角4桁（例：0005）",
        validation: { pattern: /^\d{4}$/, message: "半角4桁の数字で入力してください" },
      },
      {
        key: "otherBranchName",
        label: "③支店名",
        required: true,
        placeholder: "回答を入力",
        helpText: "正式名称（例：新宿支店）",
      },
      {
        key: "otherBranchCode",
        label: "④支店コード",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角3桁（例：123）",
        validation: { pattern: /^\d{3}$/, message: "半角3桁の数字で入力してください" },
      },
      {
        key: "otherAccountType",
        label: "⑤口座種別",
        required: true,
        type: "radio",
        options: ["普通（総合）", "当座"],
        helpText: "1つだけマークしてください。",
      },
      {
        key: "otherAccountNumber",
        label: "⑥口座番号",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角7桁",
        validation: { pattern: /^\d{7}$/, message: "半角7桁の数字で入力してください" },
      },
      {
        key: "otherAccountHolder",
        label: "⑦口座名義人",
        required: true,
        placeholder: "回答を入力",
      },
      {
        key: "otherAccountHolderKana",
        label: "⑧口座名義人（フリガナ）",
        required: true,
        placeholder: "回答を入力",
      },
    ],
  },

  // ── 口座情報: スクリーンショット添付 (Q22) ──
  {
    key: "bank-screenshot",
    title: "口座情報",
    description:
      "口座情報（助成金を受け取る際にご利用される口座のスクリーンショットの添付）",
    fields: [
      {
        key: "bankAccountScreenshot",
        label: "口座情報のスクリーンショット",
        required: true,
        type: "file",
        helpText:
          "◎通帳がある場合：通帳表紙と表紙裏面の写しを1つのファイルにしてご提出ください。\n◎通帳がない場合：ご入力いただいた内容が記載されたページのスクリーンショットを添付してください。",
        accept: "image/*,.pdf,.doc,.docx",
      },
    ],
  },

  // ── 事業概要 (Q23-Q27) ──
  {
    key: "business-overview",
    title: "事業概要",
    fields: [
      {
        key: "businessContent",
        label: "①事業内容（どのような事業をされていますか）",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "mainProductService",
        label: "②主力商品・サービスの内容",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "businessStrength",
        label: "③事業の特徴や強み（差別化ポイント）",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・どのような顧客獲得方法／ビジネスモデルを採用しているか\n・他社と比較した際の違い（差別化されているポイント）\n・強みがどのように成果（成約率・継続率・効率性など）につながっているか\n・単発ではなく、継続的な成長や関係性につながる仕組みがあるか",
      },
      {
        key: "openingBackground",
        label: "④開業の経緯や、この事業にかける想い",
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "businessScale",
        label: "⑤現状の事業規模（昨年度の売上高、おおよその月間売上、顧客数など）",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
      },
    ],
  },

  // ── 市場・競合情報 (Q28-Q31) ──
  {
    key: "market-competition",
    title: "市場・競合情報",
    fields: [
      {
        key: "targetMarket",
        label: "①ターゲットとしている市場やお客様について",
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "targetCustomerProfile",
        label: "②ターゲット顧客層（年齢、性別、地域、嗜好など）",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・ターゲット顧客の基本属性（年齢層・性別・地域・職業・企業規模など）\n・顧客の抱えている課題やニーズ、購買に至る背景（なぜ必要としているのか）\n・嗜好・行動特性（情報収集手段、意思決定の傾向、重視するポイントなど）\n・なぜ当該ターゲット層を設定しているのか（自社サービスとの適合性・優位性）",
      },
      {
        key: "competitors",
        label: "③競合する相手（お店やサービスなど）",
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "strengthsAndChallenges",
        label: "④ご自身の事業の強みと、今後の課題だと感じていること",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・自社の優位性（競合と比較した際の強み・選ばれている理由）\n・その優位性がどのように成果（売上・成約率・継続率など）につながっているか\n・現状認識している課題やボトルネック（人材・体制・集客・オペレーションなど）\n・課題に対する具体的な改善方針や今後の取り組み（成長に向けた戦略）",
      },
    ],
  },

  // ── 支援制度申請関連 (Q32-Q35) ──
  {
    key: "support-application",
    title: "支援制度申請関連",
    fields: [
      {
        key: "supportPurpose",
        label: "①支援制度の目的",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・本支援制度を活用する目的（何を実現したいのか）\n・自社の現状課題と、本制度の活用がどのように結びつくか",
      },
      {
        key: "supportGoal",
        label: "②支援制度を活用して実現したいこと",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・支援制度を活用して実施する具体的な取り組み内容（導入内容・施策など）\n・その取り組みによってどのような変化が生まれるか（業務・体制・サービスの改善点）\n・期待される成果（業務効率化、売上向上、生産性向上など）\n・実現後の事業への波及効果（競争力強化、顧客満足度向上、事業拡大など）",
      },
      {
        key: "investmentPlan",
        label: "③支援制度による投資・設備導入・採用など具体的計画",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・支援制度を活用して実施する具体的な投資内容（設備導入・システム導入・採用などの詳細）\n・導入・実施のスケジュールおよび進め方（いつ・何を・どのように行うか）\n・投資内容と自社課題・目的との関連性（なぜその投資が必要なのか）\n・実行体制および実現可能性（担当者、外部パートナー、過去実績など）",
      },
      {
        key: "expectedOutcome",
        label: "④期待される成果（売上を○%向上、新しい顧客層の獲得、作業効率の改善など）",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・売上増加の見込み（具体的な金額・成長率・その根拠）\n・業務効率化の効果（工数削減、対応件数増加、生産性向上など）\n・雇用や組織への影響（人員増加、人材の有効活用、役割分担の最適化など）\n・中長期的な事業への波及効果（競争力強化、顧客満足度向上、継続収益の拡大など）",
      },
    ],
  },

  // ── 事業体制とご経歴 (Q36-Q38) ──
  {
    key: "business-structure",
    title: "事業体制とご経歴",
    fields: [
      {
        key: "ownerCareer",
        label: "①事業主(あなた)のこれまでの経歴や、現在の事業に活かせるスキル・資格",
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "staffRoles",
        label: "②スタッフがいる場合、その方の役割",
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "futureHiring",
        label: "③今後、どのような人材が必要ですか（採用予定など）",
        type: "textarea",
        placeholder: "回答を入力",
      },
    ],
  },

  // ── 事業計画 (Q39-Q42) ──
  {
    key: "business-plan",
    title: "事業計画",
    fields: [
      {
        key: "shortTermGoal",
        label: "①短期（1年以内）の目標",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "midTermGoal",
        label: "②中期（3年）の目標",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "longTermGoal",
        label: "③長期（5年）の目標",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
      },
      {
        key: "salesStrategy",
        label: "④目標達成のための販売戦略やPR計画",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・ターゲット顧客に対する基本的な販売戦略（どの市場に、どのようにアプローチするか）\n・具体的な集客・マーケティング手法（紹介、広告、Web施策、営業手法など）\n・自社の強みや差別化ポイントをどのように訴求していくか\n・継続的な売上につなげる仕組み（リピート、アップセル、クロスセル、紹介など）",
      },
    ],
  },

  // ── 財務情報 (Q43-Q45) ──
  {
    key: "financial",
    title: "財務情報",
    fields: [
      {
        key: "pastBusinessRecord",
        label: "①過去の事業実績（売上・経費・所得などがわかるもの）",
        required: true,
        type: "file",
        helpText: "【確定申告書の控えなどで構いません。過去1〜3年分】",
        accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
      },
      {
        key: "futureInvestmentPlan",
        label: "②今後の投資計画と、必要な資金について",
        required: true,
        type: "textarea",
        placeholder: "回答を入力",
        helpText:
          "例）\n・今後予定している投資内容（設備・人材・システム・販促などの具体的な計画）\n・資金調達方法の内訳（自己資金、借入、補助金等）およびその妥当性\n・資金繰りおよび返済・回収の見通し（売上計画との整合性、無理のない計画か）",
      },
      {
        key: "debtInfo",
        label: "③借入状況・担保・保障情報",
        type: "textarea",
        placeholder: "回答を入力",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// ファイルアップロードフィールド
// ---------------------------------------------------------------------------

function FileUploadField({
  field,
  uploadedFile,
  onUpload,
  onRemove,
  error,
  errorMessage,
}: {
  field: FieldDef;
  uploadedFile?: UploadedFile;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
  error?: boolean;
  errorMessage?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setUploading(true);
      setUploadError(null);
      try {
        await onUpload(f);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onUpload],
  );

  return (
    <div className="space-y-1.5 py-4 border-b border-gray-100 last:border-b-0" data-field-key={field.key}>
      <Label className="text-sm font-medium text-gray-800">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {field.helpText && (
        <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{field.helpText}</p>
      )}

      {uploadedFile ? (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <FileText className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 truncate">{uploadedFile.fileName}</p>
            <p className="text-xs text-blue-600">
              {(uploadedFile.fileSize / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={field.accept}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed transition-colors text-sm
              ${uploading
                ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                : "border-gray-300 hover:border-[#2c5282] hover:bg-[#f7fafc] text-gray-600 cursor-pointer"
              }
              ${error ? "border-red-300 bg-red-50" : ""}
            `}
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                アップロード中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                ファイルを選択
              </>
            )}
          </button>
        </div>
      )}
      {(error || uploadError) && (
        <p className="text-xs text-red-500">{uploadError || errorMessage || "この項目は必須です"}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// テキストフィールドレンダラー
// ---------------------------------------------------------------------------

function FormField({
  field,
  value,
  onChange,
  error,
  errorMessage,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  errorMessage?: string;
}) {
  const errCls = error ? "border-red-400 focus-visible:ring-red-400" : "";

  return (
    <div className="space-y-1.5 py-4 border-b border-gray-100 last:border-b-0" data-field-key={field.key}>
      <Label className="text-sm font-medium text-gray-800">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {field.helpText && (
        <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{field.helpText}</p>
      )}

      {field.type === "radio" && field.options ? (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-col gap-2 pt-1">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2.5 cursor-pointer">
              <RadioGroupItem value={o} id={`${field.key}_${o}`} />
              <span className="text-sm text-gray-700">{o}</span>
            </label>
          ))}
        </RadioGroup>
      ) : field.type === "textarea" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`min-h-[100px] text-sm ${errCls}`}
        />
      ) : field.type === "date" ? (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`max-w-[200px] text-sm ${errCls}`}
        />
      ) : (
        <Input
          type={field.inputType || "text"}
          inputMode={field.inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`text-sm ${errCls}`}
        />
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
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile>>({});
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(key: string, val: string) {
    setAnswers((p) => ({ ...p, [key]: val }));
    setErrors((p) => {
      const n = new Map(p);
      n.delete(key);
      return n;
    });
  }

  async function handleFileUpload(fieldKey: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fieldKey", fieldKey);

    const res = await fetch("/api/public/hojo/form/business-plan/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "アップロードに失敗しました");
    }

    const data = await res.json();
    setUploadedFiles((p) => ({
      ...p,
      [fieldKey]: {
        filePath: data.filePath,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
      },
    }));
    setErrors((p) => {
      const n = new Map(p);
      n.delete(fieldKey);
      return n;
    });
  }

  function handleFileRemove(fieldKey: string) {
    setUploadedFiles((p) => {
      const n = { ...p };
      delete n[fieldKey];
      return n;
    });
  }

  function validate(): boolean {
    const errs = new Map<string, string>();
    for (const sec of SECTIONS) {
      if (sec.condition && !sec.condition(answers)) continue;
      for (const f of sec.fields) {
        if (f.type === "file") {
          if (f.required && !uploadedFiles[f.key]) {
            errs.set(f.key, "ファイルを添付してください");
          }
        } else {
          const v = answers[f.key]?.trim() ?? "";
          if (f.required && !v) errs.set(f.key, "この項目は必須です");
          else if (v && f.validation?.pattern && !f.validation.pattern.test(v))
            errs.set(f.key, f.validation.message);
        }
      }
    }
    setErrors(errs);
    if (errs.size > 0) {
      const k = errs.keys().next().value;
      if (k)
        document
          .querySelector(`[data-field-key="${k}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        body: JSON.stringify({
          uid,
          answers,
          fileUrls: uploadedFiles,
        }),
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
      <HojoFormComplete
        title="送信が完了しました"
        message="情報回収フォームの送信が完了しました。ご協力ありがとうございます。"
      />
    );
  }

  const visible = SECTIONS.filter((s) => !s.condition || s.condition(answers));

  return (
    <HojoFormLayout>
      <HojoFormHeader
        title="中小企業デジタル促進支援制度に伴う事業計画書作成のための情報回収フォーム"
        description="事業計画書を弊社で作成いたします。作成するにあたって基となる情報を下記にご記入ください。"
        requiredNote="* 必須の質問です"
      />

      {visible.map((section) => (
        <HojoFormSection
          key={section.key}
          title={section.title}
          description={section.description}
        >
          {section.fields.map((field) =>
            field.type === "file" ? (
              <FileUploadField
                key={field.key}
                field={field}
                uploadedFile={uploadedFiles[field.key]}
                onUpload={(f) => handleFileUpload(field.key, f)}
                onRemove={() => handleFileRemove(field.key)}
                error={errors.has(field.key)}
                errorMessage={errors.get(field.key)}
              />
            ) : (
              <FormField
                key={field.key}
                field={field}
                value={answers[field.key] || ""}
                onChange={(v) => handleChange(field.key, v)}
                error={errors.has(field.key)}
                errorMessage={errors.get(field.key)}
              />
            ),
          )}
        </HojoFormSection>
      ))}

      <HojoFormActions
        onSubmit={handleSubmit}
        onClear={() => {
          setAnswers({});
          setUploadedFiles({});
          setErrors(new Map());
        }}
        submitting={submitting}
      />
    </HojoFormLayout>
  );
}
