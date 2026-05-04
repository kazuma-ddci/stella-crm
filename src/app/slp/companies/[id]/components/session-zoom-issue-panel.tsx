"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Video,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Link2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { SessionZoomForUI } from "./meeting-sessions-section";
import {
  regenerateZoomMeetingBySession,
  deleteZoomForSession,
  getZoomUrlNoticeDraft,
  markZoomUrlNoticeSkippedForSession,
  sendZoomUrlNoticeForSession,
  type ZoomUrlNoticeRecipient,
} from "../zoom-meeting-actions";
import { SessionManualZoomModal } from "./session-manual-zoom-modal";

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
 *   - primary あり → URL表示、コピー、再発行、削除
 *   - primary あり + ホスト非連携/未設定 → 「API連携なし」バッジ表示
 *   - primary なし → 「手動で発行する」「手動URLを入力する」ボタン
 *   - zoomError あり → エラー表示＋再発行ボタン
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
  const [copied, setCopied] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [noticeSending, setNoticeSending] = useState(false);
  const [noticeBody, setNoticeBody] = useState("");
  const [noticeJoinUrl, setNoticeJoinUrl] = useState<string | null>(null);
  const [noticeRecipients, setNoticeRecipients] = useState<ZoomUrlNoticeRecipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);

  const isApiLess = primary ? !primary.hostIntegrationActive : false;
  const noticeStatusLabel =
    primary?.urlNoticeStatus === "sent"
      ? "URL送信済み"
      : primary?.urlNoticeStatus === "failed"
        ? "一部送信失敗"
        : primary?.urlNoticeStatus === "skipped"
          ? "スタッフ判断で未送信"
          : primary?.urlNoticeStatus === "missing"
            ? "URL未発行"
            : "URL送信記録なし";
  const noticeStatusClass =
    primary?.urlNoticeStatus === "sent"
      ? "bg-green-50 text-green-700 border-green-200"
      : primary?.urlNoticeStatus === "failed"
        ? "bg-red-50 text-red-700 border-red-200"
        : primary?.urlNoticeStatus === "skipped"
          ? "bg-slate-50 text-slate-700 border-slate-200"
          : "bg-amber-50 text-amber-700 border-amber-200";

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
        if (r.url) await openZoomNoticeDialog();
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setWorking(false);
    }
  };

  const openZoomNoticeDialog = async () => {
    setNoticeOpen(true);
    setNoticeLoading(true);
    try {
      const draft = await getZoomUrlNoticeDraft(sessionId);
      if (!draft.ok) {
        toast.error(draft.message);
        setNoticeOpen(false);
        return;
      }
      setNoticeJoinUrl(draft.joinUrl);
      setNoticeBody(draft.bodyText);
      setNoticeRecipients(draft.recipients);
      setSelectedRecipientIds(draft.recipients.map((r) => r.lineFriendId));
    } finally {
      setNoticeLoading(false);
    }
  };

  const toggleRecipient = (lineFriendId: number, checked: boolean) => {
    setSelectedRecipientIds((prev) =>
      checked
        ? Array.from(new Set([...prev, lineFriendId]))
        : prev.filter((id) => id !== lineFriendId)
    );
  };

  const handleSendNotice = async () => {
    setNoticeSending(true);
    try {
      const result = await sendZoomUrlNoticeForSession({
        sessionId,
        bodyText: noticeBody,
        targetLineFriendIds: selectedRecipientIds,
      });
      if (result.ok) {
        toast.success(`${result.sentCount}件にZoom URLを送信しました`);
        setNoticeOpen(false);
        router.refresh();
      } else {
        toast.error(
          result.message ??
            `送信成功 ${result.sentCount}件 / 失敗 ${result.failedCount}件`
        );
        router.refresh();
      }
    } finally {
      setNoticeSending(false);
    }
  };

  const handleSkipNotice = async () => {
    setNoticeSending(true);
    try {
      const result = await markZoomUrlNoticeSkippedForSession(sessionId);
      if (result.ok) {
        toast.success("スタッフ判断で未送信として記録しました");
        setNoticeOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } finally {
      setNoticeSending(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "このZoom URLを削除しますか？\n削除すると未発行状態に戻り、自動発行または手動入力で再度登録できます。"
      )
    ) {
      return;
    }
    setWorking(true);
    try {
      const r = await deleteZoomForSession(sessionId);
      if (r.ok) {
        toast.success("Zoom URLを削除しました");
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
        {primary && isApiLess && (
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-50 text-amber-800 border-amber-300"
          >
            API連携なし
          </Badge>
        )}
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
          <div className="flex flex-wrap gap-2 pt-1">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={working}
            >
              {working ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1.5" />
              )}
              削除
            </Button>
          </div>
          <div className="text-[11px] text-red-700 pt-1">
            ※ 手動URLを入力したい場合は、先に「削除」してから入力してください。
          </div>
        </div>
      ) : primary && primary.joinUrl ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span>発行済み</span>
            <Badge variant="outline" className={`text-[10px] ${noticeStatusClass}`}>
              {noticeStatusLabel}
            </Badge>
            {primary.hostStaffName && (
              <span className="text-muted-foreground">
                （主催: {primary.hostStaffName}）
              </span>
            )}
            {!primary.hostStaffName && isApiLess && (
              <span className="text-muted-foreground">（主催: 未設定）</span>
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
          {isApiLess && (
            <div className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
              ※ API連携なしのため、録画・議事録の自動取得はできません。Zoom連携済み担当者のURLに切り替える場合は「削除」してから再発行してください。
            </div>
          )}
          {primary.urlNoticeStatus === "failed" && (
            <div className="text-[11px] text-red-700 bg-red-50 rounded px-2 py-1">
              Zoom URL通知に失敗した送信先があります。必要に応じて再発行またはURL送信を行ってください。
            </div>
          )}
          <div className="flex justify-end gap-2 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={openZoomNoticeDialog}
              disabled={working}
            >
              <Link2 className="h-3 w-3 mr-1" />
              URLを送信
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleDelete}
              disabled={working}
            >
              {working ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1" />
              )}
              削除
            </Button>
            {!isApiLess && (
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
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground space-y-1.5">
          <div>担当者・日時が設定されると自動でZoom URLが発行されます。</div>
          <div className="flex flex-wrap gap-2">
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
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setManualModalOpen(true)}
              disabled={working}
            >
              <Link2 className="h-3 w-3 mr-1" />
              手動URLを入力
            </Button>
          </div>
        </div>
      )}

      {/* 手動Zoom URL入力モーダル */}
      <SessionManualZoomModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        sessionId={sessionId}
        onDone={async () => {
          await openZoomNoticeDialog();
          router.refresh();
        }}
      />

      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>このZoom URLをお客様に送りますか？</DialogTitle>
            <DialogDescription>
              本文を確認・編集して送信できます。送らない場合も、スタッフ判断として記録します。
            </DialogDescription>
          </DialogHeader>
          {noticeLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              送信内容を準備しています...
            </div>
          ) : (
            <div className="space-y-4">
              {noticeJoinUrl && (
                <div className="rounded-md bg-muted p-3 text-xs break-all font-mono">
                  {noticeJoinUrl}
                </div>
              )}
              <div className="space-y-2">
                <div className="text-sm font-medium">送信先</div>
                <div className="space-y-2 rounded-md border p-3">
                  {noticeRecipients.length === 0 ? (
                    <div className="text-xs text-red-700">
                      LINE連携済みの送信対象者がいません。
                    </div>
                  ) : (
                    noticeRecipients.map((recipient) => (
                      <label
                        key={recipient.lineFriendId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedRecipientIds.includes(recipient.lineFriendId)}
                          onCheckedChange={(checked) =>
                            toggleRecipient(recipient.lineFriendId, checked === true)
                          }
                        />
                        <span>{recipient.label}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">送信本文</div>
                <Textarea
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  className="min-h-[220px]"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkipNotice}
              disabled={noticeLoading || noticeSending}
            >
              {noticeSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              送らない
            </Button>
            <Button
              type="button"
              onClick={handleSendNotice}
              disabled={
                noticeLoading ||
                noticeSending ||
                selectedRecipientIds.length === 0 ||
                noticeBody.trim() === ""
              }
            >
              {noticeSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              送信する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
