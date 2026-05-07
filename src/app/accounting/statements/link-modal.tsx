"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listLinkCandidatesForEntry,
  listLinksForEntry,
  replaceLinksForEntry,
  type EntryLinkRow,
  type GroupKind,
  type LinkCandidate,
  type LinkConflict,
  type ConflictResolution,
} from "./link-actions";
import { ConflictResolutionDialog } from "@/components/accounting/conflict-resolution-dialog";

type EntrySummary = {
  id: number;
  transactionDate: string;
  description: string;
  incomingAmount: number | null;
  outgoingAmount: number | null;
};

type EditableLink = {
  // 既存リンクなら id を保持。新規は undefined。
  existingLinkId?: number;
  groupKind: GroupKind;
  groupId: number;
  groupLabel: string;
  counterpartyName: string;
  amount: number;
  note: string;
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("ja-JP");
}

export function LinkEntryModal({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: EntrySummary;
  onSaved?: () => void;
}) {
  const [direction, setDirection] = useState<GroupKind | null>(null);
  const [links, setLinks] = useState<EditableLink[]>([]);
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<LinkConflict[] | null>(null);

  const totalAmount =
    (entry.incomingAmount ?? 0) > 0
      ? entry.incomingAmount!
      : entry.outgoingAmount ?? 0;
  const allocatedSum = useMemo(
    () => links.reduce((s, l) => s + (l.amount || 0), 0),
    [links]
  );
  const remaining = totalAmount - allocatedSum;

  const load = async () => {
    setLoading(true);
    try {
      const [existingLinks, candRes] = await Promise.all([
        listLinksForEntry(entry.id),
        listLinkCandidatesForEntry({ entryId: entry.id, search: "" }),
      ]);
      const existing: EditableLink[] = existingLinks.map((l: EntryLinkRow) => ({
        existingLinkId: l.id,
        groupKind: l.groupKind,
        groupId: l.groupId,
        groupLabel: l.groupLabel,
        counterpartyName: l.counterpartyName,
        amount: l.amount,
        note: l.note ?? "",
      }));
      setLinks(existing);
      if (candRes.ok) {
        setDirection(candRes.data.direction);
        setCandidates(candRes.data.candidates);
      } else {
        toast.error(candRes.error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry.id]);

  const refreshCandidates = async (s: string) => {
    const res = await listLinkCandidatesForEntry({
      entryId: entry.id,
      search: s,
    });
    if (res.ok) {
      setCandidates(res.data.candidates);
    }
  };

  const addCandidate = (c: LinkCandidate) => {
    if (!direction) return;
    if (links.some((l) => l.groupId === c.id && l.groupKind === direction)) {
      toast.warning("既に追加されています");
      return;
    }
    const defaultAmount = Math.max(0, Math.min(remaining, c.totalAmount ?? remaining));
    setLinks((prev) => [
      ...prev,
      {
        groupKind: direction,
        groupId: c.id,
        groupLabel: c.label,
        counterpartyName: c.counterpartyName,
        amount: defaultAmount,
        note: "",
      },
    ]);
  };

  const updateLink = (idx: number, patch: Partial<EditableLink>) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  };

  const removeLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const performSave = async (resolution?: ConflictResolution) => {
    setSaving(true);
    try {
      for (const l of links) {
        if (!Number.isInteger(l.amount) || l.amount <= 0) {
          toast.error(`金額は1円以上の整数で入力してください: ${l.groupLabel}`);
          return;
        }
      }
      // 分割合計 = 取引金額 のクライアント側ガード
      if (links.length > 0 && allocatedSum !== totalAmount) {
        toast.error(
          `紐付け金額の合計（${allocatedSum.toLocaleString("ja-JP")}円）が取引金額（${totalAmount.toLocaleString("ja-JP")}円）と一致しません`
        );
        return;
      }

      const res = await replaceLinksForEntry({
        entryId: entry.id,
        links: links.map((l) => ({
          groupKind: l.groupKind,
          groupId: l.groupId,
          amount: l.amount,
          note: l.note || null,
        })),
        conflictResolution: resolution,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.status === "conflicts") {
        setConflicts(res.data.conflicts);
        return;
      }
      toast.success(`${res.data.count}件の紐付けを保存しました`);
      setConflicts(null);
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => performSave();
  const handleResolveConflict = (resolution: ConflictResolution) => {
    setConflicts(null);
    performSave(resolution);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>請求/支払グループへの紐付け</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entry header */}
          <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{entry.transactionDate}</Badge>
              {entry.incomingAmount && entry.incomingAmount > 0 && (
                <Badge className="bg-green-600">
                  入金 {fmt(entry.incomingAmount)} 円
                </Badge>
              )}
              {entry.outgoingAmount && entry.outgoingAmount > 0 && (
                <Badge variant="destructive">
                  出金 {fmt(entry.outgoingAmount)} 円
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {entry.description}
            </div>
            <div className="text-xs flex gap-4">
              <span>
                割当合計: <strong>{fmt(allocatedSum)}</strong> 円
              </span>
              <span className={remaining < 0 ? "text-red-600" : ""}>
                残り: <strong>{fmt(remaining)}</strong> 円
              </span>
            </div>
          </div>

          {direction === null && !loading && (
            <p className="text-sm text-muted-foreground">
              入金額・出金額のどちらも0のため紐付けできません
            </p>
          )}

          {/* Existing links */}
          {direction !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">紐付け中のグループ</Label>
                <span className="text-xs text-muted-foreground">
                  {direction === "invoice" ? "入金 → 請求" : "出金 → 支払"}
                </span>
              </div>
              {links.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  まだ紐付いていません
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {links.map((l, idx) => (
                    <div
                      key={`${l.groupKind}-${l.groupId}`}
                      className="flex items-start gap-2 p-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {l.groupLabel}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {l.counterpartyName}
                        </div>
                      </div>
                      <Input
                        type="number"
                        value={l.amount}
                        onChange={(e) =>
                          updateLink(idx, {
                            amount: parseInt(e.target.value || "0", 10),
                          })
                        }
                        className="w-28 h-8 text-xs"
                        placeholder="金額"
                      />
                      <Input
                        value={l.note}
                        onChange={(e) =>
                          updateLink(idx, { note: e.target.value })
                        }
                        className="w-40 h-8 text-xs"
                        placeholder="メモ（任意）"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLink(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Candidate search */}
          {direction !== null && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">候補から追加</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    refreshCandidates(e.target.value);
                  }}
                  placeholder={
                    direction === "invoice"
                      ? "請求書番号 / 取引先名で検索"
                      : "管理番号 / 取引先名で検索"
                  }
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                {loading ? (
                  <div className="p-3 text-xs flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    読み込み中...
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">
                    候補がありません
                  </div>
                ) : (
                  candidates.map((c) => {
                    const linked = links.some(
                      (l) => l.groupId === c.id && l.groupKind === direction
                    );
                    return (
                      <div
                        key={c.id}
                        className="p-2 text-xs flex items-center gap-2 hover:bg-muted/40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.label}</div>
                          <div className="text-muted-foreground truncate">
                            {c.counterpartyName}
                            {c.expectedDate && ` / 予定 ${c.expectedDate}`}
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div>合計 {fmt(c.totalAmount)}</div>
                          {c.alreadyLinkedAmount > 0 && (
                            <div className="text-muted-foreground">
                              既割当 {fmt(c.alreadyLinkedAmount)}
                            </div>
                          )}
                        </div>
                        {c.statementLinkCompleted && (
                          <Badge variant="secondary" className="text-[10px]">
                            完了
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={linked ? "ghost" : "outline"}
                          disabled={linked}
                          onClick={() => addCandidate(c)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {linked ? "追加済" : "追加"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              direction === null ||
              (links.length > 0 && allocatedSum !== totalAmount)
            }
            title={
              links.length > 0 && allocatedSum !== totalAmount
                ? "割当合計が取引金額と一致しません"
                : undefined
            }
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                保存中
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConflictResolutionDialog
        open={conflicts !== null}
        conflicts={conflicts ?? []}
        onResolve={handleResolveConflict}
        onCancel={() => setConflicts(null)}
      />
    </Dialog>
  );
}
