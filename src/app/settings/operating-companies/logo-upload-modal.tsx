"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { updateOperatingCompany } from "./actions";
import Image from "next/image";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  logoPath: string | null;
  canEdit: boolean;
};

export function LogoUploadModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  logoPath: initialLogoPath,
  canEdit,
}: Props) {
  const [logoPath, setLogoPath] = useState<string | null>(initialLogoPath);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoPath(initialLogoPath);
  }, [initialLogoPath, open]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("companyId", String(companyId));

        const response = await fetch("/api/operating-companies/logo/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "アップロードに失敗しました");
        }

        // Server ActionでlogoPathを更新
        await updateOperatingCompany(companyId, {
          logoPath: result.filePath,
        });

        setLogoPath(result.filePath);
        toast.success("ロゴを更新しました");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "アップロードに失敗しました";
        toast.error(message);
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [companyId]
  );

  const handleRemove = useCallback(async () => {
    try {
      await updateOperatingCompany(companyId, { logoPath: "" });
      setLogoPath(null);
      toast.success("ロゴを削除しました");
    } catch {
      toast.error("ロゴの削除に失敗しました");
    }
  }, [companyId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ロゴ画像 - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 現在のロゴ表示 */}
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-6 min-h-[160px]">
            {logoPath ? (
              <div className="relative">
                <Image
                  src={logoPath}
                  alt={`${companyName} ロゴ`}
                  width={200}
                  height={120}
                  className="max-h-[120px] w-auto object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="mx-auto h-12 w-12 mb-2" />
                <p className="text-sm">ロゴが設定されていません</p>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          {canEdit && (
            <div className="flex gap-2 justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                onChange={handleUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    アップロード中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {logoPath ? "ロゴを変更" : "ロゴをアップロード"}
                  </>
                )}
              </Button>
              {logoPath && (
                <Button variant="outline" onClick={handleRemove}>
                  <X className="h-4 w-4 mr-2" />
                  削除
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            JPEG, PNG, GIF, WebP, SVG（5MB以下）
            <br />
            請求書PDFにロゴとして使用されます
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
