"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Loader2 } from "lucide-react";
import { ChangeConfirmationDialog } from "@/components/change-confirmation-dialog";

type TextPreviewCellProps = {
  text: string | null | undefined;
  title?: string;
  onEdit?: (newValue: string | null) => Promise<void>;
};

export function TextPreviewCell({ text, title = "詳細", onEdit }: TextPreviewCellProps) {
  // 空白のみの文字列をnullとして扱う
  const normalizedText = text?.trim() || null;

  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsOpen(true);
    setIsEditing(false);
    setEditValue(normalizedText || "");
  }, [normalizedText]);

  const handleStartEdit = useCallback(() => {
    setEditValue(normalizedText || "");
    setIsEditing(true);
  }, [normalizedText]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(normalizedText || "");
  }, [normalizedText]);

  const handleSaveClick = useCallback(() => {
    // 値が変わっていない場合はキャンセル
    const oldValue = normalizedText || "";
    const newValue = editValue.trim() || "";
    if (oldValue === newValue) {
      setIsEditing(false);
      return;
    }
    setConfirmDialogOpen(true);
  }, [normalizedText, editValue]);

  const handleConfirmSave = async () => {
    if (!onEdit) return;

    setLoading(true);
    try {
      const newValue = editValue.trim() || null;
      await onEdit(newValue);
      setIsEditing(false);
      setIsOpen(false);
      setConfirmDialogOpen(false);
    } catch {
      // エラーはonEdit内でtoastされる想定
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = useCallback(() => {
    setConfirmDialogOpen(false);
  }, []);

  // テキストが空でonEditもない場合は単純な「-」表示
  if (!normalizedText && !onEdit) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <>
      {/* テキストがある場合はdiv、空の場合はspan */}
      {normalizedText ? (
        <div
          onClick={handleOpenModal}
          className="max-w-xs truncate text-sm cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
          title="クリックで全文表示"
        >
          {normalizedText}
        </div>
      ) : (
        <span
          className="text-muted-foreground cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
          onClick={handleOpenModal}
          title="クリックして入力"
        >
          -
        </span>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-h-[80vh] flex flex-col"
          style={{ maxWidth: "672px", width: "calc(100vw - 2rem)" }}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{isEditing ? `${title}を編集` : title}</DialogTitle>
          </DialogHeader>

          {isEditing ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="resize-none w-full min-h-[200px] sm:min-h-[250px] md:min-h-[300px] max-h-[50vh] overflow-y-auto"
                  placeholder="テキストを入力..."
                  autoFocus
                />
              </div>
              <DialogFooter className="flex-shrink-0">
                <Button variant="outline" onClick={handleCancelEdit} disabled={loading}>
                  キャンセル
                </Button>
                <Button onClick={handleSaveClick} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存する"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div
                className="text-sm p-4 bg-muted/30 rounded-md overflow-y-auto"
                style={{
                  maxHeight: "60vh",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  whiteSpace: "pre-wrap"
                }}
              >
                {normalizedText || <span className="text-muted-foreground">（未入力）</span>}
              </div>
              {onEdit && (
                <DialogFooter>
                  <Button variant="outline" onClick={handleStartEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    編集する
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 確認ダイアログ */}
      <ChangeConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleConfirmCancel();
        }}
        changes={[
          {
            fieldName: title,
            oldValue: normalizedText || "(未入力)",
            newValue: editValue.trim() || "(未入力)",
          },
        ]}
        onConfirm={handleConfirmSave}
        loading={loading}
      />
    </>
  );
}
