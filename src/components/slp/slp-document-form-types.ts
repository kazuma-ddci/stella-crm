import type { SlpDocumentType } from "@/lib/slp/document-types";

/**
 * SLP公的提出書類フォームで共通利用する型定義
 *
 * /api/public/slp/company-documents/init のレスポンスに含まれる書類エントリの型と、
 * 企業選択肢の型を保持する。
 */

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

export type SlpInitialDocumentsCompletion = {
  completedAt: string | null;
  completedByUid: string | null;
  completedByName: string | null;
};

/** ファイルアップロード関数の共通シグネチャ */
export type SlpDocumentUploadFn = (params: {
  documentType: SlpDocumentType;
  fiscalPeriod?: number | null;
  file: File;
}) => Promise<{ success: boolean; error?: string }>;

/** 初回提出書類の最終完了記録関数 */
export type SlpInitialDocumentsCompleteFn = () => Promise<{
  success: boolean;
  error?: string;
  completion?: SlpInitialDocumentsCompletion;
}>;

/** プレビュー/ダウンロードURL生成関数 */
export type SlpDocumentUrlFn = (documentId: number) => string;
