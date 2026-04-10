"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Eye,
  Loader2,
  Plus,
  X,
  Send,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  ADDITIONAL_DOCUMENT_TYPES,
  type SlpAdditionalDocumentType,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE,
} from "@/lib/slp/document-types";
import {
  KoutekiCard,
  KoutekiCardContent,
  KoutekiButton,
} from "@/components/kouteki";
import type {
  SlpDocumentEntry,
  SlpDocumentUploadFn,
  SlpDocumentUrlFn,
} from "./slp-document-form-types";

const ACCEPT_ATTR = ALLOWED_DOCUMENT_MIME_TYPES.join(",");

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 1件の pending file（提出待ちファイル） */
type PendingFile = {
  /** クライアント側で重複しないキー */
  key: string;
  documentType: SlpAdditionalDocumentType;
  file: File;
  objectUrl: string;
};

export type SlpAdditionalDocumentsFormProps = {
  documents: SlpDocumentEntry[];
  uploadFile: SlpDocumentUploadFn;
  previewUrl: SlpDocumentUrlFn;
};

/**
 * 追加提出書類フォーム本体
 *
 * 動作:
 * - 各書類タイプごとに既存ファイル一覧 + ローカルの pending（提出待ち）ファイル一覧
 * - 「ファイルを追加」ボタンで複数選択 → pending リストに追加（即送信しない）
 * - フォーム末尾の「提出する」ボタンで pending を順次サーバーへ送信
 */
export function SlpAdditionalDocumentsForm({
  documents,
  uploadFile,
  previewUrl,
}: SlpAdditionalDocumentsFormProps) {
  const [pendings, setPendings] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // unmount 時に Object URL を解放
  useEffect(() => {
    return () => {
      for (const p of pendings) URL.revokeObjectURL(p.objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, SlpDocumentEntry[]>();
    for (const d of documents) {
      if (d.category !== "additional") continue;
      const list = map.get(d.documentType);
      if (list) list.push(d);
      else map.set(d.documentType, [d]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return map;
  }, [documents]);

  const pendingsByType = useMemo(() => {
    const map = new Map<string, PendingFile[]>();
    for (const p of pendings) {
      const list = map.get(p.documentType);
      if (list) list.push(p);
      else map.set(p.documentType, [p]);
    }
    return map;
  }, [pendings]);

  const addPendingFiles = (
    type: SlpAdditionalDocumentType,
    files: File[],
  ) => {
    setPendings((prev) => [
      ...prev,
      ...files.map<PendingFile>((file) => ({
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        documentType: type,
        file,
        objectUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePending = (key: string) => {
    setPendings((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((p) => p.key !== key);
    });
  };

  const handleSubmit = async () => {
    if (pendings.length === 0) {
      toast.warning("提出するファイルが選択されていません");
      return;
    }
    setSubmitting(true);
    let success = 0;
    let failed = 0;
    const targets = [...pendings];
    for (const p of targets) {
      const result = await uploadFile({
        documentType: p.documentType,
        file: p.file,
      });
      if (result.success) {
        success++;
        URL.revokeObjectURL(p.objectUrl);
        setPendings((prev) => prev.filter((x) => x.key !== p.key));
      } else {
        failed++;
        toast.error(`${p.file.name}: ${result.error ?? "送信エラー"}`);
      }
    }
    setSubmitting(false);
    if (failed === 0 && success > 0) {
      toast.success(`${success}件の書類を提出しました`);
    } else if (success > 0) {
      toast.success(`${success}件提出完了 / ${failed}件失敗`);
    }
  };

  return (
    <div className="space-y-6">
      {ADDITIONAL_DOCUMENT_TYPES.map((typeDef) => (
        <DocumentTypeBlock
          key={typeDef.type}
          typeDef={typeDef}
          entries={grouped.get(typeDef.type) ?? []}
          pendings={pendingsByType.get(typeDef.type) ?? []}
          previewUrl={previewUrl}
          onAdd={addPendingFiles}
          onRemovePending={removePending}
          submitting={submitting}
        />
      ))}

      <SubmitFooter
        pendingCount={pendings.length}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

/** 提出ボタン領域（フォーム末尾に固定表示） */
function SubmitFooter({
  pendingCount,
  submitting,
  onSubmit,
}: {
  pendingCount: number;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 mt-8">
      <div className="rounded-2xl border border-blue-200 bg-white/95 px-5 py-4 shadow-[0_12px_36px_-18px_rgba(15,30,80,0.35)] backdrop-blur">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-xs text-slate-600">
            {pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle className="size-3.5 text-amber-500" />
                <span className="font-semibold text-slate-900">
                  {pendingCount}件
                </span>
                の書類が提出待ちです
              </span>
            ) : (
              <span className="text-slate-500">
                ファイルを追加して「提出する」を押してください
              </span>
            )}
          </div>
          <KoutekiButton
            size="lg"
            onClick={onSubmit}
            disabled={submitting || pendingCount === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Send className="size-4" />
                提出する
                {pendingCount > 0 ? `（${pendingCount}件）` : ""}
              </>
            )}
          </KoutekiButton>
        </div>
      </div>
    </div>
  );
}

function DocumentTypeBlock({
  typeDef,
  entries,
  pendings,
  previewUrl,
  onAdd,
  onRemovePending,
  submitting,
}: {
  typeDef: (typeof ADDITIONAL_DOCUMENT_TYPES)[number];
  entries: SlpDocumentEntry[];
  pendings: PendingFile[];
  previewUrl: SlpDocumentUrlFn;
  onAdd: (type: SlpAdditionalDocumentType, files: File[]) => void;
  onRemovePending: (key: string) => void;
  submitting: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = () => inputRef.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = "";
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    // サイズチェック
    for (const f of files) {
      if (f.size > MAX_DOCUMENT_FILE_SIZE) {
        toast.error(
          `${f.name}: ファイルサイズは${Math.floor(MAX_DOCUMENT_FILE_SIZE / 1024 / 1024)}MB以下にしてください`,
        );
        return;
      }
    }
    onAdd(typeDef.type as SlpAdditionalDocumentType, files);
  };

  return (
    <KoutekiCard>
      <div className="px-6 pt-5">
        <div className="flex items-start gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <FileText className="size-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-slate-900">
                {typeDef.label}
              </h3>
              <span className="inline-flex h-5 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                任意
              </span>
              <span className="inline-flex h-5 items-center rounded-md bg-blue-100 px-1.5 text-[10px] font-medium text-blue-700">
                提出済 {entries.length}件
              </span>
              {pendings.length > 0 && (
                <span className="inline-flex h-5 items-center rounded-md bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700">
                  提出待ち {pendings.length}件
                </span>
              )}
            </div>
            {typeDef.description && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {typeDef.description}
              </p>
            )}
          </div>
        </div>
      </div>
      <KoutekiCardContent>
        {/* 提出済みファイル */}
        {entries.length > 0 && (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {e.fileName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatBytes(e.fileSize)} ・ 提出: {formatDate(e.createdAt)}
                    {e.uploadedByName ? ` / ${e.uploadedByName}` : ""}
                  </p>
                </div>
                <a
                  href={previewUrl(e.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Eye className="size-3.5" />
                  プレビュー
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* 提出待ちファイル（pending） */}
        {pendings.length > 0 && (
          <ul className={`space-y-2 ${entries.length > 0 ? "mt-3" : ""}`}>
            {pendings.map((p) => (
              <li
                key={p.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/40 px-4 py-3"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.file.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      提出待ち ・ {formatBytes(p.file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={p.objectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Eye className="size-3.5" />
                    プレビュー
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemovePending(p.key)}
                    disabled={submitting}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    取消
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {entries.length === 0 && pendings.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
            まだ提出されていません
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSelect}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-4" />
            ファイルを追加
          </button>
        </div>
      </KoutekiCardContent>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </KoutekiCard>
  );
}
