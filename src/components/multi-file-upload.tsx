"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type FileInfo = {
  id?: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type MultiFileUploadProps = {
  value: FileInfo[];
  onChange: (files: FileInfo[]) => void;
  contactHistoryId?: string | number;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
};

export function MultiFileUpload({
  value = [],
  onChange,
  contactHistoryId,
  disabled = false,
  className,
  maxFiles = 10,
}: MultiFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;

      // 最大ファイル数チェック
      if (value.length + selectedFiles.length > maxFiles) {
        setError(`ファイルは最大${maxFiles}件まで添付できます`);
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
          if (contactHistoryId) {
            formData.append("contactHistoryId", String(contactHistoryId));
          }

          const response = await fetch("/api/contact-histories/upload", {
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
      // input をリセット（同じファイルを再選択できるように）
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [contactHistoryId, onChange, value, maxFiles]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newFiles = [...value];
      newFiles.splice(index, 1);
      onChange(newFiles);
      setError(null);
    },
    [value, onChange]
  );

  const handleOpenFile = useCallback((filePath: string) => {
    window.open(filePath, "_blank");
  }, []);

  const formatFileSize = (bytes: number): string => {
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

      {/* ファイル一覧 */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file, index) => (
            <div
              key={`${file.filePath}-${index}`}
              className="flex items-center gap-2 p-2 border rounded-md bg-gray-50"
            >
              <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="flex-1 text-sm truncate" title={file.fileName}>
                {file.fileName}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.fileSize)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenFile(file.filePath)}
                disabled={disabled}
                title="ファイルを開く"
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
                title="ファイルを削除"
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* アップロードボタン */}
      {value.length < maxFiles && (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-full"
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
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <p className="text-xs text-gray-500">
        PDF, Word, Excel, 画像, テキスト, CSV（各10MB以下、最大{maxFiles}件）
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
      {files.map((file, index) => (
        <a
          key={`${file.filePath}-${index}`}
          href={file.filePath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-sm"
          title={file.fileName}
        >
          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate max-w-[150px]">{file.fileName}</span>
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
        </a>
      ))}
    </div>
  );
}
