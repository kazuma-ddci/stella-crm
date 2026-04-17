"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Loader2,
  Video,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { SessionZoomForUI } from "./meeting-sessions-section";
import { regenerateZoomMeetingBySession } from "../zoom-meeting-actions";

type Props = {
  sessionId: number;
  categoryLabel: string;
  primary: SessionZoomForUI | null;
  /** zoom発行エラーがあれば表示（primary.zoomError から受け取る） */
  zoomError: string | null;
  zoomErrorAt: string | null;
};

/**
 * セッション毎の primary Zoom 管理パネル（商談カード内のラウンド詳細に配置）
 *
 * 表示:
 *   - primary あり → URL表示、コピー、再発行
 *   - primary なし → 「手動で発行する」ボタン（担当者・日時が未設定の場合はメッセージ表示）
 *   - zoomError あり → エラー表示＋再発行ボタン
 *
 * 発行成功時に「新しいZoom URLをお客様へ送付してください」のAlertDialogを表示する
 * （お客様への自動送信はしないので、スタッフが手動で送付する運用前提）。
 */
export function SessionZoomIssuePanel({
  sessionId,
  categoryLabel,
  primary,
  zoomError,
  zoomErrorAt,
}: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
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

  const handleIssue = async (isRegenerate: boolean) => {
    if (
      isRegenerate &&
      !confirm("Zoom URLを再発行しますか？既存のURLは無効になります。")
    ) {
      return;
    }
    setWorking(true);
    try {
      const r = await regenerateZoomMeetingBySession(sessionId);
      if (r.ok) {
        toast.success(
          isRegenerate ? "Zoom URLを再発行しました" : "Zoom URLを発行しました"
        );
        if (r.url) setManualSendUrl(r.url);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-blue-500" />
        <h4 className="font-semibold text-sm">Zoom 会議（{categoryLabel}）</h4>
      </div>

      {zoomError ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-2.5 space-y-2">
          <div className="flex items-start gap-2 text-xs text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Zoom発行エラー</div>
              <div className="mt-0.5 whitespace-pre-wrap break-words">
                {zoomError}
              </div>
              {zoomErrorAt && (
                <div className="text-red-600 mt-0.5">発生: {zoomErrorAt}</div>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleIssue(true)}
              disabled={working}
            >
              {working ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              再発行する
            </Button>
          </div>
        </div>
      ) : primary && primary.joinUrl ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span>発行済み</span>
            {primary.hostStaffName && (
              <span className="text-muted-foreground">
                （主催: {primary.hostStaffName}）
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <a
              href={primary.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 underline break-all flex-1 font-mono"
            >
              {primary.joinUrl}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => handleCopy(primary.joinUrl)}
            >
              <Copy className="h-3 w-3 mr-1" />
              {copied ? "コピー済" : "コピー"}
            </Button>
          </div>
          <div className="flex justify-end pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => handleIssue(true)}
              disabled={working}
            >
              {working ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              再発行
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground space-y-1.5">
          <div>担当者・日時が設定されると自動でZoom URLが発行されます。</div>
          <div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => handleIssue(false)}
              disabled={working}
            >
              {working ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              手動で発行する
            </Button>
          </div>
        </div>
      )}

      {/* 発行/再発行成功直後の手動送信アナウンス */}
      <AlertDialog
        open={!!manualSendUrl}
        onOpenChange={(open) => {
          if (!open) setManualSendUrl(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              新しいZoom URLをお客様へ送付してください
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Zoom URLが発行されました。このURLは
                  <strong>自動送信されません</strong>。
                  お手数ですが、下記URLをコピーしてお客様にお送りください。
                </p>
                <div className="rounded-md bg-muted p-3 text-sm break-all font-mono">
                  {manualSendUrl}
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    manualSendUrl && handleCopy(manualSendUrl)
                  }
                >
                  <Copy className="h-3 w-3 mr-2" />
                  {copied ? "コピー済" : "URLをコピー"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  ※ 以降のリマインド（前日10:00・開始1時間前）は新しい今回作成されたこのURLで自動送信されます。
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
