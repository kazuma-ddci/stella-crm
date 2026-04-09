"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Eye,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  INITIAL_DOCUMENT_TYPES,
  ADDITIONAL_DOCUMENT_TYPES,
  FISCAL_PERIODS,
  getFiscalPeriodLabel,
} from "@/lib/slp/document-types";
import { softDeleteCompanyDocument } from "@/app/slp/companies/actions";

export type CompanyDocumentEntry = {
  id: number;
  category: string;
  documentType: string;
  fiscalPeriod: number | null;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedByUid: string | null;
  uploadedByName: string | null;
  isCurrent: boolean;
  createdAt: string; // ISO
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: { id: number; name: string };
  documents: CompanyDocumentEntry[];
};

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

function previewUrl(id: number) {
  return `/api/slp/company-documents/file?id=${id}`;
}
function downloadUrl(id: number) {
  return `/api/slp/company-documents/file?id=${id}&dl=1`;
}

/**
 * CRM企業名簿の「提出書類」ビュー（ページ・モーダルどちらでも使える）
 *
 * - タブ「初回提出書類」「追加提出書類」
 * - 初回タブ: 書類種別ごとに5期分のスロット展開、各期の最新版＋過去履歴
 * - 追加タブ: 書類種別ごとに全件リスト
 * - 各ファイルにプレビュー(👁) / DL(⬇) / 論理削除(🗑) ボタン
 *
 * @param className - 親コンテナでスクロール制御したい場合に渡す
 * @param tabsListClassName - TabsList のスタイル上書き
 */
export function SlpCompanyDocumentsView({
  documents,
  className,
  tabsContentClassName,
}: {
  documents: CompanyDocumentEntry[];
  className?: string;
  tabsContentClassName?: string;
}) {
  const initialDocs = useMemo(
    () => documents.filter((d) => d.category === "initial"),
    [documents],
  );
  const additionalDocs = useMemo(
    () => documents.filter((d) => d.category === "additional"),
    [documents],
  );

  return (
    <Tabs defaultValue="initial" className={className ?? "flex flex-col"}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="initial">
          初回提出書類
          <Badge variant="secondary" className="ml-2">
            {initialDocs.filter((d) => d.isCurrent).length} / 15
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="additional">
          追加提出書類
          <Badge variant="secondary" className="ml-2">
            {additionalDocs.length}件
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="initial" className={tabsContentClassName ?? "mt-4"}>
        <InitialDocumentsView documents={initialDocs} />
      </TabsContent>
      <TabsContent value="additional" className={tabsContentClassName ?? "mt-4"}>
        <AdditionalDocumentsView documents={additionalDocs} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * CRM企業名簿の「提出書類」モーダル（既存のラッパー）
 *
 * 中身は SlpCompanyDocumentsView に分離済み。
 * インライン表示したい場合は SlpCompanyDocumentsView を直接使ってください。
 */
export function SlpCompanyDocumentsModal({
  open,
  onOpenChange,
  company,
  documents,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="size-5 text-blue-600" />
            {company.name} / 提出書類
          </DialogTitle>
          <DialogDescription>
            公開フォームから提出された書類を一覧表示します。プレビュー・ダウンロード・削除が可能です。
          </DialogDescription>
        </DialogHeader>

        <SlpCompanyDocumentsView
          documents={documents}
          className="flex-1 overflow-hidden flex flex-col"
          tabsContentClassName="flex-1 overflow-y-auto mt-4 pr-2"
        />
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// 初回提出書類タブ
// ========================================
function InitialDocumentsView({
  documents,
}: {
  documents: CompanyDocumentEntry[];
}) {
  // documentType x fiscalPeriod でグルーピング
  const grouped = useMemo(() => {
    const map = new Map<string, CompanyDocumentEntry[]>();
    for (const d of documents) {
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

  return (
    <div className="space-y-4">
      {INITIAL_DOCUMENT_TYPES.map((typeDef) => (
        <div
          key={typeDef.type}
          className="rounded-lg border border-slate-200 bg-white"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <FileText className="size-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {typeDef.label}
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {FISCAL_PERIODS.map((p) => {
              const key = `${typeDef.type}#${p.value}`;
              const entries = grouped.get(key) ?? [];
              const current = entries.find((e) => e.isCurrent) ?? entries[0];
              const history = entries.filter((e) => e !== current);
              return (
                <FiscalPeriodRow
                  key={p.value}
                  fiscalLabel={p.label}
                  current={current}
                  history={history}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FiscalPeriodRow({
  fiscalLabel,
  current,
  history,
}: {
  fiscalLabel: string;
  current: CompanyDocumentEntry | undefined;
  history: CompanyDocumentEntry[];
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Badge
            variant={current ? "default" : "outline"}
            className="shrink-0"
          >
            {fiscalLabel}
          </Badge>
          {current ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {current.fileName}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatBytes(current.fileSize)} ・{" "}
                {formatDate(current.createdAt)}
                {current.uploadedByName ? ` / ${current.uploadedByName}` : ""}
              </p>
            </div>
          ) : (
            <span className="text-xs text-slate-400">未提出</span>
          )}
        </div>
        {current && <FileActions doc={current} />}
      </div>

      {history.length > 0 && (
        <div className="mt-2 ml-[5.5rem]">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-700"
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
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-[11px]"
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
                  <FileActions doc={h} compact />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ========================================
// 追加提出書類タブ
// ========================================
function AdditionalDocumentsView({
  documents,
}: {
  documents: CompanyDocumentEntry[];
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, CompanyDocumentEntry[]>();
    for (const d of documents) {
      const list = map.get(d.documentType);
      if (list) list.push(d);
      else map.set(d.documentType, [d]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return map;
  }, [documents]);

  return (
    <div className="space-y-4">
      {ADDITIONAL_DOCUMENT_TYPES.map((typeDef) => {
        const entries = grouped.get(typeDef.type) ?? [];
        return (
          <div
            key={typeDef.type}
            className="rounded-lg border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {typeDef.label}
                </h3>
              </div>
              <Badge variant="secondary">{entries.length}件</Badge>
            </div>
            {entries.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">
                未提出
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {e.fileName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatBytes(e.fileSize)} ・{" "}
                        {formatDate(e.createdAt)}
                        {e.uploadedByName ? ` / ${e.uploadedByName}` : ""}
                      </p>
                    </div>
                    <FileActions doc={e} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ========================================
// ファイル操作ボタン群
// ========================================
function FileActions({
  doc,
  compact = false,
}: {
  doc: CompanyDocumentEntry;
  compact?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await softDeleteCompanyDocument(doc.id);
        toast.success("書類を削除しました");
        setConfirmOpen(false);
      } catch {
        toast.error("削除に失敗しました");
      }
    });
  };

  if (compact) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <a
          href={previewUrl(doc.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700"
          title="プレビュー"
        >
          <Eye className="size-3.5" />
        </a>
        <a
          href={downloadUrl(doc.id)}
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700"
          title="ダウンロード"
        >
          <Download className="size-3.5" />
        </a>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"
          title="削除"
          disabled={pending}
        >
          <Trash2 className="size-3.5" />
        </button>
        <DeleteConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          doc={doc}
          onConfirm={handleDelete}
          pending={pending}
        />
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button asChild size="sm" variant="outline">
        <a href={previewUrl(doc.id)} target="_blank" rel="noreferrer">
          <Eye className="size-3.5" />
          プレビュー
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={downloadUrl(doc.id)}>
          <Download className="size-3.5" />
          DL
        </a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        doc={doc}
        onConfirm={handleDelete}
        pending={pending}
      />
    </div>
  );
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  doc,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: CompanyDocumentEntry;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>書類を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {doc.fileName}
            {doc.fiscalPeriod != null
              ? ` (${getFiscalPeriodLabel(doc.fiscalPeriod)})`
              : ""}
            <br />
            論理削除のため後から復元可能ですが、提出者・他のスタッフからは見えなくなります。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className="bg-rose-600 hover:bg-rose-700"
          >
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
