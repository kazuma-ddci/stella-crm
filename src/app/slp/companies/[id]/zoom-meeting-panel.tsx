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
import { Loader2, Video, RefreshCw, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { regenerateZoomMeeting } from "./zoom-meeting-actions";

type Props = {
  companyRecordId: number;
  category: "briefing" | "consultation";
  joinUrl: string | null;
  meetingId: string | null;  // bigintは文字列化
  hostName: string | null;
  createdAt: string | null; // JST display
  error: string | null;
  errorAt: string | null;
};

export function ZoomMeetingPanel(props: Props) {
  const [regenerating, setRegenerating] = useState(false);
  const [manualSendUrl, setManualSendUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const label = props.category === "briefing" ? "概要案内" : "導入希望商談";

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
    if (!confirm("Zoom URLを再発行しますか？既存のURLは無効になります。")) return;
    setRegenerating(true);
    try {
      const r = await regenerateZoomMeeting(props.companyRecordId, props.category);
      if (r.ok) {
        toast.success("Zoom URLを再発行しました");
        if (r.url) setManualSendUrl(r.url);
      } else {
        toast.error(`再発行失敗: ${r.message}`);
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-blue-500" />
        <h4 className="font-semibold text-sm">Zoom 会議（{label}）</h4>
      </div>

      {props.error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Zoom発行エラー</div>
              <div className="text-xs mt-1 whitespace-pre-wrap break-words">{props.error}</div>
              {props.errorAt && (
                <div className="text-xs text-red-600 mt-1">発生: {props.errorAt}</div>
              )}
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
      ) : props.joinUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>発行済み</span>
            {props.hostName && <span className="text-muted-foreground">（主催: {props.hostName}）</span>}
            {props.createdAt && <span className="text-muted-foreground text-xs">{props.createdAt}</span>}
          </div>
          <div className="flex gap-2 items-center">
            <a
              href={props.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline break-all flex-1"
            >
              {props.joinUrl}
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(props.joinUrl!)}
            >
              <Copy className="h-3 w-3 mr-1" />
              {copied ? "コピー済" : "コピー"}
            </Button>
          </div>
          <div className="flex justify-end pt-1">
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
          <div className="mt-2">
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
                  Zoom URLが再発行されました。このURLは<strong>自動送信されません</strong>。
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

      <div className="text-xs text-muted-foreground pt-2 border-t">
        {props.meetingId && <span>Meeting ID: {props.meetingId}</span>}
      </div>
    </div>
  );
}
