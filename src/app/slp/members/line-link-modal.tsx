"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchLineFriendsForLink, relinkMemberLineFriend } from "./actions";

type LineFriend = { id: number; uid: string; snsname: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: number;
  memberName: string;
  currentUid: string;
  currentFriendSnsname: string | null;
  submittedLineName: string | null;
  reason: "mismatch" | "unlinked";
};

export function LineLinkModal({
  open,
  onOpenChange,
  memberId,
  memberName,
  currentUid,
  currentFriendSnsname,
  submittedLineName,
  reason,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<LineFriend[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>(currentUid);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // モーダルを開いた時の初期化
  useEffect(() => {
    if (!open) return;
    setSelectedUid(currentUid);
    setQuery("");
  }, [open, currentUid]);

  // 候補取得（query変更時にdebounce）
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchLineFriendsForLink(query);
        if (result.ok) {
          setFriends(result.data);
        } else {
          toast.error(result.error);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleSave = async () => {
    if (!selectedUid) return;
    if (selectedUid === currentUid && reason === "mismatch") {
      // uidが同じだとlineNameだけ更新したい場合があるので、現状のsnsnameで上書きを許可
      // → relinkMemberLineFriend が同一uidでも snsname を再保存するためそのまま実行
    }
    setSaving(true);
    try {
      const result = await relinkMemberLineFriend(memberId, selectedUid);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("LINE紐付けを更新しました");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            LINE紐付けの確認・修正（{memberName}）
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 現状の情報 */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex">
              <span className="w-44 text-muted-foreground shrink-0">現在のUID</span>
              <span className="font-mono break-all">{currentUid || "-"}</span>
            </div>
            <div className="flex">
              <span className="w-44 text-muted-foreground shrink-0">
                プロラインから取得したLINE名
              </span>
              <span>
                {currentFriendSnsname ?? (
                  <span className="text-red-600">（公式LINE友達情報に未登録）</span>
                )}
              </span>
            </div>
            <div className="flex">
              <span className="w-44 text-muted-foreground shrink-0">
                フォーム送信されたLINE名
              </span>
              <span>{submittedLineName || "-"}</span>
            </div>
            {reason === "mismatch" && (
              <p className="text-xs text-red-600 pt-1">
                送信されたLINE名と公式LINE友達情報のLINE名が一致していません。違うURLで回答された可能性があります。
              </p>
            )}
            {reason === "unlinked" && (
              <p className="text-xs text-red-600 pt-1">
                このUIDは公式LINE友達情報に存在しません。プロライン同期が遅延している可能性、または別のUIDで紐付けすべき可能性があります。
              </p>
            )}
          </div>

          {/* 友だち選択 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              正しいLINE友達を選択
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="LINE名 または UID で検索"
                className="pl-8"
              />
            </div>
            <div className="border rounded-lg max-h-[300px] overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  読み込み中...
                </div>
              ) : friends.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  該当する友達が見つかりません
                </div>
              ) : (
                <ul className="divide-y">
                  {friends.map((f) => {
                    const checked = f.uid === selectedUid;
                    return (
                      <li
                        key={f.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                          checked ? "bg-blue-50" : ""
                        }`}
                        onClick={() => setSelectedUid(f.uid)}
                      >
                        <input
                          type="radio"
                          checked={checked}
                          onChange={() => setSelectedUid(f.uid)}
                          className="shrink-0"
                        />
                        <span className="text-xs text-muted-foreground w-12 shrink-0">
                          #{f.id}
                        </span>
                        <span className="text-sm font-medium flex-1 truncate">
                          {f.snsname || "（名前未設定）"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                          {f.uid}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              新しい順に最大50件表示されます。検索ボックスで絞り込んでください。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedUid}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                保存中...
              </>
            ) : (
              "変更して保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
