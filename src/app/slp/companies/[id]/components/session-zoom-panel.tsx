"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Loader2, Video, RefreshCw, Copy, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { regenerateZoomMeetingBySession } from "../zoom-meeting-actions";
import type { SessionZoomForUI } from "./meeting-sessions-section";

type Props = {
  sessionId: number;
  categoryLabel: string; // "概要案内" | "導入希望商談"
  primaryZoom: SessionZoomForUI | null;
  additionalZooms: SessionZoomForUI[];
  zoomError: string | null;
  zoomErrorAt: string | null;
  onAddAdditionalZoom: () => void;
  onEditZoom: (z: SessionZoomForUI) => void;
  onDeleteZoom: (z: SessionZoomForUI) => void;
  onDataChange: () => void;
};

function formatJstDateTime(iso: string | null): string {
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

export function SessionZoomPanel({
  sessionId,
  categoryLabel,
  primaryZoom,
  additionalZooms,
  zoomError,
  zoomErrorAt,
  onAddAdditionalZoom,
  onEditZoom,
  onDeleteZoom,
  onDataChange,
}: Props) {
  const [regenerating, setRegenerating] = useState(false);
  const [manualSendUrl, setManualSendUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const handleRegenerate = async () => {
    const hasExisting = !!primaryZoom && !zoomError;
    if (hasExisting && !confirm("Zoom URLを再発行しますか？既存のURLは無効になります。")) return;

    setRegenerating(true);
    try {
      const r = await regenerateZoomMeetingBySession(sessionId);
      if (r.ok) {
        toast.success(hasExisting ? "Zoom URLを再発行しました" : "Zoom URLを発行しました");
        if (r.url) setManualSendUrl(r.url);
        onDataChange();
      } else {
        toast.error(`発行失敗: ${r.message}`);
      }
    } finally {
      setRegenerating(false);
    }
  };

  const joinUrl = primaryZoom?.joinUrl ?? null;
  const hostName = primaryZoom?.hostStaffName ?? null;

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-blue-500" />
        <h4 className="font-semibold text-sm">Zoom 会議（{categoryLabel}）</h4>
      </div>

      {zoomError ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Zoom発行エラー</div>
              <div className="text-xs mt-1 whitespace-pre-wrap break-words">{zoomError}</div>
              {zoomErrorAt && <div className="text-xs text-red-600 mt-1">発生: {zoomErrorAt}</div>}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-2" />
              )}
              再発行する
            </Button>
          </div>
        </div>
      ) : joinUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>発行済み</span>
            {hostName && <span className="text-muted-foreground">（主催: {hostName}）</span>}
            {primaryZoom?.scheduledAt && (
              <span className="text-muted-foreground text-xs">
                {formatJstDateTime(primaryZoom.scheduledAt)}
              </span>
            )}
            {primaryZoom?.hasRecording && (
              <span className="text-[10px] px-1 py-0 rounded bg-green-100 text-green-800 border border-green-200">
                議事録あり
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <a
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline break-all flex-1"
            >
              {joinUrl}
            </a>
            <Button variant="ghost" size="sm" onClick={() => handleCopy(joinUrl)}>
              <Copy className="h-3 w-3 mr-1" />
              {copied ? "コピー済" : "コピー"}
            </Button>
          </div>
          <div className="flex justify-end pt-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddAdditionalZoom}
            >
              <Plus className="h-3 w-3 mr-1" />
              追加Zoom
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-2" />
              )}
              再発行
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          担当者・日時が設定されると自動でZoom URLが発行されます。
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-2" />
              )}
              手動で発行する
            </Button>
          </div>
        </div>
      )}

      {/* 追加Zoom一覧 */}
      {additionalZooms.length > 0 && (
        <div className="rounded bg-white p-2 border space-y-2">
          <div className="text-xs text-muted-foreground">追加Zoom</div>
          <div className="space-y-1.5">
            {additionalZooms.map((z) => (
              <div
                key={z.id}
                className="flex items-center gap-2 text-xs rounded border p-1.5 bg-muted/20"
              >
                <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{z.label ?? "追加Zoom"}</span>
                    {z.hasRecording && (
                      <span className="text-[10px] px-1 py-0 rounded bg-green-100 text-green-800 border border-green-200">
                        議事録あり
                      </span>
                    )}
                    {z.scheduledAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatJstDateTime(z.scheduledAt)}
                      </span>
                    )}
                  </div>
                  <a
                    href={z.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline break-all text-[11px] font-mono"
                  >
                    {z.joinUrl}
                  </a>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onEditZoom(z)}
                  >
                    編集
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-red-600 hover:bg-red-50"
                    onClick={() => onDeleteZoom(z)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {primaryZoom?.zoomMeetingId && (
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Meeting ID: {primaryZoom.zoomMeetingId}
        </div>
      )}

      {/* 再発行成功直後の手動送信アナウンス */}
      <AlertDialog
        open={!!manualSendUrl}
        onOpenChange={(open) => {
          if (!open) setManualSendUrl(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>新しいZoom URLをお客様へ送付してください</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Zoom URLが発行/再発行されました。このURLは
                  <strong>自動送信されません</strong>。
                  お手数ですが、下記URLをコピーしてお客様にお送りください。
                </p>
                <div className="rounded-md bg-muted p-3 text-sm break-all font-mono">
                  {manualSendUrl}
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => manualSendUrl && handleCopy(manualSendUrl)}
                >
                  <Copy className="h-3 w-3 mr-2" />
                  {copied ? "コピー済" : "URLをコピー"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  ※ 以降のリマインド（前日10:00・開始1時間前）は新しいURLで自動送信されます。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction>確認しました</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
