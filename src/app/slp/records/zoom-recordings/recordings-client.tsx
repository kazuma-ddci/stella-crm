"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  updateClaudeSummary,
  reflectClaudeSummaryToMinutes,
} from "@/app/slp/contact-histories/zoom-actions";
import {
  Loader2,
  Sparkles,
  Copy,
  CheckCircle2,
  Download,
  FileText,
  Video,
  MessageCircle,
  Users,
  Brain,
  ListChecks,
} from "lucide-react";

export type RecordingRow = {
  id: number;
  category: "briefing" | "consultation";
  companyName: string | null;
  contactDate: string | null;
  hostName: string | null;
  // 試行状態（取得を試みた・結果問わず完了）
  aiSummaryAttempted: boolean;
  chatAttempted: boolean;
  participantsAttempted: boolean;
  recordingAttempted: boolean;
  // データが実際に存在する
  hasAiSummary: boolean;
  hasMp4: boolean;
  hasTranscript: boolean;
  hasChat: boolean;
  hasParticipants: boolean;
  hasNextSteps: boolean;
  allFetched: boolean;
  // 内容（クリックで詳細表示用）
  aiCompanionSummary: string | null;
  summaryNextSteps: string | null;
  claudeSummary: string | null;
  claudeSummaryGeneratedAt: string | null;
  claudeSummaryModel: string | null;
  transcriptText: string | null;
  chatLogText: string | null;
  participantsJson: string | null;
  mp4Path: string | null;
  downloadStatus: string;
  companyRecordId: number | null;
  prolineUid: string | null;
};

type ParticipantInfo = {
  id: string;
  name: string;
  user_email: string | null;
  user_id: string | null;
  join_time: string | null;
  leave_time: string | null;
  duration: number;
};

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
      second: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}分` : `${m}分${s}秒`;
}

/**
 * 取得状態バッジ（アイコン + テキストラベル併記）
 *  - 緑: データあり（取得成功）
 *  - 灰色: 試行済みだがデータなし（その会議には存在しない情報）
 *  - 黄: 未試行（取得ボタンで取りに行ける）
 */
function StatusIcon({
  attempted,
  exists,
  Icon,
  label,
}: {
  attempted: boolean;
  exists: boolean;
  Icon: typeof Video;
  label: string;
}) {
  let containerCls: string;
  let title: string;
  let stateText: string;
  if (exists) {
    containerCls = "bg-green-50 text-green-800 border-green-200";
    title = `${label}: 取得済み`;
    stateText = "✓";
  } else if (attempted) {
    containerCls = "bg-muted text-muted-foreground border-muted-foreground/20";
    title = `${label}: 該当なし（試行済）`;
    stateText = "―";
  } else {
    containerCls = "bg-amber-50 text-amber-800 border-amber-200";
    title = `${label}: 未取得`;
    stateText = "○";
  }
  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${containerCls}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="font-medium">{label}</span>
      <span className="ml-0.5 font-bold">{stateText}</span>
    </div>
  );
}

/**
 * Claude要約の編集＋メイン議事録反映機能付きセクション
 */
function ClaudeSummarySection({
  recordingId,
  initialText,
  generatedAt,
  onLocalUpdate,
  onCopy,
  copied,
}: {
  recordingId: number;
  initialText: string;
  generatedAt: string | null;
  onLocalUpdate: (newText: string) => void;
  onCopy: (text: string) => void;
  copied: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [reflecting, setReflecting] = useState(false);

  // 他の Recording に切り替わったら draft を再セット
  useEffect(() => {
    setDraft(initialText);
    setEditing(false);
  }, [initialText, recordingId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await updateClaudeSummary(recordingId, draft);
      if (r.ok) {
        toast.success("Claude議事録を保存しました");
        onLocalUpdate(draft);
        setEditing(false);
      } else {
        toast.error(r.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReflect = async () => {
    setReflecting(true);
    try {
      // まず上書きなしで試行
      const r = await reflectClaudeSummaryToMinutes(recordingId, false);
      if (r.ok) {
        if (r.data.alreadyAppended && !r.data.appended) {
          // 既に反映済み → 上書き確認
          const confirmed = window.confirm(
            "既に反映済みです。上書きしますか？"
          );
          if (!confirmed) return;
          const r2 = await reflectClaudeSummaryToMinutes(recordingId, true);
          if (r2.ok && r2.data.appended) {
            toast.success("メイン議事録に上書き反映しました");
          } else if (!r2.ok) {
            toast.error(r2.error);
          }
        } else if (r.data.appended) {
          toast.success("メイン議事録に反映しました");
        }
      } else {
        toast.error(r.error);
      }
    } finally {
      setReflecting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-purple-800">
          Claude生成議事録 {generatedAt && `(${generatedAt})`}
        </div>
        <div className="flex gap-1">
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setEditing(true)}
            >
              編集
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  setDraft(initialText);
                  setEditing(false);
                }}
                disabled={saving}
              >
                破棄
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={handleSave}
                disabled={saving}
              >
                {saving && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                保存
              </Button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          className="text-sm font-mono bg-purple-50"
        />
      ) : (
        <div className="whitespace-pre-wrap text-sm bg-purple-50 border rounded-md p-3">
          {initialText}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopy(initialText)}
          disabled={editing}
        >
          <Copy className="h-3 w-3 mr-1" />
          {copied ? "コピー済" : "コピー"}
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={handleReflect}
          disabled={editing || reflecting}
        >
          {reflecting ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          メイン議事録に反映
        </Button>
      </div>
    </div>
  );
}

export function RecordingsClient({ rows }: { rows: RecordingRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [localRows, setLocalRows] = useState<RecordingRow[]>(rows);

  // Server Componentから新しいrowsが来たらlocalRowsに反映（router.refresh後など）
  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);
  const [currentSummary, setCurrentSummary] = useState<RecordingRow | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<RecordingRow | null>(null);
  const [currentChat, setCurrentChat] = useState<RecordingRow | null>(null);
  const [currentParticipants, setCurrentParticipants] = useState<RecordingRow | null>(null);
  const [thankYou, setThankYou] = useState<{
    recordingId: number;
    suggested: string;
    editing: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFetchAll = async (row: RecordingRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${row.id}/fetch-all`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.ok) {
        const r = data.result as {
          aiSummary: { ok: boolean; updated: boolean };
          files: { mp4: boolean; transcript: boolean; chat: boolean };
          participants: { count: number };
          participantsAi: { count: number };
        };
        const messages: string[] = [];
        if (r.aiSummary.updated) messages.push("AI要約取得");
        if (r.files.mp4) messages.push("動画DL");
        if (r.files.transcript) messages.push("文字起こしDL");
        if (r.files.chat) messages.push("チャットDL");
        if (r.participants.count > 0)
          messages.push(`参加者${r.participants.count}名`);
        if (messages.length > 0) {
          toast.success(`取得完了: ${messages.join(" / ")}`);
        } else {
          toast.info(
            "追加で取得できる情報はありませんでした（Zoom側で録画処理が完了していない可能性があります）"
          );
        }
        // Server Componentを再取得して最新状態を反映（ページ全体はリロードしない）
        router.refresh();
      } else {
        toast.error(`失敗: ${data.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "予期しないエラー");
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerateClaude = async (row: RecordingRow) => {
    if (!row.transcriptText) {
      toast.error("文字起こしがまだ取得されていません");
      return;
    }
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${row.id}/regenerate-summary`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.ok) {
        toast.success("Claude要約を再生成しました");
        const updated = localRows.map((r) =>
          r.id === row.id ? { ...r, claudeSummary: data.summary } : r
        );
        setLocalRows(updated);
        setCurrentSummary({ ...row, claudeSummary: data.summary });
      } else {
        toast.error(`失敗: ${data.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "予期しないエラー");
    } finally {
      setBusyId(null);
    }
  };

  const handleThankYou = async (row: RecordingRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${row.id}/thankyou-suggest`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.ok) {
        setThankYou({
          recordingId: row.id,
          suggested: data.text,
          editing: data.text,
        });
      } else {
        toast.error(`失敗: ${data.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "予期しないエラー");
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const parseParticipants = (json: string | null): ParticipantInfo[] => {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">日時</th>
              <th className="text-left p-3">種別</th>
              <th className="text-left p-3">事業者名</th>
              <th className="text-left p-3">担当</th>
              <th className="text-left p-3">取得状況</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {localRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-4 text-center text-muted-foreground"
                >
                  録画データはまだありません
                </td>
              </tr>
            )}
            {localRows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{r.contactDate ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">
                  {r.category === "briefing" ? "概要案内" : "導入希望商談"}
                </td>
                <td className="p-3">{r.companyName ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{r.hostName ?? "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusIcon
                      attempted={r.aiSummaryAttempted}
                      exists={r.hasAiSummary}
                      Icon={Brain}
                      label="AI要約"
                    />
                    <StatusIcon
                      attempted={r.recordingAttempted}
                      exists={r.hasMp4}
                      Icon={Video}
                      label="動画"
                    />
                    <StatusIcon
                      attempted={r.recordingAttempted}
                      exists={r.hasTranscript}
                      Icon={FileText}
                      label="文字起こし"
                    />
                    <StatusIcon
                      attempted={r.chatAttempted}
                      exists={r.hasChat}
                      Icon={MessageCircle}
                      label="チャット"
                    />
                    <StatusIcon
                      attempted={r.participantsAttempted}
                      exists={r.hasParticipants}
                      Icon={Users}
                      label="参加者"
                    />
                    {r.hasNextSteps && (
                      <StatusIcon
                        attempted={true}
                        exists={true}
                        Icon={ListChecks}
                        label="アクション"
                      />
                    )}
                  </div>
                  {r.allFetched && (
                    <div className="text-xs text-green-700 mt-1 font-medium">
                      ✓ 取得できる情報はすべて取得しました
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {r.allFetched ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="cursor-not-allowed opacity-70"
                        title="これ以上取得できる情報はありません"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                        全取得完了
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleFetchAll(r)}
                        disabled={busyId === r.id}
                        title="未取得の項目を取りに行きます（Zoom側がまだ準備中なら再度押してください）"
                      >
                        {busyId === r.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            取得中...
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3 mr-1" />
                            取得
                          </>
                        )}
                      </Button>
                    )}
                    {(r.hasAiSummary || r.claudeSummary) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentSummary(r)}
                      >
                        要約
                      </Button>
                    )}
                    {r.hasTranscript && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentTranscript(r)}
                      >
                        文字起こし
                      </Button>
                    )}
                    {r.hasChat && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentChat(r)}
                      >
                        チャット
                      </Button>
                    )}
                    {r.hasParticipants && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentParticipants(r)}
                      >
                        参加者
                      </Button>
                    )}
                    {r.hasTranscript && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateClaude(r)}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        Claude生成
                      </Button>
                    )}
                    {r.prolineUid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleThankYou(r)}
                        disabled={busyId === r.id}
                      >
                        お礼文案
                      </Button>
                    )}
                    {r.companyRecordId && (
                      <a
                        href={`/slp/companies/${r.companyRecordId}`}
                        className="text-xs text-blue-600 underline self-center px-1"
                      >
                        事業者へ
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 要約ビュー */}
      <Dialog open={!!currentSummary} onOpenChange={(o) => !o && setCurrentSummary(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>商談要約</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {currentSummary?.claudeSummary && (
              <ClaudeSummarySection
                recordingId={currentSummary.id}
                initialText={currentSummary.claudeSummary}
                generatedAt={currentSummary.claudeSummaryGeneratedAt}
                onLocalUpdate={(newText) => {
                  const updated = localRows.map((r) =>
                    r.id === currentSummary.id
                      ? { ...r, claudeSummary: newText }
                      : r
                  );
                  setLocalRows(updated);
                  setCurrentSummary({
                    ...currentSummary,
                    claudeSummary: newText,
                  });
                }}
                onCopy={handleCopy}
                copied={copied}
              />
            )}
            {currentSummary?.aiCompanionSummary && (
              <div>
                <div className="text-sm font-semibold mb-1 text-blue-800">
                  Zoom AI Companion 要約
                </div>
                <div className="whitespace-pre-wrap text-sm bg-blue-50 border rounded-md p-3">
                  {currentSummary.aiCompanionSummary}
                </div>
              </div>
            )}
            {currentSummary?.summaryNextSteps && (
              <div>
                <div className="text-sm font-semibold mb-1 text-orange-800">
                  ネクストステップ / アクションアイテム
                </div>
                <div className="whitespace-pre-wrap text-sm bg-orange-50 border rounded-md p-3">
                  {currentSummary.summaryNextSteps}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrentSummary(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文字起こしビュー */}
      <Dialog open={!!currentTranscript} onOpenChange={(o) => !o && setCurrentTranscript(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>全文書き起こし</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <div className="whitespace-pre-wrap text-xs bg-gray-50 border rounded-md p-3 font-mono">
              {currentTranscript?.transcriptText ?? "（文字起こしなし）"}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {currentTranscript?.transcriptText && (
              <Button
                variant="outline"
                onClick={() => handleCopy(currentTranscript.transcriptText!)}
              >
                <Copy className="h-3 w-3 mr-1" />
                {copied ? "コピー済" : "全文コピー"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setCurrentTranscript(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* チャットログビュー */}
      <Dialog open={!!currentChat} onOpenChange={(o) => !o && setCurrentChat(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>会議中チャットログ</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <div className="whitespace-pre-wrap text-sm bg-gray-50 border rounded-md p-3 font-mono">
              {currentChat?.chatLogText ?? "（チャットなし）"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrentChat(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 参加者ビュー */}
      <Dialog open={!!currentParticipants} onOpenChange={(o) => !o && setCurrentParticipants(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>参加者一覧</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {(() => {
              const list = parseParticipants(currentParticipants?.participantsJson ?? null);
              if (list.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">参加者情報なし</p>
                );
              }
              return (
                <table className="w-full text-sm border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">名前</th>
                      <th className="text-left p-2">メール</th>
                      <th className="text-left p-2">入室時刻</th>
                      <th className="text-left p-2">退室時刻</th>
                      <th className="text-left p-2">参加時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p, i) => (
                      <tr key={`${p.id}-${i}`} className="border-t">
                        <td className="p-2">{p.name || "—"}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {p.user_email || "—"}
                        </td>
                        <td className="p-2 text-xs">
                          {formatJstDateTime(p.join_time)}
                        </td>
                        <td className="p-2 text-xs">
                          {formatJstDateTime(p.leave_time)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatDuration(p.duration)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            <p className="text-xs text-muted-foreground mt-3">
              ※ 接続デバイス情報は Zoom Dashboard API（管理者権限）が必要なため取得していません。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrentParticipants(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* お礼文案 */}
      <Dialog open={!!thankYou} onOpenChange={(o) => !o && setThankYou(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>お礼メッセージ文案</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              AIが生成した下書きです。必要に応じて編集してから、コピーしてお客様のLINEへ送付してください。
            </p>
            <textarea
              className="w-full h-40 rounded-md border p-2 text-sm"
              value={thankYou?.editing ?? ""}
              onChange={(e) =>
                setThankYou((prev) =>
                  prev ? { ...prev, editing: e.target.value } : prev
                )
              }
            />
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => thankYou && handleCopy(thankYou.editing)}
              >
                <Copy className="h-3 w-3 mr-1" />
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> コピー済
                  </>
                ) : (
                  "クリップボードにコピー"
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                （送信はプロライン画面から手動で行ってください）
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThankYou(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
