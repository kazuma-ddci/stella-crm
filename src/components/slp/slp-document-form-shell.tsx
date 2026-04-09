"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Loader2, Building2, ChevronRight } from "lucide-react";
import {
  KoutekiPageShell,
  KoutekiCard,
  KoutekiCardContent,
} from "@/components/kouteki";
import type {
  SlpDocumentCategory,
  SlpDocumentType,
} from "@/lib/slp/document-types";

export type SlpDocumentEntry = {
  id: number;
  category: string;
  documentType: string;
  fiscalPeriod: number | null;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  isCurrent: boolean;
  uploadedByName: string | null;
  uploadedByUid: string | null;
  createdAt: string;
};

export type SlpCompanyOption = {
  id: number;
  name: string;
};

export type SlpDocumentFormChildrenProps = {
  uid: string;
  snsname: string;
  company: SlpCompanyOption;
  documents: SlpDocumentEntry[];
  /** uploads file & refreshes documents on success */
  uploadFile: (params: {
    documentType: SlpDocumentType;
    fiscalPeriod?: number | null;
    file: File;
  }) => Promise<{ success: boolean; error?: string }>;
  /** force re-fetch document list */
  refresh: () => Promise<void>;
  /** プレビューURL (新しいタブで開ける) */
  previewUrl: (documentId: number) => string;
  /** ダウンロード用URL */
  downloadUrl: (documentId: number) => string;
};

type Props = {
  category: SlpDocumentCategory;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: (args: SlpDocumentFormChildrenProps) => React.ReactNode;
};

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; reason: string }
  | {
      phase: "select-company";
      companies: SlpCompanyOption[];
      uid: string;
      snsname: string;
    }
  | {
      phase: "ready";
      uid: string;
      snsname: string;
      company: SlpCompanyOption;
      documents: SlpDocumentEntry[];
    };

/**
 * SLP公的提出書類フォームの共通シェル
 *
 * - URLパラメータの uid を検証
 * - 担当企業の取得・選択
 * - 既存提出書類のロード
 * - 子コンポーネント (children) に uid / company / documents / アップロード関数を渡す
 *
 * `category` は "initial" or "additional"。両フォームで同じシェルを使い、書類UIだけ
 * children のレンダープロップで切り替える。
 */
export function SlpDocumentFormShell({
  category,
  title,
  subtitle,
  children,
}: Props) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

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
      const sp = new URLSearchParams(window.location.search);
      const uid = sp.get("uid")?.trim();
      if (!uid) {
        if (!cancelled) setState({ phase: "error", reason: "missing_uid" });
        return;
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
          // 自動選択 → 書類取得
          const { ok: ok2, data: data2 } = await fetchInit(uid, companies[0].id);
          if (cancelled) return;
          if (!ok2 || !data2?.authorized) {
            setState({
              phase: "error",
              reason: data2?.reason ?? "uid_not_found",
            });
            return;
          }
          setState({
            phase: "ready",
            uid: data2.uid ?? uid,
            snsname: data2.snsname ?? "",
            company: companies[0],
            documents: (data2.documents ?? []) as SlpDocumentEntry[],
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
        console.error("[SLP_DOC_FORM_INIT_ERROR]", err);
        if (!cancelled) setState({ phase: "error", reason: "error" });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fetchInit]);

  const handleSelectCompany = useCallback(
    async (company: SlpCompanyOption) => {
      if (state.phase !== "select-company") return;
      setState({ phase: "loading" });
      try {
        const { ok, data } = await fetchInit(state.uid, company.id);
        if (!ok || !data?.authorized) {
          setState({
            phase: "error",
            reason: data?.reason ?? "uid_not_found",
          });
          return;
        }
        setState({
          phase: "ready",
          uid: data.uid ?? state.uid,
          snsname: data.snsname ?? state.snsname,
          company,
          documents: (data.documents ?? []) as SlpDocumentEntry[],
        });
      } catch {
        setState({ phase: "error", reason: "error" });
      }
    },
    [fetchInit, state],
  );

  const refresh = useCallback(async () => {
    if (state.phase !== "ready") return;
    const { ok, data } = await fetchInit(state.uid, state.company.id);
    if (ok && data?.authorized) {
      setState({
        ...state,
        documents: (data.documents ?? []) as SlpDocumentEntry[],
      });
    }
  }, [fetchInit, state]);

  const uploadFile = useCallback<SlpDocumentFormChildrenProps["uploadFile"]>(
    async ({ documentType, fiscalPeriod, file }) => {
      if (state.phase !== "ready") return { success: false, error: "未初期化" };
      const fd = new FormData();
      fd.set("uid", state.uid);
      fd.set("companyRecordId", String(state.company.id));
      fd.set("category", category);
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
    [category, refresh, state],
  );

  const previewUrl = useCallback(
    (documentId: number) => {
      if (state.phase !== "ready") return "#";
      const params = new URLSearchParams({
        id: String(documentId),
        uid: state.uid,
      });
      return `/api/public/slp/company-documents/file?${params.toString()}`;
    },
    [state],
  );

  const downloadUrl = useCallback(
    (documentId: number) => {
      if (state.phase !== "ready") return "#";
      const params = new URLSearchParams({
        id: String(documentId),
        uid: state.uid,
        dl: "1",
      });
      return `/api/public/slp/company-documents/file?${params.toString()}`;
    },
    [state],
  );

  return (
    <KoutekiPageShell title={title} subtitle={subtitle} maxWidth="2xl">
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
          <p className="max-w-md text-sm leading-relaxed text-slate-600">
            {state.reason === "no_companies"
              ? "あなたが担当する企業の情報が見つかりませんでした。担当者として登録されているかご確認の上、ご自身の公式LINE上からもう一度フォームにアクセスしてください。"
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
              <span className="font-semibold">{state.snsname}</span>{" "}
              様 / 担当企業を選択してください
            </p>
            <p className="mt-1 text-xs text-slate-500">
              複数の企業の担当者として登録されています。書類を提出する企業を選択してください。
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

      {/* 準備完了: childrenを描画 */}
      {state.phase === "ready" && (
        <div className="space-y-6">
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

          {children({
            uid: state.uid,
            snsname: state.snsname,
            company: state.company,
            documents: state.documents,
            uploadFile,
            refresh,
            previewUrl,
            downloadUrl,
          })}
        </div>
      )}
    </KoutekiPageShell>
  );
}
