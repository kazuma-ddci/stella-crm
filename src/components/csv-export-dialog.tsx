"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";

export type CsvExportItem = {
  id: number | string;
  /** チェックリストに表示する短い見出し（会社名など） */
  primary: string;
  /** 補助情報（代表者名・ベンダー名・回答日時など） */
  secondary?: string;
};

type Props<T extends CsvExportItem> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: T[];
  /** 選択された items を受け取って CSV 出力（ダウンロード）を実行する */
  onExport: (selected: T[]) => void | Promise<void>;
  /** 既定で全選択にしたい場合 true */
  defaultAllSelected?: boolean;
  /** ボタン表示文字列のカスタマイズ */
  exportButtonLabel?: string;
  /** リスト下に補足表示したい場合 */
  footerNote?: ReactNode;
};

/**
 * 汎用 CSV 出力選択ダイアログ。
 * - チェックボックスでレコードを選択
 * - 「全選択」「全解除」「絞り込み（部分一致）」付き
 * - 出力ボタン押下で onExport(選択) を呼ぶ。ダウンロードは onExport 内で実装する想定。
 */
export function CsvExportDialog<T extends CsvExportItem>({
  open,
  onOpenChange,
  title,
  items,
  onExport,
  defaultAllSelected = true,
  exportButtonLabel = "CSV を出力",
  footerNote,
}: Props<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  // ダイアログを開いた時に既定状態にリセット
  useEffect(() => {
    if (open) {
      setFilter("");
      setSelected(
        defaultAllSelected ? new Set(items.map((i) => String(i.id))) : new Set(),
      );
    }
  }, [open, items, defaultAllSelected]);

  const filteredItems = useMemo(() => {
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (i) =>
        i.primary.toLowerCase().includes(q) ||
        (i.secondary?.toLowerCase().includes(q) ?? false),
    );
  }, [items, filter]);

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((i) => selected.has(String(i.id)));

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const i of filteredItems) next.delete(String(i.id));
      } else {
        for (const i of filteredItems) next.add(String(i.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    const chosen = items.filter((i) => selected.has(String(i.id)));
    if (chosen.length === 0) {
      alert("エクスポートするレコードを 1 件以上選択してください");
      return;
    }
    setExporting(true);
    try {
      await onExport(chosen);
      onOpenChange(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="検索（会社名・代表者名など）"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAllFiltered}
            >
              {allFilteredSelected ? "表示中を全解除" : "表示中を全選択"}
            </Button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded border bg-white">
            {filteredItems.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">該当レコードがありません</p>
            ) : (
              <ul className="divide-y">
                {filteredItems.map((item) => {
                  const idStr = String(item.id);
                  const checked = selected.has(idStr);
                  return (
                    <li key={idStr} className="px-3 py-2 hover:bg-gray-50">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(idStr)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.primary}</div>
                          {item.secondary && (
                            <div className="text-xs text-gray-500 truncate">{item.secondary}</div>
                          )}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              選択中: <strong>{selected.size}</strong> / 全 {items.length} 件
            </span>
            {footerNote}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            キャンセル
          </Button>
          <Button onClick={handleExport} disabled={exporting || selected.size === 0}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? "出力中..." : exportButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
