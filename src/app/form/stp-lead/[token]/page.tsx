"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, AlertCircle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { toLocalDateString } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);

// 職種リスト（18項目）
const JOB_TYPES = [
  "営業（国内・海外・法人・個人）",
  "販売・接客・サービス（小売・飲食・宿泊・理美容など）",
  "事務・管理（総務・人事・経理・受付・秘書など）",
  "企画・マーケティング・広報",
  "経営・経営企画（役員・経営者を含む）",
  "専門職（コンサル・士業・金融など）",
  "ITエンジニア（システム開発・インフラ・社内SEなど）",
  "Web・クリエイティブ（デザイン・編集・制作など）",
  "技術職（機械・電気・電子・化学・素材など）",
  "製造・生産・品質管理",
  "建築・土木・設備技術",
  "医療・福祉・介護",
  "教育・保育・研究",
  "公務員・団体職員",
  "物流・運送・ドライバー",
  "農林水産業",
  "保安・警備・清掃",
  "その他",
];

// 都道府県リスト
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// 年齢幅選択肢
const AGE_RANGE_OPTIONS = [
  { value: "不問", label: "不問" },
  { value: "〜30", label: "〜30歳" },
  { value: "〜35", label: "〜35歳" },
  { value: "〜40", label: "〜40歳" },
  { value: "〜45", label: "〜45歳" },
  { value: "〜50", label: "〜50歳" },
  { value: "〜55", label: "〜55歳" },
];

interface FormData {
  // ページ1: 基本情報 + 現状の採用状況
  companyName: string;
  contactName: string;
  contactEmail: string;
  pastHiringJobType: string;  // 単一選択に変更
  pastRecruitingCostAgency: string;
  pastRecruitingCostAds: string;
  pastRecruitingCostReferral: string;
  pastRecruitingCostOther: string;
  pastHiringCount: string;

  // ページ2: 今後の採用予定
  desiredJobType: string;  // 単一選択に変更
  annualBudget: string;
  annualHiringTarget: string;
  hiringArea: string;  // 単一選択に変更
  hiringTimeline: string;
  ageRange: string;  // 新しいフィールド
  requiredConditions: string;
  preferredConditions: string;
}

type PageStatus = "loading" | "invalid" | "form" | "submitting" | "success" | "error";

export default function LeadFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [currentPage, setCurrentPage] = useState(1);
  const [agentName, setAgentName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    contactName: "",
    contactEmail: "",
    pastHiringJobType: "",
    pastRecruitingCostAgency: "",
    pastRecruitingCostAds: "",
    pastRecruitingCostReferral: "",
    pastRecruitingCostOther: "",
    pastHiringCount: "",
    desiredJobType: "",
    annualBudget: "",
    annualHiringTarget: "",
    hiringArea: "",
    hiringTimeline: "",
    ageRange: "",
    requiredConditions: "",
    preferredConditions: "",
  });

  // トークン検証
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/public/lead-form/validate/${token}`);
        const data = await response.json();

        if (data.valid) {
          setAgentName(data.agentName);
          setStatus("form");
        } else {
          setErrorMessage(data.error || "無効なフォームです");
          setStatus("invalid");
        }
      } catch {
        setErrorMessage("サーバーに接続できませんでした");
        setStatus("invalid");
      }
    };

    validateToken();
  }, [token]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // エラーメッセージをクリア
    if (errorMessage) setErrorMessage("");
  };

  // ページ1の必須項目チェック
  const isPage1Valid = () => {
    return formData.companyName && formData.contactName && formData.contactEmail && formData.pastHiringJobType;
  };

  // ページ2の必須項目チェック
  const isPage2Valid = () => {
    return formData.desiredJobType;
  };

  const handleNextPage = () => {
    if (!isPage1Valid()) {
      setErrorMessage("会社名、担当者氏名、メールアドレス、職種は必須です");
      return;
    }
    // ページ1で選択した職種をページ2に反映
    setFormData((prev) => ({ ...prev, desiredJobType: prev.pastHiringJobType }));
    setCurrentPage(2);
    setErrorMessage("");
  };

  const handlePrevPage = () => {
    setCurrentPage(1);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!isPage1Valid()) {
      setErrorMessage("会社名、担当者氏名、メールアドレス、職種は必須です");
      setCurrentPage(1);
      return;
    }
    if (!isPage2Valid()) {
      setErrorMessage("ご希望の職種は必須です");
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch("/api/public/lead-form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          companyName: formData.companyName,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          // 単一選択を配列に変換して互換性維持
          pastHiringJobTypes: formData.pastHiringJobType ? [formData.pastHiringJobType] : undefined,
          pastRecruitingCostAgency: formData.pastRecruitingCostAgency ? Number(formData.pastRecruitingCostAgency) : undefined,
          pastRecruitingCostAds: formData.pastRecruitingCostAds ? Number(formData.pastRecruitingCostAds) : undefined,
          pastRecruitingCostReferral: formData.pastRecruitingCostReferral ? Number(formData.pastRecruitingCostReferral) : undefined,
          pastRecruitingCostOther: formData.pastRecruitingCostOther ? Number(formData.pastRecruitingCostOther) : undefined,
          pastHiringCount: formData.pastHiringCount ? Number(formData.pastHiringCount) : undefined,
          desiredJobTypes: formData.desiredJobType ? [formData.desiredJobType] : undefined,
          annualBudget: formData.annualBudget ? Number(formData.annualBudget) : undefined,
          annualHiringTarget: formData.annualHiringTarget ? Number(formData.annualHiringTarget) : undefined,
          hiringAreas: formData.hiringArea ? [formData.hiringArea] : undefined,
          hiringTimeline: formData.hiringTimeline || undefined,
          ageRange: formData.ageRange || undefined,
          requiredConditions: formData.requiredConditions || undefined,
          preferredConditions: formData.preferredConditions || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
      } else {
        setErrorMessage(data.error || "送信に失敗しました");
        setStatus("error");
      }
    } catch {
      setErrorMessage("サーバーに接続できませんでした");
      setStatus("error");
    }
  };

  // ローディング状態
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 無効なトークン
  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-purple-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* ヘッダー画像エリア */}
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-t-lg p-8 text-center">
            <img
              src="/images/20260205-211053.png"
              alt="採用ブースト"
              className="mx-auto max-w-[400px] w-full h-auto"
            />
            <p className="text-sm text-gray-500 mt-2">【ヒアリングシート】</p>
          </div>

          {/* 青いアクセントライン */}
          <div className="h-3 bg-blue-600 rounded-b-sm" />

          <Card className="rounded-t-none border-t-0">
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
                <CardTitle className="text-2xl">フォームを表示できません</CardTitle>
              </div>
              <CardDescription className="text-base text-gray-700">
                {errorMessage}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // 再送信（別の職種で回答する）
  const handleNewSubmission = () => {
    setFormData((prev) => ({
      // 基本情報は保持
      companyName: prev.companyName,
      contactName: prev.contactName,
      contactEmail: prev.contactEmail,
      // それ以外はリセット
      pastHiringJobType: "",
      pastRecruitingCostAgency: "",
      pastRecruitingCostAds: "",
      pastRecruitingCostReferral: "",
      pastRecruitingCostOther: "",
      pastHiringCount: "",
      desiredJobType: "",
      annualBudget: "",
      annualHiringTarget: "",
      hiringArea: "",
      hiringTimeline: "",
      ageRange: "",
      requiredConditions: "",
      preferredConditions: "",
    }));
    setCurrentPage(1);
    setErrorMessage("");
    setStatus("form");
  };

  // 送信成功
  if (status === "success") {
    return (
      <div className="min-h-screen bg-purple-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* ヘッダー画像エリア */}
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-t-lg p-8 text-center">
            <img
              src="/images/20260205-211053.png"
              alt="採用ブースト"
              className="mx-auto max-w-[400px] w-full h-auto"
            />
            <p className="text-sm text-gray-500 mt-2">【ヒアリングシート】</p>
          </div>

          {/* 青いアクセントライン */}
          <div className="h-3 bg-blue-600 rounded-b-sm" />

          <Card className="rounded-t-none border-t-0">
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
                <CardTitle className="text-2xl">採用ブースト【ヒアリングシート】</CardTitle>
              </div>
              <CardDescription className="text-base text-gray-700 space-y-4">
                <p>ご回答いただきありがとうございます。</p>
                <p>
                  ただ今ご回答いただいた職種の他に、今後採用を進める予定のある職種がございましたら、お手数ですが職種毎にご回答をお願いいたします。
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleNewSubmission}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                別の職種で回答する
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // フォーム表示
  return (
    <div className="min-h-screen bg-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー画像エリア */}
        <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-t-lg p-8 text-center">
          <img
              src="/images/20260205-211053.png"
              alt="採用ブースト"
              className="mx-auto max-w-[400px] w-full h-auto"
            />
          <p className="text-sm text-gray-500 mt-2">【ヒアリングシート】</p>
        </div>

        {/* 青いアクセントライン */}
        <div className="h-3 bg-blue-600 rounded-b-sm" />

        <Card className="rounded-t-none border-t-0">
          <CardHeader>
            <CardTitle className="text-2xl">
              {currentPage === 1 ? "採用ブースト【ヒアリングシート】" : "今後の採用予定"}
            </CardTitle>
            <CardDescription className="text-base text-gray-700 mt-4 space-y-4">
              {currentPage === 1 ? (
                <>
                  <p>
                    今後採用を進める予定のある職種の<strong className="font-bold">現状の採用状況</strong>と、<strong className="font-bold">今後の採用予定</strong>について教えてください。
                  </p>
                  <p className="text-sm text-red-600">
                    ※今後採用を進める職種が複数ある場合は、お手数ですが複数回答を送信していただけますと幸いです。
                  </p>
                </>
              ) : (
                <p>今後採用を進める予定のある職種の採用予定を教えてください。</p>
              )}
            </CardDescription>
            {/* ページインジケーター */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`w-3 h-3 rounded-full ${currentPage === 1 ? "bg-blue-600" : "bg-gray-300"}`} />
              <div className={`w-3 h-3 rounded-full ${currentPage === 2 ? "bg-blue-600" : "bg-gray-300"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* ページ1: 現状の採用状況 */}
              {currentPage === 1 && (
                <>
                  {/* 基本情報 */}
                  <div className="space-y-4">
                    <h3 className="font-semibold border-b pb-2">基本情報</h3>

                    <div className="space-y-2">
                      <Label htmlFor="companyName">会社名 <span className="text-red-500">*</span></Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => handleInputChange("companyName", e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactName">担当者氏名 <span className="text-red-500">*</span></Label>
                      <Input
                        id="contactName"
                        value={formData.contactName}
                        onChange={(e) => handleInputChange("contactName", e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">メールアドレス <span className="text-red-500">*</span></Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* 採用実績情報 */}
                  <div className="space-y-4">
                    <h3 className="font-semibold border-b pb-2">採用実績について</h3>

                    <div className="space-y-2">
                      <Label htmlFor="pastHiringJobType">
                        今後採用を進める予定のある職種で過去にも採用を行っていた職種 <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.pastHiringJobType}
                        onValueChange={(value) => handleInputChange("pastHiringJobType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="職種を選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_TYPES.map((jobType) => (
                            <SelectItem key={jobType} value={jobType}>
                              {jobType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>その職種を採用する上で、過去1年間でかけた費用（円）</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="pastRecruitingCostAgency" className="text-sm text-gray-500">人材紹介会社</Label>
                          <Input
                            id="pastRecruitingCostAgency"
                            type="number"
                            placeholder="円"
                            value={formData.pastRecruitingCostAgency}
                            onChange={(e) => handleInputChange("pastRecruitingCostAgency", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="pastRecruitingCostAds" className="text-sm text-gray-500">求人広告会社</Label>
                          <Input
                            id="pastRecruitingCostAds"
                            type="number"
                            placeholder="円"
                            value={formData.pastRecruitingCostAds}
                            onChange={(e) => handleInputChange("pastRecruitingCostAds", e.target.value)}
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            ※運用代行会社への委託費や運用に関わる人件費も含めてください
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="pastRecruitingCostReferral" className="text-sm text-gray-500">リファラル</Label>
                          <Input
                            id="pastRecruitingCostReferral"
                            type="number"
                            placeholder="円"
                            value={formData.pastRecruitingCostReferral}
                            onChange={(e) => handleInputChange("pastRecruitingCostReferral", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="pastRecruitingCostOther" className="text-sm text-gray-500">その他</Label>
                          <Input
                            id="pastRecruitingCostOther"
                            type="number"
                            placeholder="円"
                            value={formData.pastRecruitingCostOther}
                            onChange={(e) => handleInputChange("pastRecruitingCostOther", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pastHiringCount">過去1年間の採用人数（人）</Label>
                      <Input
                        id="pastHiringCount"
                        type="number"
                        placeholder="人"
                        value={formData.pastHiringCount}
                        onChange={(e) => handleInputChange("pastHiringCount", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* エラーメッセージ */}
                  {errorMessage && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                      {errorMessage}
                    </div>
                  )}

                  {/* 次へボタン */}
                  <Button
                    type="button"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleNextPage}
                  >
                    次へ
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}

              {/* ページ2: 今後の採用予定 */}
              {currentPage === 2 && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="desiredJobType">
                        採用希望の職種
                      </Label>
                      <Input
                        id="desiredJobType"
                        value={formData.desiredJobType}
                        disabled
                        className="bg-gray-50 border-gray-300 text-gray-900 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="annualBudget">年間採用予算（円）</Label>
                        <Input
                          id="annualBudget"
                          type="number"
                          placeholder="円"
                          value={formData.annualBudget}
                          onChange={(e) => handleInputChange("annualBudget", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="annualHiringTarget">年間採用希望人数（人）</Label>
                        <Input
                          id="annualHiringTarget"
                          type="number"
                          placeholder="人"
                          value={formData.annualHiringTarget}
                          onChange={(e) => handleInputChange("annualHiringTarget", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hiringArea">採用エリア（都道府県）</Label>
                      <Select
                        value={formData.hiringArea}
                        onValueChange={(value) => handleInputChange("hiringArea", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="都道府県を選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {PREFECTURES.map((pref) => (
                            <SelectItem key={pref} value={pref}>
                              {pref}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hiringTimeline">いつまでに採用したいか</Label>
                      <DatePicker
                        id="hiringTimeline"
                        selected={formData.hiringTimeline ? new Date(formData.hiringTimeline) : null}
                        onChange={(date: Date | null) => {
                          handleInputChange("hiringTimeline", date ? toLocalDateString(date) : "");
                        }}
                        dateFormat="yyyy/MM/dd"
                        locale="ja"
                        placeholderText="日付を選択"
                        isClearable
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        wrapperClassName="w-full"
                        calendarClassName="shadow-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ageRange">採用可能年齢幅</Label>
                      <Select
                        value={formData.ageRange}
                        onValueChange={(value) => handleInputChange("ageRange", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="年齢幅を選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGE_RANGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="requiredConditions">採用必須条件</Label>
                      <Textarea
                        id="requiredConditions"
                        placeholder="例: 普通自動車免許、基本的なPC操作"
                        value={formData.requiredConditions}
                        onChange={(e) => handleInputChange("requiredConditions", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferredConditions">採用希望条件</Label>
                      <Textarea
                        id="preferredConditions"
                        placeholder="例: 業界経験者、マネジメント経験"
                        value={formData.preferredConditions}
                        onChange={(e) => handleInputChange("preferredConditions", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* エラーメッセージ */}
                  {(status === "error" || errorMessage) && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                      {errorMessage}
                    </div>
                  )}

                  {/* ボタン */}
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
                      onClick={handlePrevPage}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      戻る
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      disabled={status === "submitting"}
                    >
                      {status === "submitting" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          送信中...
                        </>
                      ) : (
                        "送信する"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
