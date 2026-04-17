"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Video,
  AlertCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  getContactHistoryZoomRecordings,
  retryZoomRecording,
  deleteZoomRecordingManual,
} from "./zoom-actions";
import { AddZoomUrlModal } from "./add-zoom-url-modal";
import { ZoomRecordingDetailDialog } from "./zoom-recording-detail-dialog";

type ZoomRow = {
  id: number;
  zoomMeetingId: string;
  joinUrl: string;
  scheduledAt: string | null;
  isPrimary: boolean;
  label: string | null;
  state: string;
  hostStaffName: string | null;
  zoomApiError: string | null;
  createdAt: string;
  hasRecording: boolean;
};

function StateBadge({ state }: { state: string }) {
  switch (state) {
    case "完了":
      return (
        <Badge className="bg-green-600 text-white text-xs">✅ 取得済み</Badge>
      );
    case "予定":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-900 text-xs">
          🕐 予定
        </Badge>
      );
    case "取得中":
      return (
        <Badge variant="secondary" className="text-xs">
          <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />
          取得中
        </Badge>
      );
    case "失敗":
      return <Badge variant="destructive" className="text-xs">⚠️ 失敗</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{state}</Badge>;
  }
}

export function ZoomRecordingSection({
  contactHistoryId,
  readOnly = false,
}: {
  contactHistoryId: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ZoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ZoomRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getContactHistoryZoomRecordings(contactHistoryId);
      if (r.ok) setRows(r.data);
      else toast.error(r.error);
    } finally {
      setLoading(false);
    }
  }, [contactHistoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRetry = async (row: ZoomRow) => {
    setRetryingId(row.id);
    try {
      const r = await retryZoomRecording(row.id);
      if (r.ok) {
        if (r.data.state === "完了") toast.success("議事録を取得しました");
        else if (r.data.state === "予定")
          toast.info("録画がまだのようなので予定状態に戻しました");
        else toast.warning("取得に失敗しました");
        await reload();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !deleteReason.trim()) return;
    setDeleting(true);
    try {
      const r = await deleteZoomRecordingManual(deleteTarget.id, deleteReason.trim());
      if (r.ok) {
        toast.success("Zoom情報を削除しました");
        setDeleteTarget(null);
        setDeleteReason("");
        await reload();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Video className="h-4 w-4" />
          Zoom情報
        </Label>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAddModalOpen(true)}
            className="text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Zoom 議事録連携を追加
          </Button>
        )}
      </div>

      {loading && rows.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          読み込み中...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
          Zoom情報はまだ登録されていません
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((z) => (
            <div
              key={z.id}
              className="flex items-start gap-2 rounded border p-2 bg-muted/10"
            >
              <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium">
                    {z.isPrimary ? "メイン" : z.label ?? "追加Zoom"}
                  </span>
                  <StateBadge state={z.state} />
                  {z.hostStaffName && (
                    <span className="text-[10px] text-muted-foreground">
                      ホスト: {z.hostStaffName}
                    </span>
                  )}
                </div>
                <a
                  href={z.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline break-all text-[11px] font-mono block"
                >
                  {z.joinUrl}
                </a>
                {z.zoomApiError && (
                  <div className="flex items-start gap-1 text-[10px] text-red-700">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="break-all">{z.zoomApiError}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setDetailId(z.id)}
                  title="詳細を見る"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  詳細
                </Button>
                {!readOnly && (z.state === "失敗" || z.state === "予定") && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => handleRetry(z)}
                    disabled={retryingId === z.id}
                  >
                    {retryingId === z.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        再取得
                      </>
                    )}
                  </Button>
                )}
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(z)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddZoomUrlModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        contactHistoryId={contactHistoryId}
        onDone={() => {
          reload();
          router.refresh();
        }}
      />

      {detailId !== null && (
        <ZoomRecordingDetailDialog
          open={detailId !== null}
          onOpenChange={(o) => {
            if (!o) setDetailId(null);
          }}
          recordingId={detailId}
          readOnly={readOnly}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zoom情報を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除すると再取得できなくなります。議事録に追記済みのテキストは残ります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="deleteReason">削除理由（必須）</Label>
            <Textarea
              id="deleteReason"
              rows={2}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting || !deleteReason.trim()}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
