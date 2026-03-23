"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  FileCheck,
  Bell,
  Mail,
} from "lucide-react";

const MEMBER_CATEGORIES = [
  { value: "個人（法人代表・役員・従業員）", label: "個人（法人代表・役員・従業員）" },
  { value: "法人担当者", label: "法人担当者" },
  { value: "代理店", label: "代理店" },
];

interface FormData {
  memberCategory: string;
  lineName: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  privacyAgreed: boolean;
  note: string;
}

type PageStatus =
  | "no_uid"
  | "form"
  | "submitting"
  | "success"
  | "already_signed"
  | "already_sent"
  | "remind_expired"
  | "email_diff"
  | "email_changed"
  | "email_change_limit"
  | "send_error"
  | "error";

type ApiResponse = {
  success: boolean;
  type: string;
  error?: string;
  email?: string;
  sentDate?: string;
  signedDate?: string;
  currentEmail?: string;
  newEmail?: string;
  remainingChanges?: number;
  documentId?: string;
  canRemind?: boolean;
};

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ヘッダー共通
function Header() {
  return (
    <div className="bg-gradient-to-r from-sky-500 to-emerald-400 rounded-t-2xl p-8 text-center">
      <h1 className="text-2xl font-bold text-white tracking-wide">
        組合員入会申込フォーム
      </h1>
      <p className="text-sky-100 text-sm mt-2">
        一般社団法人 公的制度教育推進協会
      </p>
    </div>
  );
}

// フッター共通
function Footer() {
  return (
    <p className="text-center text-xs text-gray-400 mt-6">
      &copy; 一般社団法人 公的制度教育推進協会
    </p>
  );
}

export default function SlpMemberRegistrationPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PageStatus>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [remindSent, setRemindSent] = useState(false);
  const [remindLoading, setRemindLoading] = useState(false);
  const [lineNameEditable, setLineNameEditable] = useState(false);
  const [showLineNameConfirm, setShowLineNameConfirm] = useState(false);

  const lineNameParam = searchParams.get("lineName") || "";
  const uidParam = searchParams.get("uid") || "";

  const [formData, setFormData] = useState<FormData>({
    memberCategory: "",
    lineName: lineNameParam,
    name: "",
    position: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    privacyAgreed: false,
    note: "",
  });

  // UID がない場合はエラー
  useEffect(() => {
    if (!uidParam) {
      setStatus("no_uid");
    }
  }, [uidParam]);

  useEffect(() => {
    if (lineNameParam) {
      setFormData((prev) => ({ ...prev, lineName: lineNameParam }));
    }
  }, [lineNameParam]);

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const validate = (): string | null => {
    if (!formData.memberCategory) return "入会者区分を選択してください";
    if (!formData.lineName.trim()) return "LINE名を入力してください";
    if (!formData.name.trim()) return "お名前を入力してください";
    if (!formData.position.trim()) return "役職を入力してください";
    if (!formData.email.trim()) return "メールアドレスを入力してください";
    if (!formData.phone.trim()) return "電話番号を入力してください";
    if (
      (formData.memberCategory === "法人担当者" || formData.memberCategory === "代理店") &&
      !formData.company.trim()
    ) {
      return "法人担当者・代理店の方は法人情報を入力してください";
    }
    if (!formData.address.trim()) return "住所を入力してください";
    if (!formData.privacyAgreed) return "個人情報・機密情報の取扱いに同意してください";
    return null;
  };

  const submitForm = useCallback(
    async (confirmEmailChange = false) => {
      if (!confirmEmailChange) {
        const error = validate();
        if (error) {
          setErrorMessage(error);
          return;
        }
      }

      setStatus("submitting");

      try {
        const response = await fetch("/api/public/slp/member-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberCategory: formData.memberCategory,
            lineName: formData.lineName,
            name: formData.name,
            position: formData.position,
            email: formData.email,
            phone: formData.phone,
            company: formData.company || null,
            address: formData.address,
            note: formData.note || null,
            uid: uidParam,

            confirmEmailChange,
          }),
        });

        const data: ApiResponse = await response.json();
        setApiResponse(data);

        const statusMap: Record<string, PageStatus> = {
          success: "success",
          already_signed: "already_signed",
          already_sent: "already_sent",
          remind_expired: "remind_expired",
          email_diff: "email_diff",
          email_changed: "email_changed",
          email_change_limit: "email_change_limit",
          send_error: "send_error",
          error: "error",
        };

        const newStatus = statusMap[data.type] || "error";
        if (newStatus === "error") {
          setErrorMessage(data.error || "送信に失敗しました");
        }
        setStatus(newStatus);
      } catch {
        setErrorMessage("サーバーに接続できませんでした");
        setStatus("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData, uidParam]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm(false);
  };

  const handleRemind = async () => {
    setRemindLoading(true);
    try {
      const res = await fetch("/api/public/slp/member-remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uidParam }),
      });
      const data = await res.json();
      if (data.success) {
        setRemindSent(true);
      } else {
        setErrorMessage(data.error || "リマインド送信に失敗しました");
      }
    } catch {
      setErrorMessage("サーバーに接続できませんでした");
    } finally {
      setRemindLoading(false);
    }
  };

  // UID なし → エラーページ
  if (status === "no_uid") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-3">
                  フォームを開けませんでした
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  もう一度<strong>公式LINE</strong>で発行されるフォームのURLを踏んでからご回答ください。
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mt-3">
                  修正されたのに同じエラー画面が表示されている場合は、お手数ですが<strong>公式LINE</strong>へメッセージをお送りください。
                </p>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // 送信成功（新規）
  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              お申込みありがとうございます
            </h2>
            <p className="text-gray-600 leading-relaxed">
              入会申込を受け付けました。
            </p>
            <div className="mt-4 bg-sky-50 rounded-xl p-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-sky-600" />
                <span className="font-semibold text-gray-800 text-sm">契約書を送付しました</span>
              </div>
              <p className="text-gray-600 text-sm">
                <strong>{apiResponse?.email}</strong> 宛に電子契約書をお送りしました。<br />
                メールをご確認の上、契約書の締結をお願いいたします。
              </p>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // 既に契約締結済み
  if (status === "already_signed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8 text-center">
            <FileCheck className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              すでに登録されている情報が見つかっています
            </h2>
            <p className="text-gray-600 text-sm mb-2">
              一度の送信で大丈夫です、ありがとうございます。
            </p>
            <div className="mt-4 bg-emerald-50 rounded-xl p-4">
              <p className="text-emerald-700 font-semibold">
                契約書も締結済みです
              </p>
              {apiResponse?.signedDate && (
                <p className="text-emerald-600 text-sm mt-1">
                  締結日: {formatDateTime(apiResponse.signedDate)}
                </p>
              )}
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // 契約書送付済み（リマインド可能）
  if (status === "already_sent") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8">
            <div className="text-center mb-6">
              <Mail className="h-16 w-16 text-sky-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                すでに登録されている情報が見つかっています
              </h2>
              <p className="text-gray-600 text-sm">
                一度の送信で大丈夫です、ありがとうございます。
              </p>
            </div>

            <div className="bg-sky-50 rounded-xl p-4 mb-6">
              <p className="text-sky-800 text-sm">
                クラウドサインを{" "}
                <strong>{formatDateTime(apiResponse?.sentDate)}</strong> に{" "}
                <strong>{apiResponse?.email}</strong> にお送りしています。
              </p>
              <p className="text-sky-700 text-sm mt-1">
                メールをご確認の上、締結をお願いします。
              </p>
            </div>

            {/* リマインドボタン */}
            {apiResponse?.canRemind && (
              <div className="text-center">
                {remindSent ? (
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-emerald-700 text-sm font-semibold">
                      リマインドを送付しました
                    </p>
                    <p className="text-emerald-600 text-xs mt-1">
                      メールをご確認ください
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleRemind}
                    disabled={remindLoading}
                    className="bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-600 hover:to-emerald-500 text-white rounded-xl"
                  >
                    {remindLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        送信中...
                      </>
                    ) : (
                      <>
                        <Bell className="mr-2 h-4 w-4" />
                        リマインド送付を希望する
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // リマインド期限切れ
  if (status === "remind_expired") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8">
            <div className="text-center mb-6">
              <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                すでに登録されている情報が見つかっています
              </h2>
              <p className="text-gray-600 text-sm">
                一度の送信で大丈夫です、ありがとうございます。
              </p>
            </div>

            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-amber-800 text-sm font-semibold mb-2">
                送付した契約書の期限が切れています
              </p>
              <p className="text-amber-700 text-sm leading-relaxed">
                再度契約書の締結をご希望でしょうか？<br />
                ご希望であれば、お手数ですが<strong>公式LINE</strong>へその旨をメッセージしてください。
              </p>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // メールアドレス変更確認
  if (status === "email_diff") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8">
            <div className="text-center mb-6">
              <Mail className="h-16 w-16 text-sky-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                メールアドレスの変更をご希望ですか？
              </h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">現在のアドレス:</span>{" "}
                {apiResponse?.currentEmail}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">新しいアドレス:</span>{" "}
                {apiResponse?.newEmail}
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              「はい」を押すと、新しいメールアドレス宛に契約書を再送付します。
            </p>

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStatus("form")}
              >
                いいえ（戻る）
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-600 hover:to-emerald-500 text-white"
                onClick={() => submitForm(true)}
              >
                はい（変更する）
              </Button>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // メールアドレス変更完了
  if (status === "email_changed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              メールアドレスを変更しました
            </h2>
            <div className="bg-sky-50 rounded-xl p-4 text-left mt-4">
              <p className="text-sky-800 text-sm">
                <strong>{apiResponse?.email}</strong> 宛に電子契約書を再送付しました。<br />
                メールをご確認の上、契約書の締結をお願いいたします。
              </p>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // メールアドレス変更上限
  if (status === "email_change_limit") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8">
            <div className="text-center mb-4">
              <Mail className="h-12 w-12 text-sky-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-800">
                メールアドレスの変更をご希望でしょうか？
              </h2>
            </div>
            <div className="bg-sky-50 rounded-xl p-4">
              <p className="text-sky-700 text-sm leading-relaxed">
                お手数ですが、<strong>公式LINE</strong>にお問い合わせください。
              </p>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // 送付エラー（登録は成功、CloudSign送付のみ失敗）→ ユーザーにはやさしいメッセージ
  if (status === "send_error") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              フォーム回答ありがとうございます
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              契約書の送付まで今しばらくお待ちください。
            </p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // その他のエラー（サーバー接続エラー等）→ こちらもやさしいメッセージ
  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              フォーム回答ありがとうございます
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              契約書の送付まで今しばらくお待ちください。
            </p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // フォーム表示
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Header />

        <div className="bg-white rounded-b-2xl shadow-lg">
          <div className="px-8 pt-8 pb-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              本フォームは、組合員として入会いただくための申込フォームです。<br />
              原則として個人での入会を前提としていますが、法人代表者・法人担当者・代理店の方もご入力いただけます。
            </p>
            <p className="text-red-500 text-xs mt-3">* 必須の質問です</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
            {/* 入会者区分 */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-800">
                入会者区分 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.memberCategory}
                onValueChange={(value) => handleInputChange("memberCategory", value)}
              >
                <SelectTrigger className="border-gray-300 focus:border-sky-500 focus:ring-sky-500">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LINE名 */}
            <div className="space-y-2">
              <Label htmlFor="lineName" className="text-sm font-semibold text-gray-800">
                LINE名 <span className="text-red-500">*</span>
              </Label>
              {lineNameParam ? (
                <>
                  <p className="text-xs text-gray-500">
                    LINEで登録しているお名前が自動で表示されています。もしご自身のLINE名が表示されていない場合は、ご自身の公式LINEのリンクから再度アクセスしてご回答ください。
                  </p>
                  <Input
                    id="lineName"
                    value={formData.lineName}
                    onChange={(e) => handleInputChange("lineName", e.target.value)}
                    readOnly={!lineNameEditable}
                    className={
                      lineNameEditable
                        ? "border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                        : "border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                    }
                    placeholder="回答を入力"
                  />
                  {!lineNameEditable && (
                    <button
                      type="button"
                      onClick={() => setShowLineNameConfirm(true)}
                      className="text-xs text-sky-600 hover:text-sky-800 underline"
                    >
                      LINE名を修正する
                    </button>
                  )}
                  {showLineNameConfirm && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-amber-800">
                        LINE名はシステムで自動取得しています。通常は正しい名前が表示されていますが、修正しますか？
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLineNameEditable(true);
                            setShowLineNameConfirm(false);
                          }}
                          className="text-xs px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700"
                        >
                          はい、修正します
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLineNameConfirm(false)}
                          className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          いいえ
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    本名ではなく、LINEで登録しているお名前をご記載ください。
                  </p>
                  <Input
                    id="lineName"
                    value={formData.lineName}
                    onChange={(e) => handleInputChange("lineName", e.target.value)}
                    className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                    placeholder="回答を入力"
                  />
                </>
              )}
            </div>

            {/* お名前 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-gray-800">
                お名前（フルネーム） <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">
                漢字でご記載ください<br />
                <strong>姓名の間は空けないでください</strong>
              </p>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="回答を入力"
              />
            </div>

            {/* 役職 */}
            <div className="space-y-2">
              <Label htmlFor="position" className="text-sm font-semibold text-gray-800">
                役職 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">
                例：代表取締役／取締役／人事担当／代理店 など
              </p>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => handleInputChange("position", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="回答を入力"
              />
            </div>

            {/* メールアドレス */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-800">
                メールアドレス <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">
                電子契約書の送付先となる連絡先です。<br />
                ご連絡が取れるメールアドレスをご入力ください。
              </p>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="回答を入力"
              />
            </div>

            {/* 電話番号 */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold text-gray-800">
                電話番号 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">
                一般社団法人 公的制度教育推進協会からのご連絡を受け取ることができる電話番号をご入力ください。
              </p>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="回答を入力"
              />
            </div>

            {/* 法人情報 */}
            <div className="space-y-2">
              <Label htmlFor="company" className="text-sm font-semibold text-gray-800">
                法人情報（※法人担当者・代理店の場合は必須）
                {(formData.memberCategory === "法人担当者" ||
                  formData.memberCategory === "代理店") && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
              <p className="text-xs text-gray-500">
                株式会社／合同会社／有限会社まで正式名称でご記載ください
              </p>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleInputChange("company", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="回答を入力"
              />
            </div>

            {/* 住所 */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-semibold text-gray-800">
                住所 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="回答を入力"
              />
            </div>

            {/* 個人情報・機密情報の取扱い同意 */}
            <div className="space-y-3 bg-gray-50 rounded-xl p-5">
              <Label className="text-sm font-semibold text-gray-800">
                個人情報・機密情報の取扱い同意 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-600 leading-relaxed">
                機密情報および個人情報の取扱いに関する同意書を確認し、同意します。
              </p>
              <a
                href="https://drive.google.com/file/d/1jI-cUueB5QX5ROLnMgIDtNkIUe94s_7G/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sky-600 hover:text-sky-700 text-xs underline underline-offset-2"
              >
                同意書を確認する（Google Drive）
              </a>
              <label className="flex items-center gap-3 cursor-pointer mt-2">
                <Checkbox
                  checked={formData.privacyAgreed}
                  onCheckedChange={(checked) =>
                    handleInputChange("privacyAgreed", checked === true)
                  }
                  className="data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                />
                <span className="text-sm text-gray-700">同意する</span>
              </label>
            </div>

            {/* 備考 */}
            <div className="space-y-2">
              <Label htmlFor="note" className="text-sm font-semibold text-gray-800">
                備考
              </Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => handleInputChange("note", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500 min-h-[80px]"
                placeholder="回答を入力"
              />
            </div>

            {/* エラーメッセージ */}
            {errorMessage && (
              <div className="flex items-start gap-2 bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 送信ボタン */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-600 hover:to-emerald-500 text-white rounded-xl shadow-md transition-all duration-200"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  送信中...
                </>
              ) : (
                "送信"
              )}
            </Button>
          </form>
        </div>

        <Footer />
      </div>
    </div>
  );
}
