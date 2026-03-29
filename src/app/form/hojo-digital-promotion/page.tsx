"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  Upload,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType = "TEXT" | "DATE" | "PARAGRAPH" | "FILE_UPLOAD";

interface FormField {
  title: string;
  type: FieldType;
  required: boolean;
  helpText?: string;
}

interface FormPage {
  label: string;
  fields: FormField[];
}

// ---------------------------------------------------------------------------
// Form definition
// ---------------------------------------------------------------------------

const FORM_PAGES: FormPage[] = [
  {
    label: "基本情報",
    fields: [
      { title: "会社名／屋号", type: "TEXT", required: true },
      { title: "設立年月日", type: "DATE", required: true },
      { title: "代表者氏名", type: "TEXT", required: true },
      { title: "代表者氏名（カナ）", type: "TEXT", required: true },
      { title: "役職", type: "TEXT", required: true },
      { title: "本社所在地", type: "TEXT", required: true },
      { title: "支店・営業所がある場合は所在地", type: "TEXT", required: false },
      { title: "連絡先（電話番号）", type: "TEXT", required: true },
      { title: "連絡先（メールアドレス）", type: "TEXT", required: true },
      { title: "資本金", type: "TEXT", required: true },
      { title: "従業員数", type: "TEXT", required: true },
      { title: "ホームページURL", type: "TEXT", required: false },
    ],
  },
  {
    label: "口座情報",
    fields: [
      {
        title: "口座情報",
        type: "FILE_UPLOAD",
        required: false,
        helpText:
          "事業で使用されている口座のスクリーンショットを添付してください",
      },
    ],
  },
  {
    label: "事業概要",
    fields: [
      { title: "事業の種類・業種・業態", type: "PARAGRAPH", required: true },
      { title: "主力商品・サービスの内容", type: "PARAGRAPH", required: true },
      {
        title: "事業の特徴や強み（差別化ポイント）",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・どのような顧客獲得方法／ビジネスモデルを採用しているか\n・他社と比較した際の違い（差別化されているポイント）\n・強みがどのように成果（成約率・継続率・効率性など）につながっているか\n・単発ではなく、継続的な成長や関係性につながる仕組みがあるか",
      },
      { title: "主要取引先・顧客層", type: "TEXT", required: false },
      { title: "事業開始の経緯や背景", type: "PARAGRAPH", required: false },
      {
        title: "現状の事業規模（売上高・利益・店舗数など）",
        type: "PARAGRAPH",
        required: true,
        helpText: "例）\n売上：1億\n総利益：5000万\n支店：2拠点",
      },
    ],
  },
  {
    label: "市場・競合情報",
    fields: [
      {
        title: "市場規模・成長性（統計やデータがあれば）",
        type: "PARAGRAPH",
        required: false,
      },
      {
        title: "ターゲット顧客層（年齢・性別・地域・嗜好など）",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・ターゲット顧客の基本属性（年齢層・性別・地域・職業・企業規模など）\n・顧客の抱えている課題やニーズ、購買に至る背景（なぜ必要としているのか）\n・嗜好・行動特性（情報収集手段、意思決定の傾向、重視するポイントなど）\n・なぜ当該ターゲット層を設定しているのか（自社サービスとの適合性・優位性）",
      },
      {
        title: "競合企業や競合サービス",
        type: "PARAGRAPH",
        required: false,
      },
      {
        title: "自社の優位性・課題",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・自社の優位性（競合と比較した際の強み・選ばれている理由）\n・その優位性がどのように成果（売上・成約率・継続率など）につながっているか\n・現状認識している課題やボトルネック（人材・体制・集客・オペレーションなど）\n・課題に対する具体的な改善方針や今後の取り組み（成長に向けた戦略）",
      },
    ],
  },
  {
    label: "支援制度申請関連",
    fields: [
      {
        title: "支援制度の目的",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・本支援制度を活用する目的（何を実現したいのか）\n・自社の現状課題と、本制度の活用がどのように結びつくか",
      },
      {
        title: "支援制度を活用して実現したいこと",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・支援制度を活用して実施する具体的な取り組み内容（導入内容・施策など）\n・その取り組みによってどのような変化が生まれるか（業務・体制・サービスの改善点）\n・期待される成果（業務効率化、売上向上、生産性向上など）\n・実現後の事業への波及効果（競争力強化、顧客満足度向上、事業拡大など）",
      },
      {
        title: "支援制度による投資・設備導入・採用など具体的計画",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・導入予定の設備・ツール・システムの具体的内容\n・採用予定の人材（人数・職種・役割）\n・外注・委託予定の業務内容\n・投資スケジュールと段階的な実施計画",
      },
      {
        title: "期待される成果（売上増、雇用創出、効率化など）",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・定量的な目標（売上○％増、コスト○％削減、雇用○名創出など）\n・定性的な効果（業務品質向上、顧客満足度改善、従業員の負担軽減など）\n・成果が実現するまでの想定期間\n・成果を測定するための指標（KPI）",
      },
    ],
  },
  {
    label: "組織・人材",
    fields: [
      { title: "組織図", type: "FILE_UPLOAD", required: false },
      {
        title: "経営陣・主要スタッフの略歴",
        type: "TEXT",
        required: false,
      },
      { title: "担当者ごとの役割・責任", type: "TEXT", required: false },
      { title: "必要な人材・採用予定", type: "TEXT", required: false },
    ],
  },
  {
    label: "事業計画・戦略",
    fields: [
      {
        title: "短期（1年以内）の目標",
        type: "PARAGRAPH",
        required: true,
        helpText: "例）10億",
      },
      {
        title: "中期（3年）の目標",
        type: "PARAGRAPH",
        required: true,
        helpText: "例）100億",
      },
      {
        title: "長期（5年）の目標",
        type: "PARAGRAPH",
        required: true,
        helpText: "例）1000億",
      },
      {
        title: "売上・利益計画",
        type: "PARAGRAPH",
        required: true,
        helpText: "例）2030年：1000億　利益率20％",
      },
      {
        title: "販売戦略・マーケティング戦略",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・主な販売チャネル（オンライン・オフライン・代理店など）\n・マーケティング施策（広告・SNS・展示会・紹介など）\n・顧客獲得の戦略と優先順位\n・ブランディングや認知向上の取り組み",
      },
    ],
  },
  {
    label: "財務情報",
    fields: [
      {
        title: "過去3年程度の財務諸表（売上・経費・利益）",
        type: "PARAGRAPH",
        required: true,
        helpText: "例）\n売上：１億\n利益：100万",
      },
      {
        title: "今後の投資計画と資金調達計画",
        type: "PARAGRAPH",
        required: true,
        helpText:
          "例）\n・投資予定の内容と金額（設備投資・人材投資・システム導入など）\n・資金調達方法（自己資金・融資・補助金・出資など）\n・資金繰り計画と返済計画\n・投資回収の見通し",
      },
      {
        title: "借入状況・担保・保証情報",
        type: "PARAGRAPH",
        required: false,
      },
    ],
  },
];

const FILE_FIELD_KEYS: Record<string, string> = {
  口座情報: "file_口座情報",
  組織図: "file_組織図",
};

const TOTAL_PAGES = FORM_PAGES.length;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HojoDigitalPromotionFormPage() {
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleTextChange = (title: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [title]: value }));
  };

  const handleFileSelect = (title: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [title]: file }));
  };

  const handleFileDrop = (title: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) handleFileSelect(title, file);
  };

  const handleFileInputChange = (
    title: string,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] ?? null;
    handleFileSelect(title, file);
  };

  const removeFile = (title: string) => {
    setFiles((prev) => ({ ...prev, [title]: null }));
    const input = fileInputRefs.current[title];
    if (input) input.value = "";
  };

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  const validateCurrentPage = (): boolean => {
    const page = FORM_PAGES[currentPage];
    const missing: string[] = [];
    for (const field of page.fields) {
      if (!field.required) continue;
      if (field.type === "FILE_UPLOAD") {
        if (!files[field.title]) missing.push(field.title);
      } else {
        if (!answers[field.title]?.trim()) missing.push(field.title);
      }
    }
    setErrors(missing);
    return missing.length === 0;
  };

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  const goNext = () => {
    if (!validateCurrentPage()) return;
    setErrors([]);
    setCurrentPage((p) => Math.min(p + 1, TOTAL_PAGES - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrev = () => {
    setErrors([]);
    setCurrentPage((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!validateCurrentPage()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("answers", JSON.stringify(answers));

      for (const [title, key] of Object.entries(FILE_FIELD_KEYS)) {
        const file = files[title];
        if (file) {
          formData.append(key, file);
        }
      }

      const res = await fetch(
        "/api/public/hojo/form/digital-promotion/submit",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) throw new Error("送信に失敗しました");
      setSubmitted(true);
    } catch {
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderHelpText = (helpText?: string) => {
    if (!helpText) return null;
    return (
      <p
        className="text-sm text-gray-500 mt-1 whitespace-pre-line"
        dangerouslySetInnerHTML={{
          __html: helpText.replace(/\n/g, "<br/>"),
        }}
      />
    );
  };

  const renderField = (field: FormField) => {
    const hasError = errors.includes(field.title);

    if (field.type === "FILE_UPLOAD") {
      const file = files[field.title] ?? null;
      return (
        <div key={field.title} className="space-y-2">
          <Label>
            {field.title}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {renderHelpText(field.helpText)}
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border p-3 bg-gray-50">
              <span className="text-sm truncate flex-1">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(field.title)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                hasError
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleFileDrop(field.title, e)}
              onClick={() => fileInputRefs.current[field.title]?.click()}
            >
              <Upload className="h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-500">
                ここにファイルをドラッグ＆ドロップ、またはクリックして選択
              </p>
              <input
                ref={(el) => {
                  fileInputRefs.current[field.title] = el;
                }}
                type="file"
                className="hidden"
                onChange={(e) => handleFileInputChange(field.title, e)}
              />
            </div>
          )}
          {hasError && (
            <p className="text-sm text-red-500">この項目は必須です</p>
          )}
        </div>
      );
    }

    // TEXT / DATE / PARAGRAPH
    const value = answers[field.title] ?? "";

    return (
      <div key={field.title} className="space-y-2">
        <Label>
          {field.title}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.type === "PARAGRAPH" ? (
          <Textarea
            value={value}
            onChange={(e) => handleTextChange(field.title, e.target.value)}
            rows={4}
            className={hasError ? "border-red-400" : ""}
          />
        ) : (
          <Input
            type={field.type === "DATE" ? "date" : "text"}
            value={value}
            onChange={(e) => handleTextChange(field.title, e.target.value)}
            className={hasError ? "border-red-400" : ""}
          />
        )}
        {renderHelpText(field.helpText)}
        {hasError && (
          <p className="text-sm text-red-500">この項目は必須です</p>
        )}
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Submitted screen
  // -----------------------------------------------------------------------

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">
            回答を受け付けました
          </h2>
          <p className="text-gray-600">
            ご回答いただきありがとうございます。内容を確認の上、担当者よりご連絡いたします。
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main form
  // -----------------------------------------------------------------------

  const page = FORM_PAGES[currentPage];
  const isLastPage = currentPage === TOTAL_PAGES - 1;

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Title */}
        <h1 className="text-xl md:text-2xl font-bold text-center text-gray-800">
          中小企業デジタル促進支援制度に伴う
          <br />
          事業計画書作成のための情報回収フォーム
        </h1>

        {/* Step indicator */}
        <div className="text-center text-sm text-gray-500">
          ページ {currentPage + 1} / {TOTAL_PAGES}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((currentPage + 1) / TOTAL_PAGES) * 100}%`,
            }}
          />
        </div>

        {/* Form card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {currentPage + 1}. {page.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {page.fields.map((field) => renderField(field))}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={currentPage === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>

          {isLastPage ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                "送信"
              )}
            </Button>
          ) : (
            <Button type="button" onClick={goNext}>
              次へ
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
