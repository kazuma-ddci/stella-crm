"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDisplay } from "@/components/multi-file-upload";
import Link from "next/link";
import { getV2ContactHistoriesBySession } from "../session-actions";

type ContactHistoryRow = Awaited<
  ReturnType<typeof getV2ContactHistoriesBySession>
>[number];

function formatJstDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  titleLabel: string;
  staffOptions: { id: number; name: string }[];
};

export function SessionContactHistoriesModal({
  open,
  onOpenChange,
  sessionId,
  titleLabel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [histories, setHistories] = useState<ContactHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setSelectedId("");
    });
    getV2ContactHistoriesBySession(sessionId)
      .then((rows) => {
        if (cancelled) return;
        setHistories(rows);
        if (rows.length > 0) setSelectedId(String(rows[0].id));
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  const current = useMemo(
    () => histories.find((h) => String(h.id) === selectedId) ?? null,
    [histories, selectedId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="fullwidth"
        className="sm:!max-w-[1100px] max-h-[92vh] overflow-hidden flex flex-col"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{titleLabel} の接触履歴</DialogTitle>
        </DialogHeader>

        {/* プルダウン（複数ある場合） */}
        {histories.length > 1 && (
          <div className="flex items-center gap-2 pb-2 shrink-0">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              履歴を切り替え:
            </span>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[360px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {histories.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {formatJstDateTime(h.contactDate)} /{" "}
                    {h.contactMethodName ?? "—"} / {h.contactCategoryName ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              全 {histories.length} 件
            </span>
          </div>
        )}

        {/* 本文 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              読み込み中...
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 py-2">{error}</div>
          )}

          {!loading && !error && histories.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              この打ち合わせに紐づく接触履歴はまだありません。
              <div className="mt-2 text-xs">
                ※ Zoom議事録が自動取得されると、この打ち合わせに自動で紐づけされます。
              </div>
            </div>
          )}

          {!loading && !error && current && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">接触日時:</span>
                  <span className="ml-2 font-medium">
                    {formatJstDateTime(current.contactDate)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">接触方法:</span>
                  <span className="ml-2">{current.contactMethodName ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">プロジェクト・顧客種別:</span>
                  <span className="ml-2">
                    {current.customerTargetLabels.length > 0
                      ? current.customerTargetLabels.join("、")
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">接触種別:</span>
                  <span className="ml-2">{current.contactCategoryName ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">担当者:</span>
                  <span className="ml-2">
                    {current.staffNames.length > 0 ? current.staffNames.join("、") : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">先方参加者:</span>
                  <span className="ml-2">
                    {current.attendeeNames.length > 0
                      ? current.attendeeNames.join("、")
                      : "—"}
                  </span>
                </div>
              </div>

              {current.meetingMinutes && (
                <div className="text-sm">
                  <div className="text-muted-foreground mb-1">議事録:</div>
                  <pre className="whitespace-pre-wrap bg-white border rounded p-3 text-sm leading-relaxed font-[inherit]">
                    {current.meetingMinutes}
                  </pre>
                </div>
              )}

              {current.note && (
                <div className="text-sm">
                  <div className="text-muted-foreground mb-1">備考:</div>
                  <pre className="whitespace-pre-wrap bg-white border rounded p-3 text-sm leading-relaxed font-[inherit]">
                    {current.note}
                  </pre>
                </div>
              )}

              {current.files && current.files.length > 0 && (
                <div className="text-sm">
                  <div className="text-muted-foreground mb-1">添付ファイル:</div>
                  <FileDisplay files={current.files} />
                </div>
              )}

              <div className="pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/slp/records/contact-histories-v2/${current.id}`}>
                    V2接触履歴を開く
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t shrink-0">
          <div className="text-[11px] text-muted-foreground">
            編集は「接触履歴」タブから行ってください。
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
