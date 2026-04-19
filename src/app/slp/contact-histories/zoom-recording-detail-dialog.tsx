"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Copy,
  Sparkles,
  Brain,
  FileText,
  MessageCircle,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  getZoomRecordingDetail,
  updateClaudeSummary,
  reflectClaudeSummaryToMinutes,
} from "./zoom-actions";

type DetailData = {
  id: number;
  zoomMeetingId: string;
  joinUrl: string;
  label: string | null;
  isPrimary: boolean;
  state: string;
  hostStaffName: string | null;
  recordingStartAt: string | null;
  recordingEndAt: string | null;
  downloadStatus: string;
  downloadError: string | null;
  transcriptText: string | null;
  chatLogText: string | null;
  participantsJson: string | null;
  mp4Path: string | null;
  aiCompanionSummary: string | null;
  aiCompanionFetchedAt: string | null;
  summaryNextSteps: string | null;
  claudeSummary: string | null;
  claudeSummaryGeneratedAt: string | null;
  claudeSummaryModel: string | null;
  claudeMinutesAppendedAt: string | null;
  minutesAppendedAt: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: number;
  /** true: Claude編集・反映ボタンを非表示（view mode 想定） */
  readOnly?: boolean;
}

function formatJstDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export function ZoomRecordingDetailDialog({
  open,
  onOpenChange,
  recordingId,
  readOnly = false,
}: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [regeneratingClaude, setRegeneratingClaude] = useState(false);
  const [editingClaude, setEditingClaude] = useState(false);
  const [claudeDraft, setClaudeDraft] = useState("");
  const [savingClaude, setSavingClaude] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getZoomRecordingDetail(recordingId);
      if (r.ok) {
        setData(r.data);
        setClaudeDraft(r.data.claudeSummary ?? "");
        setEditingClaude(false);
      } else {
        toast.error(r.error);
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordingId]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const handleRegenerateClaude = async () => {
    if (!data?.transcriptText) {
      toast.error("文字起こしがまだ取得されていません");
      return;
    }
    setRegeneratingClaude(true);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${recordingId}/regenerate-summary`,
        { method: "POST" }
      );
      const respData = await res.json();
      if (respData.ok) {
        toast.success("Claude要約を生成しました");
        await load();
      } else {
        toast.error(`失敗: ${respData.message}`);
      }
    } finally {
      setRegeneratingClaude(false);
    }
  };

  const handleSaveClaudeEdit = async () => {
    setSavingClaude(true);
    try {
      const r = await updateClaudeSummary(recordingId, claudeDraft);
      if (r.ok) {
        toast.success("Claude議事録を保存しました");
        setEditingClaude(false);
        await load();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSavingClaude(false);
    }
  };

  const handleReflect = async () => {
    setReflecting(true);
    try {
      const r = await reflectClaudeSummaryToMinutes(recordingId, false);
      if (r.ok) {
        if (r.data.alreadyAppended && !r.data.appended) {
          const confirmed = window.confirm("既に反映済みです。上書きしますか？");
          if (!confirmed) return;
          const r2 = await reflectClaudeSummaryToMinutes(recordingId, true);
          if (r2.ok && r2.data.appended) {
            toast.success("メイン議事録に上書き反映しました");
            await load();
          } else if (!r2.ok) {
            toast.error(r2.error);
          }
        } else if (r.data.appended) {
          toast.success("メイン議事録に反映しました");
          await load();
        }
      } else {
        toast.error(r.error);
      }
    } finally {
      setReflecting(false);
    }
  };

  const participants: Array<{
    name: string;
    user_email?: string | null;
    join_time?: string | null;
    leave_time?: string | null;
    duration?: number;
  }> = (() => {
    if (!data?.participantsJson) return [];
    try {
      return JSON.parse(data.participantsJson);
    } catch {
      return [];
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Zoom 会議詳細 {data?.label && `（${data.label}）`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="py-10 text-center text-muted-foreground">
            データがありません
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* 基本情報 */}
            <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/20">
              <Row label="Meeting ID">{data.zoomMeetingId}</Row>
              <Row label="URL">
                <a
                  href={data.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline break-all"
                >
                  {data.joinUrl}
                </a>
              </Row>
              <Row label="ホスト">{data.hostStaffName ?? "—"}</Row>
              <Row label="状態">{data.state}</Row>
              <Row label="録画開始">{formatJstDateTime(data.recordingStartAt)}</Row>
              <Row label="録画終了">{formatJstDateTime(data.recordingEndAt)}</Row>
              <Row label="ダウンロード状態">{data.downloadStatus}</Row>
            </div>

            {/* AI Companion 要約 */}
            {data.aiCompanionSummary && (
              <Section
                title="Zoom AI Companion 要約"
                icon={<Brain className="h-4 w-4 text-blue-600" />}
                color="blue"
              >
                <pre className="whitespace-pre-wrap text-sm">{data.aiCompanionSummary}</pre>
              </Section>
            )}

            {/* ネクストステップ */}
            {data.summaryNextSteps && (
              <Section
                title="ネクストステップ / アクションアイテム"
                icon={<FileText className="h-4 w-4 text-orange-600" />}
                color="orange"
              >
                <pre className="whitespace-pre-wrap text-sm">{data.summaryNextSteps}</pre>
              </Section>
            )}

            {/* Claude生成議事録 */}
            <Section
              title="Claude生成議事録"
              icon={<Sparkles className="h-4 w-4 text-purple-600" />}
              color="purple"
              rightAction={
                !readOnly && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={handleRegenerateClaude}
                      disabled={regeneratingClaude || !data.transcriptText}
                    >
                      {regeneratingClaude ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      {data.claudeSummary ? "再生成" : "生成"}
                    </Button>
                  </div>
                )
              }
            >
              {data.claudeSummary ? (
                <>
                  {data.claudeSummaryGeneratedAt && (
                    <div className="text-xs text-muted-foreground mb-1">
                      生成日時: {formatJstDateTime(data.claudeSummaryGeneratedAt)}
                    </div>
                  )}
                  {editingClaude ? (
                    <Textarea
                      value={claudeDraft}
                      onChange={(e) => setClaudeDraft(e.target.value)}
                      rows={10}
                      className="text-sm font-mono"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm">
                      {data.claudeSummary}
                    </pre>
                  )}
                  {!readOnly && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {!editingClaude ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            setClaudeDraft(data.claudeSummary ?? "");
                            setEditingClaude(true);
                          }}
                        >
                          編集
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => setEditingClaude(false)}
                            disabled={savingClaude}
                          >
                            破棄
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={handleSaveClaudeEdit}
                            disabled={savingClaude}
                          >
                            {savingClaude && (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            保存
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => handleCopy(data.claudeSummary!)}
                        disabled={editingClaude}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {copied ? "コピー済" : "コピー"}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={handleReflect}
                        disabled={editingClaude || reflecting}
                      >
                        {reflecting ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        メイン議事録に反映
                      </Button>
                      {data.claudeMinutesAppendedAt && (
                        <span className="inline-flex items-center text-[11px] text-green-700 ml-1">
                          ✓ 反映済み（{formatJstDateTime(data.claudeMinutesAppendedAt)}）
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  まだ生成されていません。
                  {!readOnly && "「生成」ボタンで作成できます（文字起こしが取得済みの会議のみ）。"}
                </p>
              )}
            </Section>

            {/* 文字起こし */}
            {data.transcriptText && (
              <Section
                title="文字起こし"
                icon={<FileText className="h-4 w-4 text-slate-600" />}
                color="slate"
                rightAction={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => handleCopy(data.transcriptText!)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    コピー
                  </Button>
                }
              >
                <pre className="whitespace-pre-wrap text-xs max-h-60 overflow-auto">
                  {data.transcriptText}
                </pre>
              </Section>
            )}

            {/* チャット */}
            {data.chatLogText && (
              <Section
                title="チャットログ"
                icon={<MessageCircle className="h-4 w-4 text-emerald-600" />}
                color="emerald"
              >
                <pre className="whitespace-pre-wrap text-xs max-h-40 overflow-auto">
                  {data.chatLogText}
                </pre>
              </Section>
            )}

            {/* 参加者 */}
            {participants.length > 0 && (
              <Section
                title={`参加者 (${participants.length}名)`}
                icon={<Users className="h-4 w-4 text-indigo-600" />}
                color="indigo"
              >
                <ul className="text-xs space-y-1">
                  {participants.map((p, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.user_email && (
                        <span className="text-muted-foreground">{p.user_email}</span>
                      )}
                      {p.duration != null && (
                        <span className="text-muted-foreground">
                          {p.duration >= 60
                            ? `${Math.floor(p.duration / 60)}分`
                            : `${p.duration}秒`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* MP4 */}
            {data.mp4Path && (
              <Section
                title="録画ファイル（MP4）"
                icon={<Video className="h-4 w-4 text-red-600" />}
                color="red"
              >
                <a
                  href={data.mp4Path}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline break-all"
                >
                  {data.mp4Path}
                </a>
              </Section>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-xs flex-1">{children}</span>
    </div>
  );
}

function Section({
  title,
  icon,
  color,
  rightAction,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: "blue" | "orange" | "purple" | "slate" | "emerald" | "indigo" | "red";
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const bgMap = {
    blue: "bg-blue-50 border-blue-100",
    orange: "bg-orange-50 border-orange-100",
    purple: "bg-purple-50 border-purple-100",
    slate: "bg-slate-50 border-slate-200",
    emerald: "bg-emerald-50 border-emerald-100",
    indigo: "bg-indigo-50 border-indigo-100",
    red: "bg-red-50 border-red-100",
  };
  return (
    <div className={`rounded-lg border p-3 ${bgMap[color]}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {icon}
          <h5 className="text-sm font-semibold">{title}</h5>
        </div>
        {rightAction}
      </div>
      {children}
    </div>
  );
}
