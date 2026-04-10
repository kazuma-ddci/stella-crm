"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  KoutekiPageShell,
  KoutekiCard,
  KoutekiCardContent,
  KoutekiButton,
  KoutekiInput,
  KoutekiTextarea,
  KoutekiSelect,
  KoutekiCheckbox,
  KoutekiFormField,
  KoutekiFormStack,
} from "@/components/kouteki";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  Bell,
  Mail,
} from "lucide-react";
import { getPublicUid } from "@/lib/slp/public-uid";

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

/** 結果/エラー画面用の共通カード。中央寄せのアイコン + タイトル + 本文 */
function StatusCard({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-5 text-center">
      <div className="flex justify-center">
        <div
          className={`inline-flex h-16 w-16 items-center justify-center rounded-full ${iconBg}`}
        >
          {icon}
        </div>
      </div>
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      {children && (
        <div className="space-y-3 text-left text-sm leading-relaxed text-slate-600">
          {children}
        </div>
      )}
    </div>
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
  // uid は URL と sessionStorage の両方から取得（リロード時の復元に対応）
  // 初期値は空で、useEffect 内で解決する
  const [uidParam, setUidParam] = useState("");

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

  // UID を URL / sessionStorage から取得、ない場合はエラー
  useEffect(() => {
    const resolved = getPublicUid();
    if (!resolved) {
      setStatus("no_uid");
      return;
    }
    setUidParam(resolved);

    // URL に uid が含まれていなければ付け直しておく（以降のリロードに備える）
    const sp = new URLSearchParams(window.location.search);
    if (!sp.get("uid")) {
      const url = new URL(window.location.href);
      url.searchParams.set("uid", resolved);
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

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

  // ===== 各種状態画面 =====

  // UID なし → エラーページ
  if (status === "no_uid") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<AlertCircle className="h-8 w-8 text-rose-500" />}
          iconBg="bg-rose-50"
          title="フォームを開けませんでした"
        >
          <p>
            もう一度<strong>公式LINE</strong>で発行されるフォームのURLを踏んでからご回答ください。
          </p>
          <p>
            修正されたのに同じエラー画面が表示されている場合は、お手数ですが<strong>公式LINE</strong>へメッセージをお送りください。
          </p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // 送信成功（新規）
  if (status === "success") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          iconBg="bg-emerald-50"
          title="お申込みありがとうございます"
        >
          <p className="text-center">入会申込を受け付けました。</p>
          <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-slate-800">契約書を送付しました</span>
            </div>
            <p className="text-slate-600">
              <strong>{apiResponse?.email}</strong> 宛に電子契約書をお送りしました。
              <br />
              メールをご確認の上、契約書の締結をお願いいたします。
            </p>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // 既に契約締結済み
  if (status === "already_signed") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<FileCheck className="h-8 w-8 text-emerald-500" />}
          iconBg="bg-emerald-50"
          title="すでに登録されている情報が見つかっています"
        >
          <p className="text-center">一度の送信で大丈夫です、ありがとうございます。</p>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
            <p className="font-semibold text-emerald-700">契約書も締結済みです</p>
            {apiResponse?.signedDate && (
              <p className="mt-1 text-sm text-emerald-600">
                締結日: {formatDateTime(apiResponse.signedDate)}
              </p>
            )}
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // 契約書送付済み（リマインド可能）
  if (status === "already_sent") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<Mail className="h-8 w-8 text-blue-600" />}
          iconBg="bg-blue-50"
          title="すでに登録されている情報が見つかっています"
        >
          <p className="text-center">一度の送信で大丈夫です、ありがとうございます。</p>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-slate-700">
              クラウドサインを{" "}
              <strong>{formatDateTime(apiResponse?.sentDate)}</strong> に{" "}
              <strong>{apiResponse?.email}</strong> にお送りしています。
            </p>
            <p className="mt-1 text-slate-600">
              メールをご確認の上、締結をお願いします。
            </p>
          </div>

          {/* リマインドボタン */}
          {apiResponse?.canRemind && (
            <div className="text-center">
              {remindSent ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-emerald-700 text-sm font-semibold">
                    リマインドを送付しました
                  </p>
                  <p className="mt-1 text-xs text-emerald-600">
                    メールをご確認ください
                  </p>
                </div>
              ) : (
                <KoutekiButton
                  onClick={handleRemind}
                  disabled={remindLoading}
                  size="lg"
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
                </KoutekiButton>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-100 p-3 text-sm text-rose-600">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // リマインド期限切れ
  if (status === "remind_expired") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<AlertCircle className="h-8 w-8 text-amber-500" />}
          iconBg="bg-amber-50"
          title="すでに登録されている情報が見つかっています"
        >
          <p className="text-center">一度の送信で大丈夫です、ありがとうございます。</p>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <p className="font-semibold text-amber-800 mb-2">
              送付した契約書の期限が切れています
            </p>
            <p className="text-amber-700">
              再度契約書の締結をご希望でしょうか？
              <br />
              ご希望であれば、お手数ですが<strong>公式LINE</strong>へその旨をメッセージしてください。
            </p>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // メールアドレス変更確認
  if (status === "email_diff") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<Mail className="h-8 w-8 text-blue-600" />}
          iconBg="bg-blue-50"
          title="メールアドレスの変更をご希望ですか？"
        >
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">現在のアドレス:</span>{" "}
              {apiResponse?.currentEmail}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-semibold">新しいアドレス:</span>{" "}
              {apiResponse?.newEmail}
            </p>
          </div>
          <p className="text-sm text-slate-600">
            「はい」を押すと、新しいメールアドレス宛に契約書を再送付します。
          </p>
          <div className="flex gap-3 pt-2">
            <KoutekiButton
              variant="outline"
              className="flex-1"
              onClick={() => setStatus("form")}
            >
              いいえ（戻る）
            </KoutekiButton>
            <KoutekiButton className="flex-1" onClick={() => submitForm(true)}>
              はい（変更する）
            </KoutekiButton>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // メールアドレス変更完了
  if (status === "email_changed") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          iconBg="bg-emerald-50"
          title="メールアドレスを変更しました"
        >
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-slate-700">
              <strong>{apiResponse?.email}</strong> 宛に電子契約書を再送付しました。
              <br />
              メールをご確認の上、契約書の締結をお願いいたします。
            </p>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // メールアドレス変更上限
  if (status === "email_change_limit") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<Mail className="h-8 w-8 text-blue-600" />}
          iconBg="bg-blue-50"
          title="メールアドレスの変更をご希望でしょうか？"
        >
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-blue-700">
              お手数ですが、<strong>公式LINE</strong>にお問い合わせください。
            </p>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // 送付エラー / その他エラー（ユーザー向けにはやさしいメッセージ）
  if (status === "send_error" || status === "error") {
    return (
      <KoutekiPageShell title="組合員入会申込フォーム">
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          iconBg="bg-emerald-50"
          title="フォーム回答ありがとうございます"
        >
          <p className="text-center">契約書の送付まで今しばらくお待ちください。</p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // ===== フォーム本体 =====
  const requireCompany =
    formData.memberCategory === "法人担当者" ||
    formData.memberCategory === "代理店";

  return (
    <KoutekiPageShell
      title="組合員入会申込フォーム"
      subtitle="原則として個人での入会を前提としていますが、法人代表者・法人担当者・代理店の方もご入力いただけます。"
    >
      <form onSubmit={handleSubmit}>
        <p className="mb-5 text-xs text-rose-500">* 必須の質問です</p>

        <KoutekiFormStack>
          {/* 入会者区分 */}
          <KoutekiFormField label="入会者区分" required>
            <KoutekiSelect
              value={formData.memberCategory}
              onChange={(e) => handleInputChange("memberCategory", e.target.value)}
              placeholder="選択してください"
            >
              {MEMBER_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </KoutekiSelect>
          </KoutekiFormField>

          {/* LINE名 */}
          <KoutekiFormField
            label="LINE名"
            required
            htmlFor="lineName"
            description={
              lineNameParam
                ? "LINEで登録しているお名前が自動で表示されています。もしご自身のLINE名が表示されていない場合は、ご自身の公式LINEのリンクから再度アクセスしてご回答ください。"
                : "本名ではなく、LINEで登録しているお名前をご記載ください。"
            }
          >
            <KoutekiInput
              id="lineName"
              value={formData.lineName}
              onChange={(e) => handleInputChange("lineName", e.target.value)}
              readOnly={!!lineNameParam && !lineNameEditable}
              className={
                !!lineNameParam && !lineNameEditable
                  ? "bg-slate-50 text-slate-600"
                  : undefined
              }
              placeholder="回答を入力"
            />
            {lineNameParam && !lineNameEditable && (
              <button
                type="button"
                onClick={() => setShowLineNameConfirm(true)}
                className="mt-1 self-start text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900"
              >
                LINE名を修正する
              </button>
            )}
            {showLineNameConfirm && (
              <KoutekiCard variant="ghost" className="mt-2 border-amber-200 bg-amber-50/60">
                <KoutekiCardContent className="space-y-2 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    LINE名はシステムで自動取得しています。通常は正しい名前が表示されていますが、修正しますか？
                  </p>
                  <div className="flex gap-2">
                    <KoutekiButton
                      type="button"
                      size="sm"
                      onClick={() => {
                        setLineNameEditable(true);
                        setShowLineNameConfirm(false);
                      }}
                    >
                      はい、修正します
                    </KoutekiButton>
                    <KoutekiButton
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowLineNameConfirm(false)}
                    >
                      いいえ
                    </KoutekiButton>
                  </div>
                </KoutekiCardContent>
              </KoutekiCard>
            )}
          </KoutekiFormField>

          {/* お名前 */}
          <KoutekiFormField
            label="お名前（フルネーム）"
            required
            htmlFor="name"
            description={
              <>
                漢字でご記載ください
                <br />
                <strong>姓名の間は空けないでください</strong>
              </>
            }
          >
            <KoutekiInput
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="回答を入力"
            />
          </KoutekiFormField>

          {/* 役職 */}
          <KoutekiFormField
            label="役職"
            required
            htmlFor="position"
            description="例：代表取締役／取締役／人事担当／代理店 など"
          >
            <KoutekiInput
              id="position"
              value={formData.position}
              onChange={(e) => handleInputChange("position", e.target.value)}
              placeholder="回答を入力"
            />
          </KoutekiFormField>

          {/* メールアドレス */}
          <KoutekiFormField
            label="メールアドレス"
            required
            htmlFor="email"
            description={
              <>
                電子契約書の送付先となる連絡先です。
                <br />
                ご連絡が取れるメールアドレスをご入力ください。
              </>
            }
          >
            <KoutekiInput
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="回答を入力"
            />
          </KoutekiFormField>

          {/* 電話番号 */}
          <KoutekiFormField
            label="電話番号"
            required
            htmlFor="phone"
            description="一般社団法人 公的制度教育推進協会からのご連絡を受け取ることができる電話番号をご入力ください。"
          >
            <KoutekiInput
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="回答を入力"
            />
          </KoutekiFormField>

          {/* 法人情報 */}
          <KoutekiFormField
            label="法人情報（※法人担当者・代理店の場合は必須）"
            required={requireCompany}
            htmlFor="company"
            description="株式会社／合同会社／有限会社まで正式名称でご記載ください"
          >
            <KoutekiInput
              id="company"
              value={formData.company}
              onChange={(e) => handleInputChange("company", e.target.value)}
              placeholder="回答を入力"
            />
          </KoutekiFormField>

          {/* 住所 */}
          <KoutekiFormField label="住所" required htmlFor="address">
            <KoutekiInput
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              placeholder="回答を入力"
            />
          </KoutekiFormField>

          {/* 個人情報・機密情報の取扱い同意 */}
          <KoutekiCard variant="ghost">
            <KoutekiCardContent className="space-y-3 px-5 py-5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  個人情報・機密情報の取扱い同意
                </span>
                <span className="inline-flex h-5 items-center justify-center rounded-md bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-600">
                  必須
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                機密情報および個人情報の取扱いに関する同意書を確認し、同意します。
              </p>
              <a
                href="https://drive.google.com/file/d/1jI-cUueB5QX5ROLnMgIDtNkIUe94s_7G/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900"
              >
                同意書を確認する（Google Drive）
              </a>
              <div className="pt-1">
                <KoutekiCheckbox
                  checked={formData.privacyAgreed}
                  onChange={(e) =>
                    handleInputChange("privacyAgreed", e.target.checked)
                  }
                >
                  同意する
                </KoutekiCheckbox>
              </div>
            </KoutekiCardContent>
          </KoutekiCard>

          {/* 備考 */}
          <KoutekiFormField label="備考" htmlFor="note">
            <KoutekiTextarea
              id="note"
              value={formData.note}
              onChange={(e) => handleInputChange("note", e.target.value)}
              placeholder="回答を入力"
              rows={4}
            />
          </KoutekiFormField>

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 送信ボタン */}
          <KoutekiButton
            type="submit"
            size="lg"
            className="w-full"
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
          </KoutekiButton>
        </KoutekiFormStack>
      </form>
    </KoutekiPageShell>
  );
}
