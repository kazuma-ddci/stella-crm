"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface KpiCellProps {
  value: number | null;
  type: "integer" | "decimal" | "percentage" | "currency";
  editable?: boolean;
  onSave?: (value: number | null) => Promise<void>;
  className?: string;
  bgColor?: string; // 背景色クラス（例: "bg-orange-100"）
}

export function KpiCell({
  value,
  type,
  editable = false,
  onSave,
  className,
  bgColor,
}: KpiCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 表示用フォーマット
  const formatDisplay = useCallback(
    (val: number | null): string => {
      if (val === null || val === undefined) return "-";

      switch (type) {
        case "integer":
          return val.toLocaleString();
        case "decimal":
          return val.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        case "percentage":
          return `${val.toFixed(2)}%`;
        case "currency":
          return `¥${val.toLocaleString()}`;
        default:
          return String(val);
      }
    },
    [type]
  );

  // 編集開始時
  const handleStartEdit = useCallback(() => {
    if (!editable) return;
    setEditValue(value !== null ? String(value) : "");
    setIsEditing(true);
  }, [editable, value]);

  // 編集中のフォーカス設定
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 保存処理
  const handleSave = useCallback(async () => {
    if (!onSave) {
      setIsEditing(false);
      return;
    }

    const trimmed = editValue.trim();
    let newValue: number | null = null;

    if (trimmed !== "") {
      // カンマ、円記号、%を除去
      const cleaned = trimmed.replace(/[,¥%]/g, "");
      const parsed = parseFloat(cleaned);

      if (!isNaN(parsed)) {
        newValue = parsed;
      }
    }

    // 値が変わっていない場合はスキップ
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  }, [editValue, value, onSave]);

  // キーハンドラ
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        setIsEditing(false);
      }
    },
    [handleSave]
  );

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className={cn(
          "h-7 px-1 text-right text-xs w-full",
          isSaving && "opacity-50",
          className
        )}
      />
    );
  }

  return (
    <div
      onClick={handleStartEdit}
      className={cn(
        "h-7 px-1 flex items-center justify-end text-xs",
        bgColor,
        editable && "cursor-pointer hover:bg-muted/50",
        className
      )}
    >
      {formatDisplay(value)}
    </div>
  );
}
