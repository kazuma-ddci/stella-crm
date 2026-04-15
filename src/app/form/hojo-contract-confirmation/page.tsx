"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";

// ---------------------------------------------------------------------------
// Types & Field Definitions
// ---------------------------------------------------------------------------

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "radio";
  inputType?: "email" | "tel" | "text";
  inputMode?: "tel" | "email" | "text";
  validation?: { pattern: RegExp; message: string };
};

type SectionDef = {
  title: string;
  description?: string;
  fields: FieldDef[];
};

const SECTIONS: SectionDef[] = [
  {
    title: "法人情報",
    fields: [
      { key: "companyName", label: "法人名", required: true, placeholder: "例) 株式会社○○" },
    ],
  },
  {
    title: "代表者情報",
    description: "代表者または主担当者のどちらかは必ず入力してください。名前とLINE名は必須です。",
    fields: [
      { key: "representativeName", label: "代表者名", required: true, placeholder: "例) 山田 太郎" },
      { key: "representativePhone", label: "代表者電話番号", placeholder: "例) 09012345678", inputType: "tel", inputMode: "tel" },
      { key: "representativeEmail", label: "代表者メールアドレス", placeholder: "例) yamada@example.com", inputType: "email", inputMode: "email",
        validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "正しいメールアドレスを入力してください" },
      },
      { key: "representativeLineName", label: "代表者LINE名", required: true, placeholder: "例) やまだ" },
    ],
  },
  {
    title: "主担当者情報",
    description: "主担当者がいる場合に入力してください。入力する場合、名前とLINE名は必須です。",
    fields: [
      { key: "contactName", label: "主担当者名", placeholder: "例) 佐藤 花子" },
      { key: "contactPhone", label: "主担当者電話番号", placeholder: "例) 09012345678", inputType: "tel", inputMode: "tel" },
      { key: "contactEmail", label: "主担当者メールアドレス", placeholder: "例) sato@example.com", inputType: "email", inputMode: "email",
        validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "正しいメールアドレスを入力してください" },
      },
      { key: "contactLineName", label: "主担当者LINE名", placeholder: "例) さとう" },
    ],
  },
  {
    title: "サービス契約内容",
    fields: [
      { key: "scWholesale", label: "セキュリティクラウド卸", required: true, type: "radio" },
      { key: "consultingPlan", label: "コンサルティングプラン", required: true, type: "radio" },
      { key: "grantApplicationBpo", label: "交付申請BPO", required: true, type: "radio" },
      { key: "subsidyConsulting", label: "助成金コンサルティング", required: true, type: "radio" },
      { key: "loanUsage", label: "貸金利用の有無", required: true, type: "radio" },
      { key: "vendorRegistration", label: "ベンダー登録の有無", required: true, type: "radio" },
    ],
  },
];

// ラジオ選択肢のマップ
const RADIO_OPTIONS: Record<string, string[]> = {
  scWholesale: ["Aプラン", "Bプラン", "なし"],
  consultingPlan: ["エグゼクティブ", "プロフェッショナル", "パートナー", "なし"],
  grantApplicationBpo: ["あり", "なし"],
  subsidyConsulting: ["あり", "なし"],
  loanUsage: ["あり", "なし"],
  vendorRegistration: ["申請済", "申請中", "未申請"],
};

// ---------------------------------------------------------------------------
// Field Renderer
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

      {field.type === "radio" && RADIO_OPTIONS[field.key] ? (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-col gap-2">
          {RADIO_OPTIONS[field.key].map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`${field.key}_${opt}`} />
              <Label htmlFor={`${field.key}_${opt}`} className="font-normal cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
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
// Main Page
// ---------------------------------------------------------------------------

export default function ContractConfirmationPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(key: string, val: string) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function validate(): boolean {
    const newErrors = new Map<string, string>();
    const a = answers;

    // 法人名は必須
    if (!a.companyName?.trim()) newErrors.set("companyName", "この項目は必須です");

    // 代表者名・LINE名は必須
    if (!a.representativeName?.trim()) newErrors.set("representativeName", "この項目は必須です");
    if (!a.representativeLineName?.trim()) newErrors.set("representativeLineName", "この項目は必須です");

    // 代表者メールアドレスのバリデーション（入力がある場合のみ）
    if (a.representativeEmail?.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.representativeEmail.trim())) {
        newErrors.set("representativeEmail", "正しいメールアドレスを入力してください");
      }
    }

    // 主担当者: 名前またはLINE名のどちらかが入力されている場合、両方必須
    const hasContactInput = a.contactName?.trim() || a.contactLineName?.trim() || a.contactPhone?.trim() || a.contactEmail?.trim();
    if (hasContactInput) {
      if (!a.contactName?.trim()) newErrors.set("contactName", "主担当者情報を入力する場合、名前は必須です");
      if (!a.contactLineName?.trim()) newErrors.set("contactLineName", "主担当者情報を入力する場合、LINE名は必須です");
      // メールバリデーション
      if (a.contactEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.contactEmail.trim())) {
        newErrors.set("contactEmail", "正しいメールアドレスを入力してください");
      }
    }

    // サービス契約内容は全て必須
    for (const key of Object.keys(RADIO_OPTIONS)) {
      if (!a[key]?.trim()) newErrors.set(key, "この項目は必須です");
    }

    setErrors(newErrors);

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
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/hojo/form/contract-confirmation/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("送信失敗");
      setSubmitted(true);
    } catch {
      alert("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

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
              契約内容確認フォームの送信が完了しました。ご協力ありがとうございます。
            </p>
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
            {alkesLogo}
            <h1 className="text-xl font-bold text-gray-900 text-center">契約内容確認フォーム</h1>
            <p className="text-sm text-gray-400 mt-2 text-center">以下の質問にお答えください</p>
            <p className="text-xs text-red-500 mt-2 text-center">* 必須の質問です</p>
          </div>
        </div>

        {SECTIONS.map((section) => (
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

        {/* 送信ボタン */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-8">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-12 text-base bg-gradient-to-r from-[#3b9d9d] to-[#6fb789] hover:from-[#358d8d] hover:to-[#5f9a7a] text-white rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                送信中...
              </>
            ) : (
              "送信"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
