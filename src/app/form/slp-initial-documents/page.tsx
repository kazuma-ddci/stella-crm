"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  Eye,
  History,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  Send,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  SlpDocumentFormShell,
  type SlpDocumentEntry,
  type SlpDocumentFormChildrenProps,
} from "@/components/slp/slp-document-form-shell";
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

/** 1スロット分の pending file（提出待ちファイル） */
type PendingSlot = {
  /** ローカルプレビュー用のObject URL */
  objectUrl: string;
  file: File;
};

/** スロットキー: documentType + fiscalPeriod */
type SlotKey = string;
function slotKey(type: SlpInitialDocumentType, period: number): SlotKey {
  return `${type}#${period}`;
}

/**
 * 初回提出書類フォーム本体
 *
 * 動作:
 * - 各スロット (3書類×5期=15枠) でファイル選択 → ローカルに pending として保持（即送信しない）
 * - 既存サーバー側ファイルがある場合は「提出済み」表示＋プレビュー可
 * - 既存ファイルがあるスロットに pending を入れると「差し替え予定」表示
 * - フォーム末尾の「提出する」ボタンで pending を順次サーバーへ送信
 */
function InitialDocumentsBody(props: SlpDocumentFormChildrenProps) {
  const { documents, uploadFile, previewUrl } = props;

  const [pendings, setPendings] = useState<Map<SlotKey, PendingSlot>>(
    new Map(),
  );
  const [submitting, setSubmitting] = useState(false);

  // unmount 時に Object URL を解放
  useEffect(() => {
    return () => {
      for (const p of pendings.values()) URL.revokeObjectURL(p.objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** スロットへ pending file を設定 */
  const setPending = (
    type: SlpInitialDocumentType,
    period: number,
    file: File,
  ) => {
    setPendings((prev) => {
      const key = slotKey(type, period);
      const next = new Map(prev);
      const old = next.get(key);
      if (old) URL.revokeObjectURL(old.objectUrl);
      next.set(key, {
        file,
        objectUrl: URL.createObjectURL(file),
      });
      return next;
    });
  };

  /** スロットから pending file をキャンセル */
  const clearPending = (type: SlpInitialDocumentType, period: number) => {
    setPendings((prev) => {
      const key = slotKey(type, period);
      const next = new Map(prev);
      const old = next.get(key);
      if (old) URL.revokeObjectURL(old.objectUrl);
      next.delete(key);
      return next;
    });
  };

  /** 提出ボタン押下: 全 pending を順次送信 */
  const handleSubmit = async () => {
    if (pendings.size === 0) {
      toast.warning("提出するファイルが選択されていません");
      return;
    }
    setSubmitting(true);
    let success = 0;
    let failed = 0;
    const entries = Array.from(pendings.entries());
    for (const [key, slot] of entries) {
      const [type, periodStr] = key.split("#");
      const period = Number(periodStr);
      const result = await uploadFile({
        documentType: type as SlpInitialDocumentType,
        fiscalPeriod: period,
        file: slot.file,
      });
      if (result.success) {
        success++;
        // 個別に削除
        setPendings((prev) => {
          const next = new Map(prev);
          const old = next.get(key);
          if (old) URL.revokeObjectURL(old.objectUrl);
          next.delete(key);
          return next;
        });
      } else {
        failed++;
        toast.error(`${slot.file.name}: ${result.error ?? "送信エラー"}`);
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
      {INITIAL_DOCUMENT_TYPES.map((typeDef) => (
        <DocumentTypeBlock
          key={typeDef.type}
          typeDef={typeDef}
          grouped={grouped}
          pendings={pendings}
          previewUrl={previewUrl}
          onSelect={setPending}
          onClear={clearPending}
          submitting={submitting}
        />
      ))}

      {/* 提出ボタン */}
      <SubmitFooter
        pendingCount={pendings.size}
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
                ファイルを選択して「提出する」を押してください
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
  grouped,
  pendings,
  previewUrl,
  onSelect,
  onClear,
  submitting,
}: {
  typeDef: (typeof INITIAL_DOCUMENT_TYPES)[number];
  grouped: Map<string, SlpDocumentEntry[]>;
  pendings: Map<SlotKey, PendingSlot>;
  previewUrl: SlpDocumentFormChildrenProps["previewUrl"];
  onSelect: (
    type: SlpInitialDocumentType,
    period: number,
    file: File,
  ) => void;
  onClear: (type: SlpInitialDocumentType, period: number) => void;
  submitting: boolean;
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
              <span className="ml-2 inline-flex h-5 items-center rounded-md bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                任意
              </span>
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
            const pending = pendings.get(slotKey(typeDef.type as SlpInitialDocumentType, p.value));
            return (
              <FiscalPeriodSlot
                key={p.value}
                documentType={typeDef.type as SlpInitialDocumentType}
                fiscalPeriod={p.value}
                fiscalLabel={p.label}
                current={current}
                history={history}
                pending={pending}
                previewUrl={previewUrl}
                onSelect={onSelect}
                onClear={onClear}
                submitting={submitting}
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
  pending,
  previewUrl,
  onSelect,
  onClear,
  submitting,
}: {
  documentType: SlpInitialDocumentType;
  fiscalPeriod: number;
  fiscalLabel: string;
  current: SlpDocumentEntry | undefined;
  history: SlpDocumentEntry[];
  pending: PendingSlot | undefined;
  previewUrl: SlpDocumentFormChildrenProps["previewUrl"];
  onSelect: (
    type: SlpInitialDocumentType,
    period: number,
    file: File,
  ) => void;
  onClear: (type: SlpInitialDocumentType, period: number) => void;
  submitting: boolean;
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
  const hasPending = !!pending;

  // 状態別のスタイル
  const containerClass = hasPending
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
              hasPending
                ? "bg-amber-500 text-white"
                : isUploaded
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {fiscalLabel}
          </span>
          {hasPending ? (
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
                <span className="truncate">{pending!.file.name}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700">
                提出待ち ・ {formatBytes(pending!.file.size)}
                {isUploaded ? " ・ 既存の書類を差し替え予定" : ""}
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
          {hasPending && (
            <>
              <a
                href={pending!.objectUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                <Eye className="size-3.5" />
                プレビュー
              </a>
              <button
                type="button"
                onClick={() => onClear(documentType, fiscalPeriod)}
                disabled={submitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="size-3.5" />
                取消
              </button>
            </>
          )}
          {!hasPending && isUploaded && (
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
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="size-3.5" />
            {hasPending ? "選び直す" : isUploaded ? "差し替え" : "ファイル選択"}
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

export default function SlpInitialDocumentsPage() {
  return (
    <SlpDocumentFormShell
      category="initial"
      title="初回提出書類"
      subtitle={
        <>
          源泉徴収簿・算定基礎届・賃金台帳について、直近期から4期前まで5期分の書類を提出してください。
          <br />
          各期ごとに1ファイルにまとめてアップロードしてください。
        </>
      }
    >
      {(props) => <InitialDocumentsBody {...props} />}
    </SlpDocumentFormShell>
  );
}
