"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RPA_DOC_ITEMS, type RpaDocKey } from "@/lib/hojo/rpa-document-config";

export type RpaSelection = Record<RpaDocKey, boolean>;

type ExistingDocTypes = Record<RpaDocKey, boolean>;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: RpaSelection) => void;
  // 作成済み資料の判定用
  existing: ExistingDocTypes;
  // 助成金額が未入力なら支援制度申請書はチェック不可
  subsidyAmount: number | null;
};


export function RpaRunConfirmationDialog({
  open,
  onClose,
  onConfirm,
  existing,
  subsidyAmount,
}: Props) {
  const supportBlocked = subsidyAmount === null;

  const initialSelection = useMemo<RpaSelection>(
    () => ({
      trainingReport: true,
      supportApplication: !supportBlocked,
      businessPlan: true,
    }),
    [supportBlocked],
  );

  const [selected, setSelected] = useState<RpaSelection>(initialSelection);

  // モーダルを開くたびに初期状態にリセット
  // (open=trueのとき最新のinitialSelectionでリセット)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelected(initialSelection);
  }

  const hasAny = selected.trainingReport || selected.supportApplication || selected.businessPlan;

  const handleConfirm = () => {
    onConfirm(selected);
  };

  const renderItem = (key: RpaDocKey, label: string) => {
    const isCreated = existing[key];
    const isBlocked = key === "supportApplication" && supportBlocked;
    const disabled = isBlocked;
    return (
      <label
        key={key}
        className={`flex items-center gap-3 py-2 px-2 rounded ${disabled ? "opacity-60" : "hover:bg-gray-50 cursor-pointer"}`}
      >
        <Checkbox
          checked={selected[key]}
          onCheckedChange={(v) =>
            setSelected((prev) => ({ ...prev, [key]: v === true }))
          }
          disabled={disabled}
        />
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className={`text-xs ${isCreated ? "text-amber-700" : "text-green-700"}`}>
          （{isCreated ? "再作成" : "新規作成"}）
        </span>
        {isBlocked && (
          <span className="text-xs text-red-600">助成金額が未入力のため作成不可</span>
        )}
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>RPA実行</DialogTitle>
          <DialogDescription>
            保存されたフォーム回答データから以下の資料を作成します。よろしいですか？
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {RPA_DOC_ITEMS.map((item) => renderItem(item.key, item.label))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm} disabled={!hasAny}>
            はい
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
