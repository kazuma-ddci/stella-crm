"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FileUploadProps = {
  value?: { filePath: string | null; fileName: string | null };
  onChange: (value: { filePath: string | null; fileName: string | null }) => void;
  contractId?: string | number;
  disabled?: boolean;
  className?: string;
};

export function FileUpload({
  value,
  onChange,
  contractId,
  disabled = false,
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (contractId) {
          formData.append("contractId", String(contractId));
        }

        const response = await fetch("/api/contracts/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "アップロードに失敗しました");
        }

        onChange({
          filePath: result.filePath,
          fileName: result.fileName,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "アップロードに失敗しました";
        setError(message);
      } finally {
        setUploading(false);
        // input をリセット（同じファイルを再選択できるように）
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [contractId, onChange]
  );

  const handleClear = useCallback(() => {
    onChange({ filePath: null, fileName: null });
    setError(null);
  }, [onChange]);

  const handleOpenFile = useCallback(() => {
    if (value?.filePath) {
      window.open(value.filePath, "_blank");
    }
  }, [value?.filePath]);

  const hasFile = value?.filePath && value?.fileName;

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      {hasFile ? (
        <div className="flex items-center gap-2 p-3 border rounded-md bg-gray-50">
          <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <span className="flex-1 text-sm truncate" title={value.fileName || ""}>
            {value.fileName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenFile}
            disabled={disabled}
            title="ファイルを開く"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
            title="ファイルを削除"
          >
            <X className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              アップロード中...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              ファイルを選択
            </>
          )}
        </Button>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <p className="text-xs text-gray-500">
        PDF, Word, 画像（10MB以下）
      </p>
    </div>
  );
}
