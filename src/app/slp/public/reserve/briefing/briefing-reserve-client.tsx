"use client";

import { useState, useMemo } from "react";
import {
  KoutekiCard,
  KoutekiCardContent,
  KoutekiButton,
  KoutekiInput,
  KoutekiSectionHeader,
} from "@/components/kouteki";
import { CheckCircle2, AlertCircle, ExternalLink, Calendar, Loader2 } from "lucide-react";
import { createBriefingPendingAction } from "./actions";

type CompanyRow = {
  recordId: number;
  companyName: string | null;
  businessType: string | null;
  /** 予約中 or 未予約セッションがある（新規予約不可） */
  briefingHasActiveReservation: boolean;
  /** 過去に完了セッションがある（再予約可） */
  briefingCompletedOnce: boolean;
  /** アクティブセッションの日時（ISO） */
  briefingActiveScheduledAt: string | null;
  /** アクティブセッションのソース（手動セットは変更不可表示） */
  briefingActiveSource: "proline" | "manual" | null;
};

type Props = {
  uid: string;
  snsname: string | null;
  companies: CompanyRow[];
  bookingHistoryUrl: string;
};

type Step =
  | { type: "select" }
  | { type: "submitting" }
  | { type: "ready"; calendarUrl: string; expectedCompanyName: string }
  | { type: "error"; message: string };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

export function BriefingReserveClient({
  uid,
  companies,
  bookingHistoryUrl,
}: Props) {
  const [step, setStep] = useState<Step>({ type: "select" });
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newBusinessType, setNewBusinessType] = useState("corporation");

  // アクティブ予約がない = 予約可能（「完了済み + 追加予約」も含む）
  const reservableCompanies = useMemo(
    () => companies.filter((c) => !c.briefingHasActiveReservation),
    [companies]
  );
  // アクティブ予約がある = 予約済み（別途表示）
  const reservedCompanies = useMemo(
    () => companies.filter((c) => c.briefingHasActiveReservation),
    [companies]
  );

  // 類似企業のサジェスト（部分一致）
  const similarCompanies = useMemo(() => {
    const q = newCompanyName.trim().toLowerCase();
    if (!q) return [];
    return companies.filter((c) =>
      c.companyName?.toLowerCase().includes(q)
    );
  }, [newCompanyName, companies]);

  const handleSelectExisting = async (recordId: number) => {
    setStep({ type: "submitting" });
    const result = await createBriefingPendingAction({
      uid,
      companyRecordIds: [recordId],
    });
    if (result.success) {
      // 既存事業者も準備完了画面をスキップして直接予約フォームに遷移（外部URL）
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = result.calendarUrl;
    } else {
      setStep({ type: "error", message: result.error });
    }
  };

  const handleSubmitNew = async () => {
    if (!newCompanyName.trim()) return;
    setStep({ type: "submitting" });
    const result = await createBriefingPendingAction({
      uid,
      newCompanyName: newCompanyName.trim(),
      businessType: newBusinessType,
    });
    if (result.success) {
      // 新規会社の場合は準備完了画面をスキップして直接プロラインの予約フォームに遷移
      window.location.href = result.calendarUrl;
    } else {
      setStep({ type: "error", message: result.error });
    }
  };

  // 完了画面
  if (step.type === "ready") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-blue-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            ご予約準備が完了しました
          </h2>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-blue-700">
              {step.expectedCompanyName}
            </span>
            <br />
            この事業者の概要案内予約として処理されます。
          </p>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            ⚠️ 次の予約画面では「企業名」が編集可能な状態で表示されますが、
            <strong>編集しないでください</strong>。
            <br />
            別の事業者を予約したい場合は、このページに戻ってもう一度やり直してください。
          </p>
        </div>

        <a
          href={step.calendarUrl}
          className="block w-full"
        >
          <KoutekiButton className="w-full text-base py-6">
            <Calendar className="h-5 w-5 mr-2" />
            予約フォームを開く
            <ExternalLink className="h-4 w-4 ml-2" />
          </KoutekiButton>
        </a>

        <button
          type="button"
          onClick={() => {
            setStep({ type: "select" });
            setNewCompanyName("");
            setShowNewForm(false);
            setNewBusinessType("corporation");
          }}
          className="w-full text-xs text-slate-500 underline hover:text-slate-700"
        >
          別の事業者を選び直す
        </button>
      </div>
    );
  }

  // 送信中
  if (step.type === "submitting") {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-slate-600">予約準備中です...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 予約履歴・変更・キャンセルへの導線 */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
        <p className="text-xs text-slate-600 mb-2">
          予約済みの内容を変更・キャンセルする場合は、こちらから
        </p>
        <a
          href={bookingHistoryUrl}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          予約履歴・変更・キャンセル
        </a>
      </div>

      {step.type === "error" && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">{step.message}</p>
        </div>
      )}

      {/* 既に担当している企業のリスト */}
      {companies.length > 0 && (
        <div>
          <KoutekiSectionHeader title="あなたが担当している事業者" />

          {reservableCompanies.length > 0 && (
            <div className="space-y-2 mt-3">
              {reservableCompanies.map((c) => (
                <KoutekiCard key={c.recordId}>
                  <KoutekiCardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">
                            {c.companyName ?? "(事業者名未登録)"}
                          </p>
                          {c.businessType && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                              {c.businessType === "sole_proprietor" ? "個人事業主" : "法人"}
                            </span>
                          )}
                          {c.briefingCompletedOnce && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 whitespace-nowrap">
                              実施済み
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {c.briefingCompletedOnce
                            ? "概要案内: 実施済み（追加予約可）"
                            : "概要案内: 未予約"}
                        </p>
                      </div>
                      <KoutekiButton
                        size="sm"
                        onClick={() => handleSelectExisting(c.recordId)}
                      >
                        {c.briefingCompletedOnce ? "追加で予約する" : "この事業者で予約する"}
                      </KoutekiButton>
                    </div>
                  </KoutekiCardContent>
                </KoutekiCard>
              ))}
            </div>
          )}

          {reservedCompanies.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs text-slate-500">予約済みの事業者</p>
              {reservedCompanies.map((c) => (
                <div
                  key={c.recordId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700">
                      {c.companyName ?? "(事業者名未登録)"}
                    </p>
                    {c.businessType && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                        {c.businessType === "sole_proprietor" ? "個人事業主" : "法人"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {c.briefingActiveScheduledAt
                      ? `概要案内: ${formatDate(c.briefingActiveScheduledAt)} で予約中`
                      : "概要案内: 予約中（日時未確定）"}
                  </p>
                  {c.briefingActiveSource === "manual" ? (
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      ※ こちらの予約は担当者が直接お取りしたものです。変更・キャンセルは
                      <strong>公式LINEへ直接ご連絡</strong>ください。
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      変更・キャンセルは上記の予約履歴から
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 新しい企業として予約 */}
      <div>
        <KoutekiSectionHeader title="新しい事業者の概要案内を予約する" />

        {!showNewForm ? (
          <div className="mt-3">
            <KoutekiButton
              variant="outline"
              className="w-full"
              onClick={() => setShowNewForm(true)}
            >
              + 新しい事業者として予約する
            </KoutekiButton>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                事業形態 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                {[
                  { value: "corporation", label: "法人" },
                  { value: "sole_proprietor", label: "個人事業主" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="newBusinessType"
                      value={opt.value}
                      checked={newBusinessType === opt.value}
                      onChange={(e) => setNewBusinessType(e.target.value)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {newBusinessType === "sole_proprietor" ? "屋号(個人名可)" : "企業名"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <KoutekiInput
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder={
                  newBusinessType === "sole_proprietor"
                    ? "○○商店 / 山田太郎"
                    : "株式会社○○"
                }
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                ※ 複数の会社の概要案内を一度に受けられる場合は、カンマ区切りでご入力ください。
                <br />
                　例: 株式会社ABC, 株式会社XYZ
              </p>
            </div>

            {similarCompanies.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-800 font-medium mb-1.5">
                  ⚠️ 類似する事業者が既に登録されています
                </p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {similarCompanies.map((c) => (
                    <li key={c.recordId}>
                      ・{c.companyName ?? "(事業者名未登録)"}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 mt-2">
                  同じ事業者の場合は上のリストから選択してください。
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <KoutekiButton
                variant="outline"
                onClick={() => {
                  setShowNewForm(false);
                  setNewCompanyName("");
                  setNewBusinessType("corporation");
                }}
              >
                戻る
              </KoutekiButton>
              <KoutekiButton
                className="flex-1"
                onClick={handleSubmitNew}
                disabled={!newCompanyName.trim()}
              >
                予約に進む →
              </KoutekiButton>
            </div>
          </div>
        )}
      </div>

      {/* 注意事項 */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-800 leading-relaxed">
          ⚠️ 複数の予約を同時に進めないでください。
          <br />
          先に開始した予約を完了させてから次の予約を始めてください。
        </p>
      </div>
    </div>
  );
}
