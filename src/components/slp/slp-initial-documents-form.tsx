"use client";

import { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  Eye,
  History,
  Loader2,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  INITIAL_DOCUMENT_TYPES,
  FISCAL_PERIODS,
  type SlpInitialDocumentType,
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
  SlpInitialDocumentsCompleteFn,
  SlpInitialDocumentsCompletion,
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

/** スロットキー: documentType + fiscalPeriod */
type SlotKey = string;
function slotKey(type: SlpInitialDocumentType, period: number): SlotKey {
  return `${type}#${period}`;
}

export type SlpInitialDocumentsFormProps = {
  documents: SlpDocumentEntry[];
  uploadFile: SlpDocumentUploadFn;
  completeInitialDocuments: SlpInitialDocumentsCompleteFn;
  previewUrl: SlpDocumentUrlFn;
  completion: SlpInitialDocumentsCompletion;
};

/**
 * 初回提出書類フォーム本体
 *
 * 動作:
 * - 各スロットでファイル選択 → 即アップロードしてCRMへ保存
 * - 既存サーバー側ファイルがある場合は「提出済み」表示＋プレビュー可
 * - 既存ファイルがあるスロットに再アップロードすると差し替え履歴として保存
 * - フォーム末尾のボタンで初回提出書類の最終完了日時を記録
 */
export function SlpInitialDocumentsForm({
  documents,
  uploadFile,
  completeInitialDocuments,
  previewUrl,
  completion,
}: SlpInitialDocumentsFormProps) {
  const [uploadingSlots, setUploadingSlots] = useState<Set<SlotKey>>(new Set());
  const [completing, setCompleting] = useState(false);

  // documentType x fiscalPeriod 別にグルーピング（既存サーバー側）
  const grouped = useMemo(() => {
    const map = new Map<string, SlpDocumentEntry[]>();
    for (const d of documents) {
      if (d.category !== "initial") continue;
      const key = `${d.documentType}#${d.fiscalPeriod ?? "_"}`;
      const list = map.get(key);
      if (list) list.push(d);
      else map.set(key, [d]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return map;
  }, [documents]);

  /** スロットへファイルを即時アップロード */
  const uploadSlot = async (
    type: SlpInitialDocumentType,
    period: number,
    file: File,
  ) => {
    const key = slotKey(type, period);
    setUploadingSlots((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const result = await uploadFile({ documentType: type, fiscalPeriod: period, file });
    setUploadingSlots((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (result.success) {
      toast.success("書類をアップロードしました");
    } else {
      toast.error(result.error ?? "アップロードに失敗しました");
    }
  };

  /** 最終完了ボタン押下: アップロード完了記録を保存 */
  const handleComplete = async () => {
    setCompleting(true);
    const result = await completeInitialDocuments();
    setCompleting(false);
    if (result.success) {
      toast.success("初回提出書類の提出完了を記録しました");
    } else {
      toast.error(result.error ?? "提出完了の記録に失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      {INITIAL_DOCUMENT_TYPES.map((typeDef) => (
        <DocumentTypeBlock
          key={typeDef.type}
          typeDef={typeDef}
          grouped={grouped}
          uploadingSlots={uploadingSlots}
          previewUrl={previewUrl}
          onSelect={uploadSlot}
        />
      ))}

      {/* 最終完了ボタン */}
      <SubmitFooter
        completion={completion}
        completing={completing}
        disabled={uploadingSlots.size > 0}
        onComplete={handleComplete}
      />
    </div>
  );
}

/** 最終完了ボタン領域（フォーム末尾に固定表示） */
function SubmitFooter({
  completion,
  completing,
  disabled,
  onComplete,
}: {
  completion: SlpInitialDocumentsCompletion;
  completing: boolean;
  disabled: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 mt-8">
      <div className="rounded-2xl border border-blue-200 bg-white/95 px-5 py-4 shadow-[0_12px_36px_-18px_rgba(15,30,80,0.35)] backdrop-blur">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-xs text-slate-600">
            {completion.completedAt ? (
              <span className="text-blue-700">
                提出完了済み
                {completion.completedByName ? ` / ${completion.completedByName}` : ""}
                {" ・ "}
                {formatDate(completion.completedAt)}
              </span>
            ) : (
              <span className="text-slate-500">
                必要な書類のアップロードが完了したら、このボタンを押してください。
              </span>
            )}
          </div>
          <KoutekiButton
            size="lg"
            onClick={onComplete}
            disabled={completing || disabled}
          >
            {completing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                記録中...
              </>
            ) : (
              <>
                <Send className="size-4" />
                全ての書類のアップロードを完了して提出する
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
  grouped,
  uploadingSlots,
  previewUrl,
  onSelect,
}: {
  typeDef: (typeof INITIAL_DOCUMENT_TYPES)[number];
  grouped: Map<string, SlpDocumentEntry[]>;
  uploadingSlots: Set<SlotKey>;
  previewUrl: SlpDocumentUrlFn;
  onSelect: (
    type: SlpInitialDocumentType,
    period: number,
    file: File,
  ) => void | Promise<void>;
}) {
  return (
    <KoutekiCard>
      <div className="px-6 pt-5">
        <div className="flex items-start gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <FileText className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              {typeDef.label}
            </h3>
            {typeDef.description && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {typeDef.description}
              </p>
            )}
          </div>
        </div>
      </div>
      <KoutekiCardContent>
        <div className="space-y-3">
          {FISCAL_PERIODS.map((p) => {
            const key = `${typeDef.type}#${p.value}`;
            const entries = grouped.get(key) ?? [];
            const current = entries.find((e) => e.isCurrent) ?? entries[0];
            const history = entries.filter((e) => e !== current);
            const isUploading = uploadingSlots.has(
              slotKey(typeDef.type as SlpInitialDocumentType, p.value),
            );
            return (
              <FiscalPeriodSlot
                key={p.value}
                documentType={typeDef.type as SlpInitialDocumentType}
                fiscalPeriod={p.value}
                fiscalLabel={p.label}
                current={current}
                history={history}
                isUploading={isUploading}
                previewUrl={previewUrl}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </KoutekiCardContent>
    </KoutekiCard>
  );
}

function FiscalPeriodSlot({
  documentType,
  fiscalPeriod,
  fiscalLabel,
  current,
  history,
  isUploading,
  previewUrl,
  onSelect,
}: {
  documentType: SlpInitialDocumentType;
  fiscalPeriod: number;
  fiscalLabel: string;
  current: SlpDocumentEntry | undefined;
  history: SlpDocumentEntry[];
  isUploading: boolean;
  previewUrl: SlpDocumentUrlFn;
  onSelect: (
    type: SlpInitialDocumentType,
    period: number,
    file: File,
  ) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleSelect = () => inputRef.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_DOCUMENT_FILE_SIZE) {
      toast.error(
        `ファイルサイズは${Math.floor(MAX_DOCUMENT_FILE_SIZE / 1024 / 1024)}MB以下にしてください`,
      );
      return;
    }
    onSelect(documentType, fiscalPeriod, file);
  };

  const isUploaded = !!current;
  // 状態別のスタイル
  const containerClass = isUploading
    ? "border-amber-300 bg-amber-50/40"
    : isUploaded
      ? "border-blue-200 bg-blue-50/30"
      : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border ${containerClass} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 左: 期ラベル + ファイル情報 */}
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-7 items-center rounded-md px-2 text-xs font-bold ${
              isUploading
                ? "bg-amber-500 text-white"
                : isUploaded
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {fiscalLabel}
          </span>
          {isUploading ? (
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
                <span className="truncate">アップロード中...</span>
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700">
                {isUploaded ? "既存の書類を差し替えています" : "書類を保存しています"}
              </p>
            </div>
          ) : isUploaded ? (
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                <CheckCircle2 className="size-3.5 shrink-0 text-blue-600" />
                <span className="truncate">{current!.fileName}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatBytes(current!.fileSize)} ・ 提出:{" "}
                {formatDate(current!.createdAt)}
                {current!.uploadedByName ? ` / ${current!.uploadedByName}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">未提出</p>
          )}
        </div>

        {/* 右: アクションボタン */}
        <div className="flex items-center gap-2">
          {!isUploading && isUploaded && (
            <a
              href={previewUrl(current!.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <Eye className="size-3.5" />
              プレビュー
            </a>
          )}
          <button
            type="button"
            onClick={handleSelect}
            disabled={isUploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {isUploaded ? "差し替え" : "ファイル選択"}
          </button>
        </div>
      </div>

      {/* 履歴 */}
      {history.length > 0 && (
        <div className="mt-3 border-t border-blue-100 pt-3">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-500 hover:text-blue-700"
          >
            {historyOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            <History className="size-3" />
            過去の提出履歴 ({history.length}件)
          </button>
          {historyOpen && (
            <ul className="mt-2 space-y-1.5">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-3 py-2 text-[11px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-700">
                      {h.fileName}
                    </span>
                    <span className="text-slate-400">
                      {formatBytes(h.fileSize)} ・ {formatDate(h.createdAt)}
                      {h.uploadedByName ? ` / ${h.uploadedByName}` : ""}
                    </span>
                  </span>
                  <a
                    href={previewUrl(h.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                    title="プレビュー"
                  >
                    <Eye className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
