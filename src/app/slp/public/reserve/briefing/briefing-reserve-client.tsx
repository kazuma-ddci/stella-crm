"use client";

import { useState, useMemo } from "react";
import {
  KoutekiCard,
  KoutekiCardContent,
  KoutekiCardHeader,
  KoutekiCardTitle,
  KoutekiButton,
  KoutekiInput,
  KoutekiSectionHeader,
} from "@/components/kouteki";
import { CheckCircle2, AlertCircle, ExternalLink, Calendar, Loader2 } from "lucide-react";
import { createBriefingPendingAction } from "./actions";

type CompanyRow = {
  recordId: number;
  companyName: string | null;
  briefingStatus: string | null;
  briefingDate: string | null;
  briefingHasReservation: boolean;
  briefingCompleted: boolean;
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

  // 既に予約中の企業を上に、予約可能な企業を下に
  const reservableCompanies = useMemo(
    () => companies.filter((c) => !c.briefingHasReservation && !c.briefingCompleted),
    [companies]
  );
  const reservedCompanies = useMemo(
    () => companies.filter((c) => c.briefingHasReservation || c.briefingCompleted),
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
      setStep({
        type: "ready",
        calendarUrl: result.calendarUrl,
        expectedCompanyName: result.expectedCompanyName,
      });
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
            この企業の概要案内予約として処理されます。
          </p>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            ⚠️ 次の予約画面では「企業名」が編集可能な状態で表示されますが、
            <strong>編集しないでください</strong>。
            <br />
            別の企業を予約したい場合は、このページに戻ってもう一度やり直してください。
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
          }}
          className="w-full text-xs text-slate-500 underline hover:text-slate-700"
        >
          別の企業を選び直す
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
          <KoutekiSectionHeader title="あなたが担当している企業" />

          {reservableCompanies.length > 0 && (
            <div className="space-y-2 mt-3">
              {reservableCompanies.map((c) => (
                <KoutekiCard key={c.recordId}>
                  <KoutekiCardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {c.companyName ?? "(企業名未登録)"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          概要案内: 未予約
                        </p>
                      </div>
                      <KoutekiButton
                        size="sm"
                        onClick={() => handleSelectExisting(c.recordId)}
                      >
                        この企業で予約する
                      </KoutekiButton>
                    </div>
                  </KoutekiCardContent>
                </KoutekiCard>
              ))}
            </div>
          )}

          {reservedCompanies.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs text-slate-500">予約済み・完了済みの企業</p>
              {reservedCompanies.map((c) => (
                <div
                  key={c.recordId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-medium text-slate-700">
                    {c.companyName ?? "(企業名未登録)"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {c.briefingCompleted
                      ? "概要案内: 完了"
                      : `概要案内: ${c.briefingDate ? formatDate(c.briefingDate) : ""} で予約中`}
                  </p>
                  {c.briefingHasReservation && (
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
        <KoutekiSectionHeader title="新しい企業の概要案内を予約する" />

        {!showNewForm ? (
          <div className="mt-3">
            <KoutekiButton
              variant="outline"
              className="w-full"
              onClick={() => setShowNewForm(true)}
            >
              + 新しい企業として予約する
            </KoutekiButton>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                会社名 <span className="text-red-500">*</span>
              </label>
              <KoutekiInput
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="株式会社○○"
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
                  ⚠️ 類似する企業が既に登録されています
                </p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {similarCompanies.map((c) => (
                    <li key={c.recordId}>
                      ・{c.companyName ?? "(企業名未登録)"}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 mt-2">
                  同じ企業の場合は上のリストから選択してください。
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <KoutekiButton
                variant="outline"
                onClick={() => {
                  setShowNewForm(false);
                  setNewCompanyName("");
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
