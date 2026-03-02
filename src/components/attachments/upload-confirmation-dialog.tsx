"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText } from "lucide-react";
import {
  ATTACHMENT_TYPE_OPTIONS,
  generateAttachmentFileName,
  getFileExtension,
  getFileNameWithoutExtension,
  getNextDuplicateSuffix,
} from "@/lib/attachments/constants";

export type FileUploadEntry = {
  file: File;
  attachmentType: string;
  displayName: string;
  generatedName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  files: File[];
  onConfirm: (entries: FileUploadEntry[]) => void;
  uploading: boolean;
  /** デフォルトの表示名（未指定時は元ファイル名） */
  defaultDisplayName?: string;
  /** 既存の添付ファイル名リスト（重複連番の判定用） */
  existingAttachmentNames?: string[];
};

export function UploadConfirmationDialog({
  open,
  onClose,
  files,
  onConfirm,
  uploading,
  defaultDisplayName,
  existingAttachmentNames = [],
}: Props) {
  const [entries, setEntries] = useState<
    { file: File; attachmentType: string; displayName: string }[]
  >([]);

  // files が変わるたびにリセット（open時にも反映されるように）
  useEffect(() => {
    if (!open || files.length === 0) {
      setEntries([]);
      return;
    }
    setEntries(
      files.map((file) => ({
        file,
        attachmentType: "other",
        displayName:
          defaultDisplayName || getFileNameWithoutExtension(file.name),
      }))
    );
  }, [files, open, defaultDisplayName]);

  const updateEntry = (
    index: number,
    field: "attachmentType" | "displayName",
    value: string
  ) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  // 重複連番を考慮した生成ファイル名を計算
  const generatedNames = useMemo(() => {
    const names: string[] = [];
    // バッチ内で先に処理されたファイル名も重複チェック対象に含める
    const allNames = [...existingAttachmentNames];

    for (const entry of entries) {
      const ext = getFileExtension(entry.file.name);
      const dn = entry.displayName || "（未入力）";
      const suffix = getNextDuplicateSuffix(
        entry.attachmentType,
        dn,
        allNames
      );
      const name = generateAttachmentFileName(
        entry.attachmentType,
        dn,
        ext,
        undefined,
        suffix
      );
      names.push(name);
      allNames.push(name);
    }
    return names;
  }, [entries, existingAttachmentNames]);

  const handleConfirm = () => {
    if (entries.length === 0) return;
    onConfirm(
      entries.map((e, i) => ({
        ...e,
        generatedName: generatedNames[i],
      }))
    );
  };

  // entries が空でないこと + 全表示名が入力済みであることを確認
  const canConfirm =
    entries.length > 0 &&
    entries.every((e) => e.displayName.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !uploading) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>証憑アップロード確認</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            entries.map((entry, index) => {
              const previewName = generatedNames[index] ?? "";
              return (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  {/* 元ファイル情報 */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{entry.file.name}</span>
                    <span className="shrink-0">
                      ({(entry.file.size / 1024).toFixed(0)}KB)
                    </span>
                  </div>

                  {/* 証憑種類 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">証憑種類</Label>
                    <Select
                      value={entry.attachmentType}
                      onValueChange={(v) =>
                        updateEntry(index, "attachmentType", v)
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTACHMENT_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* ファイル名（表示名） */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">ファイル名（表示名）</Label>
                    <Input
                      value={entry.displayName}
                      onChange={(e) =>
                        updateEntry(index, "displayName", e.target.value)
                      }
                      placeholder="ファイル名を入力..."
                      className="h-8"
                    />
                  </div>

                  {/* 生成ファイル名プレビュー */}
                  <div className="text-xs text-muted-foreground bg-gray-50 rounded p-2">
                    <span className="font-medium">保存ファイル名: </span>
                    <span className="break-all">{previewName}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={uploading || !canConfirm}
          >
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            アップロード
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
