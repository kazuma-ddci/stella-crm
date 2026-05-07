"use client";

/**
 * 請求/支払グループの詳細モーダル内に埋め込む「入出金履歴 紐付け」パネル。
 *
 * 機能:
 *  - そのグループに紐付いている入出金履歴を一覧表示（金額・編集削除）
 *  - 候補エントリ（同一法人・正しい方向）を検索・追加
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  listLinksForGroup,
  listEntryCandidatesForGroup,
  addLinkFromGroup,
  deleteLink,
  type GroupKind,
  type GroupLinkRow,
  type EntryCandidate,
  type LinkConflict,
  type ConflictResolution,
} from "@/app/accounting/statements/link-actions";
import { ConflictResolutionDialog } from "./conflict-resolution-dialog";

type Props = {
  groupKind: GroupKind;
  groupId: number;
  /** 任意: 編集後の親側リフレッシュを通知 */
  onChanged?: () => void;
  readOnly?: boolean;
  statementLinkCompleted?: boolean;
  showLinkedList?: boolean;
};

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("ja-JP");
}

export function GroupStatementLinkPanel({
  groupKind,
  groupId,
  onChanged,
  readOnly = false,
  statementLinkCompleted = false,
  showLinkedList = true,
}: Props) {
  const [links, setLinks] = useState<GroupLinkRow[]>([]);
  const [candidates, setCandidates] = useState<EntryCandidate[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<{ entryId: number; amount: number } | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [pending, setPending] = useState<{ entry: EntryCandidate; amount: number } | null>(null);
  const [conflicts, setConflicts] = useState<LinkConflict[] | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [linksRes, candRes] = await Promise.all([
        listLinksForGroup(groupKind, groupId),
        listEntryCandidatesForGroup({ groupKind, groupId, search: "" }),
      ]);
      setLinks(linksRes);
      if (candRes.ok) setCandidates(candRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKind, groupId]);

  useEffect(() => {
    if (statementLinkCompleted) setShowCandidates(false);
  }, [statementLinkCompleted]);

  const refreshCandidates = async (s: string) => {
    const res = await listEntryCandidatesForGroup({
      groupKind,
      groupId,
      search: s,
    });
    if (res.ok) setCandidates(res.data);
  };

  const performAdd = async (
    entry: EntryCandidate,
    amount: number,
    resolution?: ConflictResolution
  ) => {
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("金額は1円以上の整数で入力してください");
      return;
    }
    setAdding({ entryId: entry.id, amount });
    try {
      const res = await addLinkFromGroup({
        groupKind,
        groupId,
        entryId: entry.id,
        amount,
        conflictResolution: resolution,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.status === "conflicts") {
        setPending({ entry, amount });
        setConflicts(res.data.conflicts);
        return;
      }
      toast.success("紐付けを追加しました");
      setPending(null);
      setConflicts(null);
      await reload();
      onChanged?.();
    } finally {
      setAdding(null);
    }
  };

  const handleAdd = (entry: EntryCandidate, amount: number) =>
    performAdd(entry, amount);

  const handleResolveConflict = (resolution: ConflictResolution) => {
    if (!pending) return;
    const { entry, amount } = pending;
    setConflicts(null);
    performAdd(entry, amount, resolution);
  };

  const handleDelete = async (linkId: number) => {
    const res = await deleteLink(linkId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("紐付けを解除しました");
    await reload();
    onChanged?.();
  };

  const totalLinkedAmount = links.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          <h4 className="text-sm font-medium">
            {showLinkedList ? "入出金履歴の紐付け" : "候補から入出金履歴を追加"}
          </h4>
          {showLinkedList && links.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {links.length}件 / {fmt(totalLinkedAmount)}円
            </Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          読み込み中
        </div>
      ) : (
        <>
          {showLinkedList && (
            links.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                まだ入出金履歴が紐付いていません
              </p>
            ) : (
              <div className="border rounded divide-y text-xs">
                {links.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 p-2">
                    <Badge variant="outline" className="text-[10px]">
                      {l.transactionDate}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{l.description}</div>
                      <div className="text-muted-foreground text-[10px] truncate">
                        {l.bankAccountLabel}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="font-medium">{fmt(l.amount)} 円</div>
                      {(l.incomingAmount ?? l.outgoingAmount ?? 0) !== l.amount && (
                        <div className="text-[10px] text-muted-foreground">
                          取引額 {fmt(l.incomingAmount ?? l.outgoingAmount)}
                        </div>
                      )}
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(l.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {statementLinkCompleted ? (
            <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
              入出金履歴チェックが完了済みのため、候補追加は非表示です。
            </p>
          ) : !readOnly && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCandidates((v) => !v)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {showCandidates ? "追加を閉じる" : "入出金履歴を追加"}
            </Button>

            {showCandidates && (
              <div className="space-y-2 rounded-md border p-2 bg-muted/20">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      refreshCandidates(e.target.value);
                    }}
                    placeholder="摘要で検索"
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto border rounded divide-y">
                  {candidates.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">
                      候補がありません
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <CandidateRow
                        key={c.id}
                        candidate={c}
                        adding={adding?.entryId === c.id}
                        alreadyLinked={links.some((l) => l.entryId === c.id)}
                        onAdd={(amt) => handleAdd(c, amt)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </>
      )}

      <ConflictResolutionDialog
        open={conflicts !== null}
        conflicts={conflicts ?? []}
        onResolve={handleResolveConflict}
        onCancel={() => {
          setConflicts(null);
          setPending(null);
        }}
      />
    </div>
  );
}

function CandidateRow({
  candidate,
  alreadyLinked,
  adding,
  onAdd,
}: {
  candidate: EntryCandidate;
  alreadyLinked: boolean;
  adding: boolean;
  onAdd: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<number>(
    Math.max(0, candidate.amount - candidate.alreadyLinkedAmount)
  );

  return (
    <div className="flex items-center gap-2 p-2 text-xs">
      <Badge variant="outline" className="text-[10px]">
        {candidate.transactionDate}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="truncate">{candidate.description}</div>
        <div className="text-muted-foreground text-[10px] truncate">
          {candidate.bankAccountLabel} / 取引額 {fmt(candidate.amount)}
          {candidate.alreadyLinkedAmount > 0 &&
            ` / 既割当 ${fmt(candidate.alreadyLinkedAmount)}`}
        </div>
      </div>
      <Input
        type="number"
        value={amount}
        onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))}
        className="w-24 h-7 text-xs"
        placeholder="金額"
        disabled={alreadyLinked}
      />
      <Button
        size="sm"
        variant={alreadyLinked ? "ghost" : "outline"}
        disabled={alreadyLinked || adding}
        onClick={() => onAdd(amount)}
      >
        {adding ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : alreadyLinked ? (
          "追加済"
        ) : (
          "追加"
        )}
      </Button>
    </div>
  );
}
