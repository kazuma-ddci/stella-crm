"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSlpContactHistoriesBySession } from "@/app/slp/contact-histories/actions";

type ContactHistoryRow = Awaited<
  ReturnType<typeof getSlpContactHistoriesBySession>
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
  titleLabel: string; // 「初回 概要案内」等
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSlpContactHistoriesBySession(sessionId)
      .then((rows) => {
        if (!cancelled) setHistories(rows);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {titleLabel} の接触履歴
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
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

        {!loading && !error && histories.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] whitespace-nowrap">接触日時</TableHead>
                  <TableHead className="w-[90px] whitespace-nowrap">接触方法</TableHead>
                  <TableHead className="w-[90px] whitespace-nowrap">接触種別</TableHead>
                  <TableHead className="min-w-[220px]">議事録（先頭抜粋）</TableHead>
                  <TableHead className="w-[60px] text-right">詳細</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {histories.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatJstDateTime(h.contactDate)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.contactMethodName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.contactCategoryName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="line-clamp-2 whitespace-pre-wrap">
                        {h.meetingMinutes?.slice(0, 160) ?? "—"}
                        {h.meetingMinutes && h.meetingMinutes.length > 160 ? "…" : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                      >
                        <a
                          href={`/slp/records/contact-histories?highlight=${h.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="接触履歴一覧で詳細を見る"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground pt-2 border-t">
          編集は「接触履歴」タブから行ってください。
        </div>
      </DialogContent>
    </Dialog>
  );
}
