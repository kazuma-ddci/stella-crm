"use client";

import { useState, useMemo } from "react";
import {
  KoutekiCard,
  KoutekiCardContent,
  KoutekiButton,
  KoutekiSectionHeader,
} from "@/components/kouteki";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Calendar,
  Loader2,
} from "lucide-react";
import { createConsultationPendingAction } from "./actions";

type CompanyRow = {
  recordId: number;
  companyName: string | null;
  businessType: string | null;
  briefingStatus: string | null;
  briefingCompleted: boolean;
  consultationStatus: string | null;
  consultationDate: string | null;
  consultationHasReservation: boolean;
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

export function ConsultationReserveClient({
  uid,
  companies,
  bookingHistoryUrl,
}: Props) {
  const [step, setStep] = useState<Step>({ type: "select" });

  // 概要案内が完了 + 導入希望商談が未予約の企業（予約可能）
  const reservableCompanies = useMemo(
    () =>
      companies.filter(
        (c) => c.briefingCompleted && !c.consultationHasReservation
      ),
    [companies]
  );

  // 概要案内未完了 or 導入希望商談予約済み（参考表示）
  const briefingNotCompletedCompanies = useMemo(
    () => companies.filter((c) => !c.briefingCompleted),
    [companies]
  );
  const consultationReservedCompanies = useMemo(
    () =>
      companies.filter(
        (c) => c.briefingCompleted && c.consultationHasReservation
      ),
    [companies]
  );

  const handleSelect = async (recordId: number) => {
    setStep({ type: "submitting" });
    const result = await createConsultationPendingAction({
      uid,
      companyRecordId: recordId,
    });
    if (result.success) {
      setStep({
        type: "ready",
        calendarUrl: result.calendarUrl,
        expectedCompanyName: result.expectedCompanyName,
      });
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
            この事業者の導入希望商談予約として処理されます。
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

        <a href={step.calendarUrl} className="block w-full">
          <KoutekiButton className="w-full text-base py-6">
            <Calendar className="h-5 w-5 mr-2" />
            予約フォームを開く
            <ExternalLink className="h-4 w-4 ml-2" />
          </KoutekiButton>
        </a>

        <button
          type="button"
          onClick={() => setStep({ type: "select" })}
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

      <div className="rounded-xl bg-blue-50/60 border border-blue-200/80 p-4">
        <p className="text-sm text-slate-700 leading-relaxed">
          📌 <strong>導入希望商談</strong>は、概要案内が
          <strong className="text-blue-700">完了している事業者</strong>のみ予約できます。
        </p>
      </div>

      {/* 予約可能な企業 */}
      {reservableCompanies.length > 0 ? (
        <div>
          <KoutekiSectionHeader title="予約できる事業者" />
          <div className="space-y-2 mt-3">
            {reservableCompanies.map((c) => (
              <KoutekiCard key={c.recordId}>
                <KoutekiCardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 truncate">
                          {c.companyName ?? "(事業者名未登録)"}
                        </p>
                        {c.businessType && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                            {c.businessType === "sole_proprietor" ? "個人事業主" : "法人"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                        <p>概要案内: 完了 ✓</p>
                        <p>導入希望商談: 未予約</p>
                      </div>
                    </div>
                    <KoutekiButton
                      size="sm"
                      onClick={() => handleSelect(c.recordId)}
                    >
                      この事業者で予約する
                    </KoutekiButton>
                  </div>
                </KoutekiCardContent>
              </KoutekiCard>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-600">
            現在、導入希望商談を予約できる事業者はありません。
          </p>
        </div>
      )}

      {/* 予約済み企業の参考表示 */}
      {consultationReservedCompanies.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">予約済みの事業者</p>
          <div className="space-y-2">
            {consultationReservedCompanies.map((c) => (
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
                  {c.consultationDate
                    ? `導入希望商談: ${formatDate(c.consultationDate)} で予約中`
                    : "導入希望商談: 予約中"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  変更・キャンセルは上記の予約履歴から
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 概要案内未完了の企業（参考表示） */}
      {briefingNotCompletedCompanies.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">
            まだ概要案内が完了していない事業者
          </p>
          <div className="space-y-2">
            {briefingNotCompletedCompanies.map((c) => (
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
                  概要案内: {c.briefingStatus ?? "未予約"}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  ↳ 概要案内を完了してから予約できます
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-800 leading-relaxed">
          ⚠️ 表示されない事業者の導入希望商談をご希望の場合は、
          まず「概要案内」のご予約からお願いします。
          <br />
          ⚠️ 複数の予約を同時に進めないでください。
        </p>
      </div>
    </div>
  );
}
