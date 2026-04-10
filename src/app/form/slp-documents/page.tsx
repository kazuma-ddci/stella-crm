"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Loader2,
  Building2,
  ChevronRight,
  ChevronLeft,
  FileText,
  FolderPlus,
  CheckCircle2,
} from "lucide-react";
import {
  KoutekiPageShell,
  KoutekiCard,
  KoutekiCardContent,
  KoutekiButton,
} from "@/components/kouteki";
import { SlpInitialDocumentsForm } from "@/components/slp/slp-initial-documents-form";
import { SlpAdditionalDocumentsForm } from "@/components/slp/slp-additional-documents-form";
import type {
  SlpDocumentEntry,
  SlpCompanyOption,
  SlpDocumentUploadFn,
  SlpDocumentUrlFn,
} from "@/components/slp/slp-document-form-types";
import {
  INITIAL_DOCUMENT_TYPES,
  FISCAL_PERIODS,
} from "@/lib/slp/document-types";
import { getPublicUid } from "@/lib/slp/public-uid";

type Category = "initial" | "additional";

type Phase =
  | { phase: "loading" }
  | { phase: "error"; reason: string }
  | {
      phase: "select-company";
      companies: SlpCompanyOption[];
      uid: string;
      snsname: string;
    }
  | {
      phase: "select-category";
      uid: string;
      snsname: string;
      company: SlpCompanyOption;
      documents: SlpDocumentEntry[];
      /** 複数企業がある場合に「企業選択に戻る」を表示するため */
      companies: SlpCompanyOption[] | null;
    }
  | {
      phase: "form";
      uid: string;
      snsname: string;
      company: SlpCompanyOption;
      documents: SlpDocumentEntry[];
      category: Category;
      companies: SlpCompanyOption[] | null;
    };

/** 初回書類の提出済みスロット数（最大15件）を計算 */
function countInitialSubmittedSlots(documents: SlpDocumentEntry[]): number {
  const slots = new Set<string>();
  for (const d of documents) {
    if (d.category !== "initial") continue;
    if (!d.isCurrent) continue;
    if (d.fiscalPeriod == null) continue;
    slots.add(`${d.documentType}#${d.fiscalPeriod}`);
  }
  return slots.size;
}

/** 追加書類の提出済み件数（isCurrent のもの）を計算 */
function countAdditionalSubmitted(documents: SlpDocumentEntry[]): number {
  return documents.filter((d) => d.category === "additional" && d.isCurrent)
    .length;
}

export default function SlpDocumentsPage() {
  const [state, setState] = useState<Phase>({ phase: "loading" });

  const fetchInit = useCallback(
    async (uid: string, companyRecordId?: number) => {
      const params = new URLSearchParams({ uid });
      if (companyRecordId != null) {
        params.set("companyRecordId", String(companyRecordId));
      }
      const res = await fetch(
        `/api/public/slp/company-documents/init?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      return { ok: res.ok, data };
    },
    [],
  );

  // 初期ロード: uid 取得 + 企業一覧取得
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // URL クエリまたは sessionStorage から uid を取得
      // リロード時や URL からクエリが消えた場合も sessionStorage から復元
      const uid = getPublicUid();
      if (!uid) {
        if (!cancelled) setState({ phase: "error", reason: "missing_uid" });
        return;
      }

      // URL に uid が含まれていなければ付け直しておく（以降のリロードに備える）
      const sp = new URLSearchParams(window.location.search);
      if (!sp.get("uid")) {
        const url = new URL(window.location.href);
        url.searchParams.set("uid", uid);
        window.history.replaceState(null, "", url.pathname + url.search);
      }

      try {
        const { ok, data } = await fetchInit(uid);
        if (cancelled) return;
        if (!ok || !data?.authorized) {
          setState({
            phase: "error",
            reason: data?.reason ?? "uid_not_found",
          });
          return;
        }
        const companies: SlpCompanyOption[] = data.companies ?? [];
        if (companies.length === 0) {
          setState({ phase: "error", reason: "no_companies" });
          return;
        }
        if (companies.length === 1) {
          // 自動選択 → カテゴリ選択画面へ
          const { ok: ok2, data: data2 } = await fetchInit(
            uid,
            companies[0].id,
          );
          if (cancelled) return;
          if (!ok2 || !data2?.authorized) {
            setState({
              phase: "error",
              reason: data2?.reason ?? "uid_not_found",
            });
            return;
          }
          setState({
            phase: "select-category",
            uid: data2.uid ?? uid,
            snsname: data2.snsname ?? "",
            company: companies[0],
            documents: (data2.documents ?? []) as SlpDocumentEntry[],
            companies: null, // 1社しかないので「企業選び直す」ボタンは出さない
          });
          return;
        }
        setState({
          phase: "select-company",
          companies,
          uid: data.uid ?? uid,
          snsname: data.snsname ?? "",
        });
      } catch (err) {
        console.error("[SLP_DOCUMENTS_INIT_ERROR]", err);
        if (!cancelled) setState({ phase: "error", reason: "error" });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fetchInit]);

  // 企業選択 → カテゴリ選択画面へ
  const handleSelectCompany = useCallback(
    async (company: SlpCompanyOption) => {
      if (state.phase !== "select-company") return;
      const prevState = state;
      setState({ phase: "loading" });
      try {
        const { ok, data } = await fetchInit(prevState.uid, company.id);
        if (!ok || !data?.authorized) {
          setState({
            phase: "error",
            reason: data?.reason ?? "uid_not_found",
          });
          return;
        }
        setState({
          phase: "select-category",
          uid: data.uid ?? prevState.uid,
          snsname: data.snsname ?? prevState.snsname,
          company,
          documents: (data.documents ?? []) as SlpDocumentEntry[],
          companies: prevState.companies,
        });
      } catch {
        setState({ phase: "error", reason: "error" });
      }
    },
    [fetchInit, state],
  );

  // カテゴリ選択 → フォームへ
  const handleSelectCategory = useCallback(
    (category: Category) => {
      if (state.phase !== "select-category") return;
      setState({
        phase: "form",
        uid: state.uid,
        snsname: state.snsname,
        company: state.company,
        documents: state.documents,
        category,
        companies: state.companies,
      });
    },
    [state],
  );

  // フォーム → カテゴリ選択へ戻る
  const handleBackToCategory = useCallback(async () => {
    if (state.phase !== "form") return;
    // 最新の書類一覧を再取得してから戻る
    setState({ phase: "loading" });
    try {
      const { ok, data } = await fetchInit(state.uid, state.company.id);
      if (!ok || !data?.authorized) {
        setState({
          phase: "error",
          reason: data?.reason ?? "uid_not_found",
        });
        return;
      }
      setState({
        phase: "select-category",
        uid: state.uid,
        snsname: state.snsname,
        company: state.company,
        documents: (data.documents ?? []) as SlpDocumentEntry[],
        companies: state.companies,
      });
    } catch {
      setState({ phase: "error", reason: "error" });
    }
  }, [fetchInit, state]);

  // カテゴリ選択 → 企業選択に戻る（複数企業の場合のみ）
  const handleBackToCompany = useCallback(() => {
    if (state.phase !== "select-category") return;
    if (!state.companies) return;
    setState({
      phase: "select-company",
      companies: state.companies,
      uid: state.uid,
      snsname: state.snsname,
    });
  }, [state]);

  // 書類一覧の再取得（フォーム内アップロード後に呼ばれる）
  const refresh = useCallback(async () => {
    if (state.phase !== "form") return;
    const { ok, data } = await fetchInit(state.uid, state.company.id);
    if (ok && data?.authorized) {
      setState({
        ...state,
        documents: (data.documents ?? []) as SlpDocumentEntry[],
      });
    }
  }, [fetchInit, state]);

  // アップロード関数
  const uploadFile = useMemo<SlpDocumentUploadFn>(
    () =>
      async ({ documentType, fiscalPeriod, file }) => {
        if (state.phase !== "form")
          return { success: false, error: "未初期化" };
        const fd = new FormData();
        fd.set("uid", state.uid);
        fd.set("companyRecordId", String(state.company.id));
        fd.set("category", state.category);
        fd.set("documentType", documentType);
        if (fiscalPeriod != null) fd.set("fiscalPeriod", String(fiscalPeriod));
        fd.set("file", file);
        try {
          const res = await fetch("/api/public/slp/company-documents/upload", {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            return {
              success: false,
              error: data.error ?? "アップロードに失敗しました",
            };
          }
          await refresh();
          return { success: true };
        } catch {
          return { success: false, error: "通信エラーが発生しました" };
        }
      },
    [state, refresh],
  );

  const previewUrl = useCallback<SlpDocumentUrlFn>(
    (documentId: number) => {
      if (state.phase !== "form") return "#";
      const params = new URLSearchParams({
        id: String(documentId),
        uid: state.uid,
      });
      return `/api/public/slp/company-documents/file?${params.toString()}`;
    },
    [state],
  );

  // ============================================
  // ページレンダリング
  // ============================================

  // フォーム画面のタイトル
  const formTitle =
    state.phase === "form"
      ? state.category === "initial"
        ? "初回提出書類"
        : "追加提出書類"
      : "書類提出";

  const formSubtitle =
    state.phase === "form"
      ? state.category === "initial"
        ? "源泉徴収簿・算定基礎届・賃金台帳について、直近期から4期前まで5期分の書類を提出してください。"
        : "被保険者資格取得届・月額変更届・賞与支払届・標準報酬決定通知書を提出してください。"
      : "書類の提出が必要な企業を選択してください";

  return (
    <KoutekiPageShell
      title={formTitle}
      subtitle={formSubtitle}
      maxWidth="2xl"
    >
      {/* ローディング */}
      {state.phase === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="size-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      )}

      {/* エラー */}
      {state.phase === "error" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="inline-flex size-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <ShieldAlert className="size-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            フォームにアクセスできません
          </h3>
          <p className="max-w-md text-sm leading-relaxed text-slate-600 whitespace-pre-line">
            {state.reason === "no_companies"
              ? "お客様が担当している企業が見つかりませんでした。\n担当している企業がある場合は、お手数ですが公式LINEよりご連絡ください。"
              : "ご自身の公式LINE上からもう一度フォームにアクセスしてください。"}
          </p>
          <p className="mt-1 text-[11px] tracking-wider text-slate-400">
            REASON: {state.reason}
          </p>
        </div>
      )}

      {/* 企業選択 */}
      {state.phase === "select-company" && (
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{state.snsname}</span> 様 /
              担当企業を選択してください
            </p>
            <p className="mt-1 text-xs text-slate-500">
              書類を提出する企業を選択してください。
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {state.companies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCompany(c)}
                className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Building2 className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {c.name}
                  </span>
                </span>
                <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-700" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* カテゴリ選択 */}
      {state.phase === "select-category" && (
        <CategorySelectView
          company={state.company}
          snsname={state.snsname}
          documents={state.documents}
          canGoBackToCompany={!!state.companies}
          onBackToCompany={handleBackToCompany}
          onSelectCategory={handleSelectCategory}
        />
      )}

      {/* 書類フォーム */}
      {state.phase === "form" && (
        <div className="space-y-4">
          {/* 戻る + 提出者情報 */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToCategory}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <ChevronLeft className="size-3.5" />
              カテゴリ選択に戻る
            </button>
          </div>

          {/* 提出者バー */}
          <KoutekiCard variant="ghost">
            <KoutekiCardContent className="px-5 py-4">
              <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-semibold text-slate-900">
                    {state.company.name}
                  </span>
                  <span className="ml-2 text-slate-500">
                    / 提出者: {state.snsname || "—"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  既に提出された書類はそのまま保持されます。差し替え・追加のみ操作してください。
                </div>
              </div>
            </KoutekiCardContent>
          </KoutekiCard>

          {/* カテゴリ別のフォーム */}
          {state.category === "initial" ? (
            <SlpInitialDocumentsForm
              documents={state.documents}
              uploadFile={uploadFile}
              previewUrl={previewUrl}
            />
          ) : (
            <SlpAdditionalDocumentsForm
              documents={state.documents}
              uploadFile={uploadFile}
              previewUrl={previewUrl}
            />
          )}
        </div>
      )}
    </KoutekiPageShell>
  );
}

// ============================================
// カテゴリ選択画面
// ============================================

function CategorySelectView({
  company,
  snsname,
  documents,
  canGoBackToCompany,
  onBackToCompany,
  onSelectCategory,
}: {
  company: SlpCompanyOption;
  snsname: string;
  documents: SlpDocumentEntry[];
  canGoBackToCompany: boolean;
  onBackToCompany: () => void;
  onSelectCategory: (category: Category) => void;
}) {
  const totalSlots = INITIAL_DOCUMENT_TYPES.length * FISCAL_PERIODS.length; // 3 × 5 = 15
  const initialSubmitted = countInitialSubmittedSlots(documents);
  const additionalCount = countAdditionalSubmitted(documents);
  const initialComplete = initialSubmitted >= totalSlots;

  return (
    <div className="space-y-5">
      {/* 戻るボタン（複数企業の場合のみ） */}
      {canGoBackToCompany && (
        <div>
          <button
            type="button"
            onClick={onBackToCompany}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <ChevronLeft className="size-3.5" />
            企業選択に戻る
          </button>
        </div>
      )}

      {/* 対象企業 */}
      <KoutekiCard variant="ghost">
        <KoutekiCardContent className="px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {company.name}
              </p>
              <p className="text-[11px] text-slate-500">
                提出者: {snsname || "—"}
              </p>
            </div>
          </div>
        </KoutekiCardContent>
      </KoutekiCard>

      {/* カテゴリ選択カード */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">
          提出する書類の種類を選択してください
        </p>

        {/* 初回提出書類 */}
        <button
          type="button"
          onClick={() => onSelectCategory("initial")}
          className="group w-full text-left"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-[0_8px_24px_-18px_rgba(15,30,80,0.35)]">
            <div className="flex items-start gap-4">
              <div className="inline-flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <FileText className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold tracking-tight text-slate-900">
                    初回提出書類
                  </h3>
                  {initialComplete ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded-md bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700">
                      <CheckCircle2 className="size-3" />
                      全件提出済み
                    </span>
                  ) : (
                    <span className="inline-flex h-5 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                      {initialSubmitted} / {totalSlots} 件 提出済み
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  源泉徴収簿・算定基礎届・賃金台帳について、直近期から4期前まで5期分
                </p>
              </div>
              <ChevronRight className="size-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-700" />
            </div>
          </div>
        </button>

        {/* 追加提出書類 */}
        <button
          type="button"
          onClick={() => onSelectCategory("additional")}
          className="group w-full text-left"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-[0_8px_24px_-18px_rgba(15,30,80,0.35)]">
            <div className="flex items-start gap-4">
              <div className="inline-flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <FolderPlus className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold tracking-tight text-slate-900">
                    追加提出書類
                  </h3>
                  <span className="inline-flex h-5 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                    {additionalCount} 件 提出済み
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  被保険者資格取得届・月額変更届・賞与支払届・標準報酬決定通知書
                </p>
              </div>
              <ChevronRight className="size-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-700" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
