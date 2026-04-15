"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  ShieldAlert,
} from "lucide-react";
import {
  KoutekiPageShell,
  KoutekiButton,
  KoutekiInput,
  KoutekiFormField,
  KoutekiFormStack,
  KoutekiCard,
  KoutekiCardContent,
} from "@/components/kouteki";
import { getPublicUid } from "@/lib/slp/public-uid";

type PageStatus =
  | "loading"
  | "no_uid"
  | "form"
  | "submitting"
  | "resolved_signed"
  | "resolved_sent"
  | "resolved_pending"
  | "pending_friend_sync"
  | "pending_staff_review"
  | "email_not_found"
  | "rejected"
  | "error";

function asPageStatus(value: string): PageStatus {
  const known: PageStatus[] = [
    "loading",
    "no_uid",
    "form",
    "submitting",
    "resolved_signed",
    "resolved_sent",
    "resolved_pending",
    "pending_friend_sync",
    "pending_staff_review",
    "email_not_found",
    "rejected",
    "error",
  ];
  return (known as string[]).includes(value)
    ? (value as PageStatus)
    : "pending_staff_review";
}

// =====================================================================
// StatusCard: 結果画面用の共通カード（slp-member と同じトーン）
// =====================================================================
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

// =====================================================================
// 本体
// =====================================================================
function SlpMemberLinkInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [uid, setUid] = useState("");
  const [lineNameEditable, setLineNameEditable] = useState(false);
  const [showLineNameConfirm, setShowLineNameConfirm] = useState(false);
  const lineNameParam = searchParams.get("lineName") || "";

  const [lineName, setLineName] = useState(lineNameParam);
  const [email, setEmail] = useState("");

  // 初期化: uid解決 + プリフィル
  useEffect(() => {
    const init = async () => {
      const resolvedUid = getPublicUid();
      if (!resolvedUid) {
        setStatus("no_uid");
        return;
      }
      setUid(resolvedUid);

      // URLにuidが消えていたら補完
      const sp = new URLSearchParams(window.location.search);
      if (!sp.get("uid")) {
        const url = new URL(window.location.href);
        url.searchParams.set("uid", resolvedUid);
        window.history.replaceState(null, "", url.pathname + url.search);
      }

      try {
        const res = await fetch(
          `/api/public/slp/member-link-prefill?uid=${encodeURIComponent(resolvedUid)}`
        );
        const data = await res.json();

        if (data.type === "redirect_to_member_form") {
          // 既存ユーザー扱い → 通常の組合員フォームへ
          const url = new URL("/form/slp-member", window.location.origin);
          url.searchParams.set("uid", resolvedUid);
          if (lineNameParam) url.searchParams.set("lineName", lineNameParam);
          router.replace(url.pathname + url.search);
          return;
        }

        if (data.type === "no_record") {
          setStatus("form");
          return;
        }
        setStatus(asPageStatus(data.type));
      } catch {
        setStatus("form");
      }
    };

    init();
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // lineNameParamが後から入る場合の同期
  useEffect(() => {
    if (lineNameParam && !lineNameEditable) {
      setLineName(lineNameParam);
    }
  }, [lineNameParam, lineNameEditable]);

  const validate = (): string | null => {
    if (!lineName.trim()) return "LINE名を入力してください";
    if (!email.trim()) return "メールアドレスを入力してください";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "有効なメールアドレスを入力してください";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const error = validate();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/public/slp/member-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          lineName: lineName.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();

      if (data.type === "already_linked") {
        const url = new URL("/form/slp-member", window.location.origin);
        url.searchParams.set("uid", uid);
        if (lineNameParam) url.searchParams.set("lineName", lineNameParam);
        router.replace(url.pathname + url.search);
        return;
      }

      if (data.type === "already_submitted") {
        setStatus(asPageStatus(data.currentType ?? "pending_staff_review"));
        return;
      }

      if (!data.success) {
        setErrorMessage(data.error || "送信に失敗しました");
        setStatus("form");
        return;
      }

      setStatus(asPageStatus(data.type));
    } catch {
      setErrorMessage("通信に失敗しました。時間をおいて再度お試しください");
      setStatus("form");
    }
  };

  // ============================================
  // 画面分岐
  // ============================================
  const TITLE = "公式LINE紐付けフォーム";

  if (status === "loading") {
    return (
      <KoutekiPageShell title={TITLE}>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </KoutekiPageShell>
    );
  }

  if (status === "no_uid") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<ShieldAlert className="h-8 w-8 text-rose-500" />}
          iconBg="bg-rose-50"
          title="公式LINEからアクセスしてください"
        >
          <p>
            このページは公式LINEのリッチメニューからアクセスしてください。
            直接URLを開いた場合は、お手数ですが公式LINEからやり直してください。
          </p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "resolved_signed") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          iconBg="bg-emerald-50"
          title="紐付けが完了しました"
        >
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p>
              すでに組合員契約書をご締結いただいているお客様として確認いたしました。
              <br />
              公式LINEメニューが開放されましたので、画面下のメニューよりご利用ください。
            </p>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "resolved_sent") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          iconBg="bg-emerald-50"
          title="紐付けが完了しました"
        >
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <p className="font-semibold text-amber-800 mb-2">
              組合員契約書の締結をお願いいたします
            </p>
            <p className="text-amber-700">
              現在、組合員契約書をお送りしている状態です。
              メールでお送りしているクラウドサインの内容をご確認のうえ、ご署名をお願いいたします。
              ご署名後、改めて公式LINEメニューが開放されます。
            </p>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "resolved_pending") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<Clock className="h-8 w-8 text-blue-500" />}
          iconBg="bg-blue-50"
          title="ご回答ありがとうございます"
        >
          <p>
            スタッフが内容を確認させていただきます。
            しばらくお待ちください。確認完了後、公式LINEよりご連絡いたします。
          </p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "pending_friend_sync") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<Clock className="h-8 w-8 text-blue-500" />}
          iconBg="bg-blue-50"
          title="少々お待ちください"
        >
          <p>
            お客様の契約書締結状況を確認いたします。
            確認でき次第、公式LINEメッセージでお知らせいたします。
            このページを閉じていただいて構いません。
          </p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "pending_staff_review") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<Clock className="h-8 w-8 text-blue-500" />}
          iconBg="bg-blue-50"
          title="ご回答ありがとうございます"
        >
          <p>
            ご入力いただいた内容を確認させていただきます。
            スタッフの対応までしばらくお待ちください。
            確認完了後、公式LINEよりご連絡いたします。
          </p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "email_not_found") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<Mail className="h-8 w-8 text-amber-500" />}
          iconBg="bg-amber-50"
          title="登録情報が見つかりませんでした"
        >
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 space-y-3">
            <p className="text-amber-800">
              ご入力いただいたメールアドレスでは、弊社で登録されている情報が見つかりませんでした。
            </p>
            <div>
              <p className="font-semibold text-amber-800 mb-1">
                メールアドレスをお間違えの場合
              </p>
              <p className="text-amber-700">
                お手数ですが、公式LINEのトーク画面からスタッフへ正しいメールアドレスをお知らせください。
              </p>
            </div>
            <div>
              <p className="font-semibold text-amber-800 mb-1">
                メールアドレスがお間違いない場合
              </p>
              <p className="text-amber-700">
                公式LINEのトーク画面よりスタッフへその旨ご連絡ください。確認のうえ対応いたします。
              </p>
            </div>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "rejected") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<AlertCircle className="h-8 w-8 text-rose-500" />}
          iconBg="bg-rose-50"
          title="お手続きが完了できません"
        >
          <p>
            お手数ですが、公式LINEのトーク画面よりスタッフまでご連絡ください。
          </p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  if (status === "error") {
    return (
      <KoutekiPageShell title={TITLE}>
        <StatusCard
          icon={<AlertCircle className="h-8 w-8 text-rose-500" />}
          iconBg="bg-rose-50"
          title="エラーが発生しました"
        >
          <p>{errorMessage || "時間をおいて再度お試しください。"}</p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // ===== フォーム本体 =====
  return (
    <KoutekiPageShell
      title={TITLE}
      subtitle="以前に組合員契約書をお送りしたお客様向けのLINE紐付けフォームです。"
    >
      <form onSubmit={handleSubmit}>
        <p className="mb-5 text-xs text-rose-500">* 必須の質問です</p>

        <KoutekiFormStack>
          {/* LINE名 */}
          <KoutekiFormField
            label="LINE名"
            required
            htmlFor="lineName"
            description={
              lineNameParam
                ? "LINEで登録しているお名前が自動で表示されています。もしご自身のLINE名が表示されていない場合は、ご自身の公式LINEのリンクから再度アクセスしてご回答ください。"
                : "LINEで登録しているお名前をご記載ください。"
            }
          >
            <KoutekiInput
              id="lineName"
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
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
              <KoutekiCard
                variant="ghost"
                className="mt-2 border-amber-200 bg-amber-50/60"
              >
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

          {/* メールアドレス */}
          <KoutekiFormField
            label="メールアドレス"
            required
            htmlFor="email"
            description="以前に組合員契約書（クラウドサイン）のメールを受け取ったメールアドレスをご入力ください。"
          >
            <KoutekiInput
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="taro@example.com"
            />
          </KoutekiFormField>

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <KoutekiButton
              type="submit"
              size="lg"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                "送信する"
              )}
            </KoutekiButton>
          </div>
        </KoutekiFormStack>
      </form>
    </KoutekiPageShell>
  );
}

export default function SlpMemberLinkPage() {
  return (
    <Suspense
      fallback={
        <KoutekiPageShell title="公式LINE紐付けフォーム">
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        </KoutekiPageShell>
      }
    >
      <SlpMemberLinkInner />
    </Suspense>
  );
}
