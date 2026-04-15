"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, ExternalLink, Loader2, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type FileInfo = {
  id?: number;
  /** アップロードしたファイルの保存パス。URLエントリでは undefined/null。 */
  filePath?: string | null;
  /** 表示名。URLエントリでは任意ラベル。 */
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  /** 外部URL（Googleドライブ等）。filePathと排他的。 */
  url?: string | null;
};

type MultiFileUploadProps = {
  value: FileInfo[];
  onChange: (files: FileInfo[]) => void;
  /** @deprecated Use entityId instead */
  contactHistoryId?: string | number;
  /** Generic entity ID to pass in the upload FormData */
  entityId?: string | number;
  /** FormData key name for the entity ID (default: "contactHistoryId") */
  entityIdKey?: string;
  /** Upload endpoint URL (default: "/api/contact-histories/upload") */
  uploadUrl?: string;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
  /** 外部URLの追加を許可する（デフォルト true）。契約書モーダル等URL未対応の場面で false */
  allowUrl?: boolean;
};

function isUrlEntry(f: FileInfo): boolean {
  return !!f.url && !f.filePath;
}

export function MultiFileUpload({
  value = [],
  onChange,
  contactHistoryId,
  entityId,
  entityIdKey = "contactHistoryId",
  uploadUrl = "/api/contact-histories/upload",
  disabled = false,
  className,
  maxFiles = 10,
  allowUrl = true,
}: MultiFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInputOpen, setUrlInputOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlLabelDraft, setUrlLabelDraft] = useState("");

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;

      if (value.length + selectedFiles.length > maxFiles) {
        setError(`添付は最大${maxFiles}件までです`);
        return;
      }

      setUploading(true);
      setError(null);

      const newFiles: FileInfo[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
          const formData = new FormData();
          formData.append("file", file);
          const resolvedEntityId = entityId ?? contactHistoryId;
          if (resolvedEntityId) {
            formData.append(entityIdKey, String(resolvedEntityId));
          }

          const response = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "アップロードに失敗しました");
          }

          newFiles.push({
            filePath: result.filePath,
            fileName: result.fileName,
            fileSize: result.fileSize,
            mimeType: result.mimeType,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "アップロードに失敗しました";
          setError(`${file.name}: ${message}`);
        }
      }

      if (newFiles.length > 0) {
        onChange([...value, ...newFiles]);
      }

      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [contactHistoryId, entityId, entityIdKey, uploadUrl, onChange, value, maxFiles]
  );

  const handleAddUrl = useCallback(() => {
    const url = urlDraft.trim();
    if (!url) {
      setError("URLを入力してください");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("URLは http:// または https:// で始めてください");
      return;
    }
    if (value.length >= maxFiles) {
      setError(`添付は最大${maxFiles}件までです`);
      return;
    }
    const label = urlLabelDraft.trim() || url;
    onChange([...value, { url, fileName: label }]);
    setUrlDraft("");
    setUrlLabelDraft("");
    setUrlInputOpen(false);
    setError(null);
  }, [urlDraft, urlLabelDraft, value, maxFiles, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      const newFiles = [...value];
      newFiles.splice(index, 1);
      onChange(newFiles);
      setError(null);
    },
    [value, onChange]
  );

  const handleOpen = useCallback((f: FileInfo) => {
    const url = f.url || f.filePath;
    if (url) window.open(url, "_blank");
  }, []);

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      {/* 添付一覧 */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file, index) => {
            const urlEntry = isUrlEntry(file);
            return (
              <div
                key={`${file.filePath ?? file.url}-${index}`}
                className="flex items-center gap-2 p-2 border rounded-md bg-gray-50 min-w-0"
              >
                {urlEntry ? (
                  <LinkIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-sm truncate" title={file.fileName}>
                    {file.fileName}
                  </div>
                  {urlEntry && file.url && (
                    <div
                      className="text-xs text-muted-foreground truncate"
                      title={file.url}
                    >
                      {file.url}
                    </div>
                  )}
                </div>
                {!urlEntry && file.fileSize != null && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatFileSize(file.fileSize)}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpen(file)}
                  disabled={disabled}
                  title={urlEntry ? "URLを開く" : "ファイルを開く"}
                  className="h-7 w-7 p-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  title="削除"
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* URL追加フォーム */}
      {urlInputOpen && (
        <div className="space-y-2 border rounded-md p-3 bg-green-50/50">
          <div>
            <Label className="text-xs">表示名（省略可）</Label>
            <Input
              value={urlLabelDraft}
              onChange={(e) => setUrlLabelDraft(e.target.value)}
              placeholder="例: Google Drive 共有フォルダ"
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">URL *</Label>
            <Input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://..."
              className="h-9"
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUrlInputOpen(false);
                setUrlDraft("");
                setUrlLabelDraft("");
                setError(null);
              }}
            >
              キャンセル
            </Button>
            <Button type="button" size="sm" onClick={handleAddUrl}>
              追加
            </Button>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      {value.length < maxFiles && !urlInputOpen && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex-1"
            size="sm"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                アップロード中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                ファイルを追加
              </>
            )}
          </Button>
          {allowUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setUrlInputOpen(true)}
              disabled={disabled}
              className="flex-1"
              size="sm"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              URLを追加
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="text-xs text-gray-500">
        PDF, Word, Excel, 画像, テキスト, CSV（各10MB以下）または外部URL、最大{maxFiles}件
      </p>
    </div>
  );
}

// テーブル表示用コンポーネント
type FileDisplayProps = {
  files: FileInfo[];
  className?: string;
};

export function FileDisplay({ files, className }: FileDisplayProps) {
  if (!files || files.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {files.map((file, index) => {
        const href = file.url || file.filePath || "#";
        const isUrl = !!file.url && !file.filePath;
        return (
          <a
            key={`${file.filePath ?? file.url}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm"
            title={file.fileName}
          >
            {isUrl ? (
              <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span className="truncate max-w-[150px]">{file.fileName}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        );
      })}
    </div>
  );
}
