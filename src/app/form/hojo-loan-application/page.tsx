"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Loader2, Plus, Trash2 } from "lucide-react";
import Image from "next/image";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormType = "corporate" | "individual";

type ValidationRule = {
  pattern?: RegExp;
  message: string;
  maxLength?: number;
  minLength?: number;
};

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "radio" | "select" | "date";
  inputType?: "email" | "tel" | "number" | "text"; // HTML input type
  inputMode?: "numeric" | "tel" | "email" | "text"; // モバイルキーボード制御
  options?: string[];
  helpText?: string;
  validation?: ValidationRule;
};

type SectionDef = {
  title: string;
  description?: string;
  fields: FieldDef[];
};

// ---------------------------------------------------------------------------
// 個人事業主フォーム定義
// ---------------------------------------------------------------------------

const INDIVIDUAL_SECTIONS: SectionDef[] = [
  {
    title: "ご契約者様の情報",
    description:
      "郵便番号・電話番号に「-」、県は入力せず、数字だけで入力ください。",
    fields: [
      {
        key: "ind_email", label: "メールアドレス", required: true, placeholder: "メールアドレス",
        inputType: "email", inputMode: "email",
        validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "正しいメールアドレスを入力してください" },
      },
      {
        key: "ind_name",
        label: "(1-1) 氏名(正式名称)",
        required: true,
        placeholder: "例) 高橋直太",
      },
      {
        key: "ind_name_kana",
        label: "(1-2) 氏名(カナ)",
        required: true,
        placeholder: "例) タカハシジョウタ",
        validation: { pattern: /^[ァ-ヶー\s　]+$/, message: "全角カタカナで入力してください" },
      },
      {
        key: "ind_postal_code",
        label: "(1-3) 郵便番号(半角数字)",
        required: true,
        placeholder: "例) 1500072",
        inputMode: "numeric",
        validation: { pattern: /^\d{7}$/, message: "ハイフンなしの7桁の数字で入力してください" },
      },
      {
        key: "ind_address",
        label: "(1-4) 住所",
        required: true,
        placeholder: "例) 東京都渋谷区広尾7丁目1-2",
      },
      {
        key: "ind_phone",
        label: "(1-5) 電話番号(半角数字)",
        required: true,
        placeholder: "例) 0358602420",
        inputMode: "tel",
        validation: { pattern: /^\d{10,11}$/, message: "ハイフンなしの10〜11桁の数字で入力してください" },
      },
      {
        key: "ind_birthday",
        label: "(1-6) 生年月日(西暦)",
        required: true,
        placeholder: "例) 19990123 → 1999年1月23日生まれの場合",
        inputMode: "numeric",
        validation: { pattern: /^\d{8}$/, message: "8桁の数字で入力してください（例: 19990123）" },
      },
      {
        key: "ind_gender",
        label: "(1-7) 性別",
        required: true,
        type: "radio",
        options: ["男", "女"],
      },
    ],
  },
  {
    title: "事業者情報",
    description:
      "郵便番号・電話番号に「-」、県は入力せず、数字だけで入力ください。",
    fields: [
      {
        key: "ind_business_name",
        label: "(2-1) 屋号(正式名称)",
        required: true,
        placeholder: "例) 高橋商店 ※ 屋号がない場合はご自身の名前をご記入してください。",
      },
      {
        key: "ind_business_type",
        label: "(2-2) 事業内容",
        required: true,
        type: "radio",
        options: [
          "飲食業",
          "美容業",
          "建設業",
          "IT/Web制作",
          "軽貨物運送",
          "小売業",
          "その他",
        ],
      },
      {
        key: "ind_business_start",
        label: "(2-3) 事業開始年月",
        required: true,
        placeholder: "例) 201807 → 2018年7月開始の場合",
        inputMode: "numeric",
        validation: { pattern: /^\d{6}$/, message: "6桁の数字で入力してください（例: 201807）" },
      },
      {
        key: "ind_income_type",
        label: "(2-4) 所得区分",
        required: true,
        type: "select",
        options: ["事業所得", "不動産所得", "雑所得", "その他"],
      },
      {
        key: "ind_office_address",
        label: "(2-5) 事業所住所",
        required: true,
        placeholder: "例) 東京都渋谷区広尾7丁目1-2",
      },
      {
        key: "ind_office_phone",
        label: "(2-6) 事業所電話番号(半角数字)",
        required: true,
        placeholder: "例) 0358602420",
        inputMode: "tel",
        validation: { pattern: /^\d{10,11}$/, message: "ハイフンなしの10〜11桁の数字で入力してください" },
      },
    ],
  },
  {
    title: "借入希望金額",
    fields: [
      {
        key: "ind_loan_amount",
        label: "(3) 借入希望金額(半角数字)を入力ください。",
        required: true,
        placeholder: "例) 5000000 → 借入希望額が500万円の場合",
        inputMode: "numeric",
        validation: { pattern: /^\d+$/, message: "半角数字のみで入力してください" },
      },
    ],
  },
  {
    title: "振込先金融機関の口座情報",
    description: "借入を受ける振込先金融機関の口座情報を入力ください。",
    fields: [
      {
        key: "ind_bank_name",
        label: "(4-1) 金融機関名",
        required: true,
        placeholder: "例) 三井住友銀行",
      },
      {
        key: "ind_branch_name",
        label: "(4-2) 支店名",
        required: true,
        placeholder: "例) あさがお支店",
      },
      {
        key: "ind_account_type",
        label: "(4-3) 口座種別",
        required: true,
        type: "radio",
        options: ["普通", "当座", "その他"],
        helpText: "該当のものを選択してください。",
      },
      {
        key: "ind_account_number",
        label: "(4-4) 口座番号(半角数字)",
        required: true,
        placeholder: "例) 1234567 → 口座番号が7桁未満は、頭に0をつけて7桁にしてください。",
        inputMode: "numeric",
        validation: { pattern: /^\d{1,7}$/, message: "7桁以内の半角数字で入力してください" },
      },
      {
        key: "ind_account_holder",
        label: "(4-5) 口座名義人カナ",
        required: true,
        placeholder: "例) タカハシジョウタ",
        validation: { pattern: /^[ァ-ヶー\s　（）()]+$/, message: "全角カタカナで入力してください" },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 法人フォーム定義
// ---------------------------------------------------------------------------

const CORPORATE_SECTIONS: SectionDef[] = [
  {
    title: "御社の情報",
    description:
      "郵便番号・電話番号に「-」、県は入力せず、数字だけで入力ください。",
    fields: [
      {
        key: "corp_email", label: "メールアドレス", required: true, placeholder: "メールアドレス",
        inputType: "email", inputMode: "email",
        validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "正しいメールアドレスを入力してください" },
      },
      {
        key: "corp_company_name",
        label: "(1-1) 法人名称(正式名称)",
        required: true,
        placeholder: "例) 有限会社オールジャパン保証",
      },
      {
        key: "corp_company_name_kana",
        label: "(1-2) 法人名称(カナ)",
        required: true,
        placeholder: "例) ユウゲンガイシャオールジャパンホショウ",
        validation: { pattern: /^[ァ-ヶー\s　]+$/, message: "全角カタカナで入力してください" },
      },
      {
        key: "corp_postal_code",
        label: "(1-3) 法人郵便番号(半角数字)",
        required: true,
        placeholder: "例) 1500072",
        inputMode: "numeric",
        validation: { pattern: /^\d{7}$/, message: "ハイフンなしの7桁の数字で入力してください" },
      },
      {
        key: "corp_address",
        label: "(1-4) 法人本店所在地",
        required: true,
        placeholder: "例) 東京都渋谷区広尾7丁目1-2 BLOCK5 EBISU 605",
      },
      {
        key: "corp_phone",
        label: "(1-5) 法人電話番号(半角数字)",
        required: true,
        placeholder: "例) 0358602420",
        inputMode: "tel",
        validation: { pattern: /^\d{10,11}$/, message: "ハイフンなしの10〜11桁の数字で入力してください" },
      },
    ],
  },
  {
    title: "代表者の情報",
    description:
      "郵便番号・電話番号に「-」、県は入力せず、数字だけで入力ください。",
    fields: [
      {
        key: "corp_rep_name",
        label: "(2-1) 代表者氏名(正式名称)",
        required: true,
        placeholder: "例) 高橋直太",
      },
      {
        key: "corp_rep_name_kana",
        label: "(2-2) 代表者氏名(カナ)",
        required: true,
        placeholder: "例) タカハシジョウタ",
        validation: { pattern: /^[ァ-ヶー\s　]+$/, message: "全角カタカナで入力してください" },
      },
      {
        key: "corp_rep_birthday",
        label: "(2-3) 代表者生年月日(西暦)",
        required: true,
        placeholder: "例) 19990123 → 1999年1月23日生まれの場合",
        inputMode: "numeric",
        validation: { pattern: /^\d{8}$/, message: "8桁の数字で入力してください（例: 19990123）" },
      },
      {
        key: "corp_rep_gender",
        label: "(2-4) 性別",
        required: true,
        type: "radio",
        options: ["男", "女"],
      },
      {
        key: "corp_rep_postal_code",
        label: "(2-5) 代表者郵便番号(半角数字)",
        required: true,
        placeholder: "例) 1500012",
        inputMode: "numeric",
        validation: { pattern: /^\d{7}$/, message: "ハイフンなしの7桁の数字で入力してください" },
      },
      {
        key: "corp_rep_address",
        label: "(2-6) 代表者住所",
        required: true,
        placeholder: "例) 東京都渋谷区広尾7丁目1-2 BLOCK5 EBISU 605",
      },
      {
        key: "corp_rep_phone",
        label: "(2-7) 代表者電話番号(半角数字)",
        required: true,
        placeholder: "例) 0358602420",
        inputMode: "tel",
        validation: { pattern: /^\d{10,11}$/, message: "ハイフンなしの10〜11桁の数字で入力してください" },
      },
    ],
  },
  {
    title: "借入希望金額",
    fields: [
      {
        key: "corp_loan_amount",
        label: "(3) 借入希望金額(半角数字)を入力ください。",
        required: true,
        placeholder: "例) 5000000 → 借入希望額が500万円の場合",
        inputMode: "numeric",
        validation: { pattern: /^\d+$/, message: "半角数字のみで入力してください" },
      },
    ],
  },
  {
    title: "振込先金融機関の口座情報",
    description: "借入を受ける法人の振込先金融機関の口座情報を入力ください。",
    fields: [
      {
        key: "corp_bank_name",
        label: "(4-1) 金融機関名",
        required: true,
        placeholder: "例) 三井住友銀行",
      },
      {
        key: "corp_branch_name",
        label: "(4-2) 支店名",
        required: true,
        placeholder: "例) あさがお支店",
      },
      {
        key: "corp_account_type",
        label: "(4-3) 口座種別",
        required: true,
        type: "radio",
        options: ["普通", "当座", "その他"],
        helpText: "該当のものを選択してください。",
      },
      {
        key: "corp_account_number",
        label: "(4-4) 口座番号(半角数字)",
        required: true,
        placeholder: "例) 1234567 → 口座番号が7桁未満は、頭に0をつけて7桁にしてください。",
        inputMode: "numeric",
        validation: { pattern: /^\d{1,7}$/, message: "7桁以内の半角数字で入力してください" },
      },
      {
        key: "corp_account_holder",
        label: "(4-5) 口座名義人(カナ)",
        required: true,
        placeholder: "例) ユ）オールジャパンホショウ",
        validation: { pattern: /^[ァ-ヶー\s　（）()／/]+$/, message: "全角カタカナで入力してください" },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 実質的支配者（動的追加方式）
// ---------------------------------------------------------------------------

const BO_FIELDS = (n: number): FieldDef[] => [
  {
    key: `corp_bo${n}_name`,
    label: `(5-${n}-1) 実質的支配者${n}人目 氏名称`,
    required: true,
    placeholder: "例) 株式会社タカハシ 代表取締役 高橋直太",
  },
  {
    key: `corp_bo${n}_name_kana`,
    label: `(5-${n}-2) 実質的支配者${n}人目 氏名称フリガナ`,
    required: true,
    placeholder: "例) タカハシジョウタ",
    validation: { pattern: /^[ァ-ヶー\s　]+$/, message: "全角カタカナで入力してください" },
  },
  {
    key: `corp_bo${n}_address`,
    label: `(5-${n}-3) 実質的支配者${n}人目 住所`,
    required: true,
    placeholder: "例) 東京都渋谷区広尾7丁目1-2",
  },
  {
    key: `corp_bo${n}_share`,
    label: `(5-${n}-4) 実質的支配者${n}人目 議決権等保有割合`,
    required: true,
    placeholder: "例) 40%",
  },
  {
    key: `corp_bo${n}_birthday`,
    label: `(5-${n}-5) 実質的支配者${n}人目 生年月日`,
    required: true,
    placeholder: "例) 19990123 → 1999年1月23日生まれの場合",
    inputMode: "numeric" as const,
    validation: { pattern: /^\d{8}$/, message: "8桁の数字で入力してください（例: 19990123）" },
  },
  {
    key: `corp_bo${n}_gender`,
    label: `(5-${n}-6) 実質的支配者${n}人目 性別`,
    required: true,
    type: "radio" as const,
    options: ["男", "女"],
  },
];

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

function FormFieldRenderer({
  field,
  value,
  onChange,
  error,
  errorMessage,
}: {
  field: FieldDef;
  value: string;
  onChange: (val: string) => void;
  error?: boolean;
  errorMessage?: string;
}) {
  const inputClass = error ? "border-red-500" : "";

  return (
    <div className="space-y-2" data-field-key={field.key}>
      <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}

      {field.type === "radio" && field.options ? (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-col gap-2">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`${field.key}_${opt}`} />
              <Label htmlFor={`${field.key}_${opt}`} className="font-normal cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ) : field.type === "select" && field.options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "date" ? (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : (
        <Input
          type={field.inputType || "text"}
          inputMode={field.inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
      {error && (
        <p className="text-xs text-red-500">{errorMessage || "この項目は必須です"}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export default function HojoLoanApplicationPage() {
  const searchParams = useSearchParams();
  const vendorToken = searchParams.get("v");

  const [formType, setFormType] = useState<FormType | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [invalidUrl, setInvalidUrl] = useState(false);
  const [boCount, setBoCount] = useState(0); // 実質的支配者の人数

  useEffect(() => {
    if (!vendorToken) {
      setInvalidUrl(true);
    }
  }, [vendorToken]);

  const sections =
    formType === "corporate"
      ? CORPORATE_SECTIONS
      : formType === "individual"
        ? INDIVIDUAL_SECTIONS
        : null;

  function handleChange(key: string, val: string) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function validateField(field: FieldDef, value: string | undefined): string | null {
    const trimmed = value?.trim() ?? "";
    if (field.required && !trimmed) {
      return "この項目は必須です";
    }
    if (trimmed && field.validation?.pattern && !field.validation.pattern.test(trimmed)) {
      return field.validation.message;
    }
    return null;
  }

  function validate(): boolean {
    if (!sections) return false;
    const newErrors = new Map<string, string>();

    const checkField = (field: FieldDef) => {
      const msg = validateField(field, answers[field.key]);
      if (msg) newErrors.set(field.key, msg);
    };

    for (const section of sections) {
      for (const field of section.fields) {
        checkField(field);
      }
    }
    if (formType === "corporate") {
      for (let i = 1; i <= boCount; i++) {
        for (const field of BO_FIELDS(i)) {
          checkField(field);
        }
      }
    }
    setErrors(newErrors);

    // エラーがある場合、最初のエラーフィールドにスクロール
    if (newErrors.size > 0) {
      const firstKey = newErrors.keys().next().value;
      if (firstKey) {
        const el = document.querySelector(`[data-field-key="${firstKey}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    return newErrors.size === 0;
  }

  async function handleSubmit() {
    if (!validate() || !formType || !vendorToken) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/hojo/form/loan-application/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: formType === "corporate" ? "loan-corporate" : "loan-individual",
          vendorToken,
          answers,
        }),
      });
      if (!res.ok) throw new Error("送信失敗");
      setSubmitted(true);
    } catch {
      alert("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  // ALKESロゴ
  const alkesLogo = (
    <Image
      src="/images/alkes-logo-full.png"
      alt="ALKES LLC"
      width={160}
      height={160}
      priority
      className="h-16 w-auto mx-auto mb-4 object-contain"
    />
  );

  // URL検証
  if (invalidUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-[#f0faf5] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#3b9d9d] via-[#55a88f] to-[#6fb789]" />
          <div className="px-8 py-12 text-center">
            {alkesLogo}
            <p className="text-red-500 font-medium">
              URLが正しくありません。正しいURLからアクセスしてください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 送信完了
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-[#f0faf5] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#3b9d9d] via-[#55a88f] to-[#6fb789]" />
          <div className="px-8 py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3b9d9d]/10 to-[#6fb789]/10 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-[#3b9d9d]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">送信が完了しました</h2>
            <p className="text-sm text-gray-500">
              借入申込フォームの送信が完了しました。内容を確認の上、ご連絡いたします。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // フォームタイプ選択
  if (!formType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-[#f0faf5] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#3b9d9d] via-[#55a88f] to-[#6fb789]" />
          <div className="px-8 pt-8 pb-2 text-center">
            {alkesLogo}
            <h2 className="text-xl font-bold text-gray-900">借入申込フォーム</h2>
            <p className="text-sm text-gray-400 mt-1">該当する申込区分を選択してください</p>
          </div>
          <div className="px-8 py-6 space-y-4">
            <button
              className="w-full h-16 text-lg font-medium rounded-xl border-2 border-[#d1ede2] bg-[#f0faf5] text-[#3b9d9d] hover:bg-[#e6f7f0] hover:border-[#3b9d9d] transition-all duration-150"
              onClick={() => setFormType("corporate")}
            >
              法人
            </button>
            <button
              className="w-full h-16 text-lg font-medium rounded-xl border-2 border-[#d1ede2] bg-[#f0faf5] text-[#3b9d9d] hover:bg-[#e6f7f0] hover:border-[#3b9d9d] transition-all duration-150"
              onClick={() => setFormType("individual")}
            >
              個人事業主
            </button>
          </div>
        </div>
      </div>
    );
  }

  // フォーム表示
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-[#f0faf5] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* ヘッダーカード */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#3b9d9d] via-[#55a88f] to-[#6fb789]" />
          <div className="px-8 py-6">
            <div className="flex items-center gap-4 mb-2">
              <Image
                src="/images/alkes-logo.png"
                alt="ALKES"
                width={36}
                height={36}
                className="w-9 h-9 shrink-0 object-contain"
              />
              <h1 className="text-xl font-bold text-gray-900">
                借入申込({formType === "corporate" ? "法人" : "個人事業主"})
              </h1>
            </div>
            <p className="text-sm text-gray-400">以下の質問にすべてお答えください</p>
            <p className="text-xs text-red-500 mt-2">* 必須の質問です</p>
          </div>
        </div>

        {sections!.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-8 py-4 border-b border-gray-100 bg-gradient-to-r from-[#3b9d9d] via-[#55a88f] to-[#6fb789]">
              <h3 className="font-bold text-white text-base">{section.title}</h3>
            </div>
            {section.description && (
              <div className="px-8 pt-4">
                <p className="text-xs text-gray-500">{section.description}</p>
              </div>
            )}
            <div className="px-8 py-6 space-y-6">
              {section.fields.map((field) => (
                <FormFieldRenderer
                  key={field.key}
                  field={field}
                  value={answers[field.key] || ""}
                  onChange={(val) => handleChange(field.key, val)}
                  error={errors.has(field.key)}
                  errorMessage={errors.get(field.key)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 法人の場合: 実質的支配者セクション（動的追加） */}
        {formType === "corporate" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-8 py-4 border-b border-gray-100 bg-gradient-to-r from-[#3b9d9d] via-[#55a88f] to-[#6fb789]">
              <h3 className="font-bold text-white text-base">(5) 実質的支配者の申告のお願い</h3>
            </div>
            <div className="px-8 pt-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                当社では、「犯罪による収益の移転防止に関する法律(犯罪収益移転防止法)」に基づき、法人のお客様に対し、融資申込時や代表者の変更時等に、下記に該当する者を「実質的支配者」とし、氏名・住所・生年月日・性別・議決権または分配を受ける権利の保有割合を申告いただいております。
                <br /><br />
                いない場合は空白で、いる場合は人数に合わせて追加してください。
              </p>
            </div>
            <div className="px-8 py-6 space-y-6">
              {Array.from({ length: boCount }, (_, i) => i + 1).map((n) => (
                <div key={n} className="space-y-4 border border-[#d1ede2] rounded-xl p-5 bg-[#f0faf5]/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-[#3b9d9d]">
                      実質的支配者 {n}人目
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        const currentCount = boCount;
                        setBoCount((prev) => prev - 1);
                        setAnswers((prev) => {
                          const next = { ...prev };
                          for (const f of BO_FIELDS(n)) {
                            delete next[f.key];
                          }
                          for (let j = n + 1; j <= currentCount; j++) {
                            for (const f of BO_FIELDS(j)) {
                              const newKey = f.key.replace(
                                `corp_bo${j}_`,
                                `corp_bo${j - 1}_`
                              );
                              if (next[f.key] !== undefined) {
                                next[newKey] = next[f.key];
                                delete next[f.key];
                              }
                            }
                          }
                          return next;
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      削除
                    </Button>
                  </div>
                  {BO_FIELDS(n).map((field) => (
                    <FormFieldRenderer
                      key={field.key}
                      field={field}
                      value={answers[field.key] || ""}
                      onChange={(val) => handleChange(field.key, val)}
                      error={errors.has(field.key)}
                    />
                  ))}
                </div>
              ))}

              {boCount === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">
                  実質的支配者がいる場合は、下の「追加」ボタンから入力してください。
                </p>
              )}

              <button
                type="button"
                className="w-full py-3 rounded-xl border-2 border-dashed border-[#d1ede2] text-[#3b9d9d] font-medium hover:bg-[#f0faf5] hover:border-[#3b9d9d] transition-all duration-150 flex items-center justify-center gap-2"
                onClick={() => setBoCount((prev) => prev + 1)}
              >
                <Plus className="h-4 w-4" />
                実質的支配者を追加（現在 {boCount}人）
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setFormType(null);
              setAnswers({});
              setErrors(new Map());
              setBoCount(0);
            }}
          >
            戻る
          </Button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3b9d9d] to-[#6fb789] hover:opacity-90 text-white font-medium transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                送信中...
              </>
            ) : (
              "送信"
            )}
          </button>
          <Button
            variant="ghost"
            className="rounded-xl text-gray-400 hover:text-gray-600"
            onClick={() => {
              setAnswers({});
              setErrors(new Map());
              setBoCount(0);
            }}
          >
            フォームをクリア
          </Button>
        </div>
      </div>
    </div>
  );
}
