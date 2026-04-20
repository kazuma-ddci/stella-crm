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
import { Textarea } from "@/components/ui/textarea";
import {
  resolveLinkRequestManually,
  rejectLinkRequest,
  searchMemberCandidates,
} from "./link-requests-actions";

type Candidate = {
  id: number;
  name: string;
  email: string | null;
  status: string | null;
  uid: string;
};

export type LinkRequestRow = {
  id: number;
  uid: string;
  submittedLineName: string | null;
  submittedEmail: string;
  status: string;
  reviewReason: string | null;
  resolvedMemberId: number | null;
  resolvedMemberName: string | null;
  resolvedAt: string | null;
  beaconType: string | null;
  beaconCalledAt: string | null;
  staffNote: string | null;
  createdAt: string;
  // 補助情報: SlpLineFriend.snsname（あれば）
  lineFriendSnsname: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LinkRequestRow | null;
};

const REASON_LABELS: Record<string, string> = {
  line_name_mismatch: "送信されたLINE名が公式LINE友達情報と一致しません",
  email_multiple_match: "メールアドレスが複数の組合員にマッチしました",
  uid_already_linked: "マッチした組合員には既に別のLINEが紐付いています",
  member_deleted: "マッチした組合員が削除済みです",
  contract_canceled: "マッチした組合員のステータスが「契約破棄」です",
  status_not_sent: "マッチした組合員のステータスが「契約書未送付」または「送付エラー」です",
  invalid_data: "マッチした組合員のステータスが「無効データ」です",
};

export function LinkResolveModal({ open, onOpenChange, request }: Props) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [staffNote, setStaffNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (!open || !request) return;
    setQuery(request.submittedEmail);
    setSelectedMemberId(request.resolvedMemberId);
    setStaffNote(request.staffNote ?? "");
  }, [open, request]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchMemberCandidates(query);
        if (result.ok) {
          setCandidates(result.data);
        } else {
          toast.error(result.error);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  const handleResolve = async () => {
    if (!request || !selectedMemberId) return;
    setSaving(true);
    try {
      const result = await resolveLinkRequestManually(
        request.id,
        selectedMemberId,
        staffNote.trim() || undefined
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("紐付けを完了しました");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    if (!confirm("この申請を却下します。よろしいですか？")) return;
    setRejecting(true);
    try {
      const result = await rejectLinkRequest(
        request.id,
        staffNote.trim() || undefined
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("申請を却下しました");
      onOpenChange(false);
      router.refresh();
    } finally {
      setRejecting(false);
    }
  };

  if (!request) return null;

  const reasonLabel = request.reviewReason
    ? REASON_LABELS[request.reviewReason] ?? request.reviewReason
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>LINE紐付け申請の対応</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 申請情報 */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <Row label="申請ID">#{request.id}</Row>
            <Row label="申請日時">{request.createdAt}</Row>
            <Row label="送信されたLINE名">{request.submittedLineName ?? "-"}</Row>
            <Row label="送信されたメールアドレス">
              <span className="font-mono break-all">{request.submittedEmail}</span>
            </Row>
            <Row label="UID">
              <span className="font-mono break-all text-xs">{request.uid}</span>
            </Row>
            <Row label="公式LINE友達情報のLINE名">
              {request.lineFriendSnsname ?? (
                <span className="text-muted-foreground">（友達情報なし）</span>
              )}
            </Row>
            {reasonLabel && (
              <div className="text-xs text-red-700 pt-1 border-t mt-2">
                <strong>判定:</strong> {reasonLabel}
              </div>
            )}
            {request.beaconType && request.beaconCalledAt && (
              <div className="text-xs text-green-700 pt-1 border-t mt-2">
                <strong>ビーコン発火済み:</strong>{" "}
                {request.beaconType === "signed"
                  ? "締結済み（D6DJAb2MNC）"
                  : "送付済み（G0JqiTyQx9）"}
                （{request.beaconCalledAt}）
              </div>
            )}
          </div>

          {/* 候補組合員選択 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">紐付ける組合員を選択</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="名前 / メールアドレス / No. で検索"
                className="pl-8"
              />
            </div>
            <div className="border rounded-lg max-h-[280px] overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  読み込み中...
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  該当する組合員が見つかりません
                </div>
              ) : (
                <ul className="divide-y">
                  {candidates.map((c) => {
                    const checked = c.id === selectedMemberId;
                    return (
                      <li
                        key={c.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                          checked ? "bg-blue-50" : ""
                        }`}
                        onClick={() => setSelectedMemberId(c.id)}
                      >
                        <input
                          type="radio"
                          checked={checked}
                          onChange={() => setSelectedMemberId(c.id)}
                        />
                        <span className="text-xs text-muted-foreground w-12 shrink-0">
                          #{c.id}
                        </span>
                        <span className="text-sm font-medium flex-1 truncate">
                          {c.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {c.email ?? ""}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {c.status ?? "-"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              新しい順に最大50件表示されます。デフォルトでは送信メアドで検索しています。
            </p>
          </div>

          {/* スタッフメモ */}
          <div className="space-y-1">
            <label className="text-sm font-medium">スタッフメモ（任意）</label>
            <Textarea
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              placeholder="対応内容や経緯のメモ"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={saving || rejecting}
          >
            {rejecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                却下中...
              </>
            ) : (
              "申請を却下"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || rejecting}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleResolve}
            disabled={saving || rejecting || !selectedMemberId}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                処理中...
              </>
            ) : (
              "選択した組合員に紐付ける"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex">
      <span className="w-44 text-muted-foreground shrink-0">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
