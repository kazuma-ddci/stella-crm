"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2,
  Sparkles,
  Copy,
  Brain,
  FileText,
  MessageCircle,
  Users,
  Video,
  Download,
  ListChecks,
  History,
  ExternalLink,
} from "lucide-react";
import {
  getZoomRecordingDetail,
  updateClaudeSummary,
  reflectClaudeSummaryToMinutes,
  getContactHistoryForZoomRecording,
  updateContactHistoryFromZoomModal,
} from "@/app/slp/contact-histories/zoom-actions";

type DetailData = {
  id: number;
  zoomMeetingId: string;
  joinUrl: string;
  label: string | null;
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
  summaryNextSteps: string | null;
  claudeSummary: string | null;
  claudeSummaryGeneratedAt: string | null;
  claudeMinutesAppendedAt: string | null;
  minutesAppendedAt: string | null;
};

type ContactHistoryData = {
  contactHistoryId: number;
  contactDate: string;
  staffName: string | null;
  contactMethodName: string | null;
  contactCategoryName: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  companyRecordId: number | null;
  companyRecordName: string | null;
};

type Participant = {
  id?: string;
  name: string;
  user_email?: string | null;
  join_time?: string | null;
  leave_time?: string | null;
  duration?: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: number;
  /** Meta情報: 取得可能フラグ（未取得項目があるか） */
  hasRetryable: boolean;
  /** 一覧で表示している事業者名（タイトル表示用） */
  companyName?: string | null;
}

/**
 * Zoom Meeting ID をハイフン区切り表記にしつつ、iOS Safariの
 * 電話番号自動検出を避けるために各グループを別spanでレンダリング。
 */
function MeetingIdText({ id }: { id: string | null | undefined }) {
  if (!id) return <>—</>;
  const digits = id.replace(/\D/g, "");
  if (!digits) return <>{id}</>;
  const groups: string[] = [];
  for (let i = digits.length; i > 0; i -= 4) {
    groups.unshift(digits.slice(Math.max(0, i - 4), i));
  }
  return (
    <span>
      {groups.map((g, i) => (
        <span key={i}>
          {i > 0 && <span>-</span>}
          <span>{g}</span>
        </span>
      ))}
    </span>
  );
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

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}分` : `${m}分${s}秒`;
}

export function UnifiedDetailModal({
  open,
  onOpenChange,
  recordingId,
  hasRetryable,
  companyName,
}: Props) {
  const router = useRouter();

  const [data, setData] = useState<DetailData | null>(null);
  const [ch, setCh] = useState<ContactHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");

  // 各種action中フラグ
  const [fetching, setFetching] = useState(false);
  const [regenClaude, setRegenClaude] = useState(false);
  const [savingClaude, setSavingClaude] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [editingClaude, setEditingClaude] = useState(false);
  const [claudeDraft, setClaudeDraft] = useState("");

  // 接触履歴編集
  const [editingCh, setEditingCh] = useState(false);
  const [chMinutes, setChMinutes] = useState("");
  const [chNote, setChNote] = useState("");
  const [chCustomerParticipants, setChCustomerParticipants] = useState("");
  const [savingCh, setSavingCh] = useState(false);

  // 確認ダイアログ状態
  const [confirmDialog, setConfirmDialog] = useState<
    | { kind: "claude-generate"; label: string }
    | null
  >(null);

  // コピーフィードバック
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        getZoomRecordingDetail(recordingId),
        getContactHistoryForZoomRecording(recordingId),
      ]);
      if (d.ok) {
        setData(d.data);
        setClaudeDraft(d.data.claudeSummary ?? "");
      } else {
        toast.error(d.error);
        onOpenChange(false);
      }
      if (c.ok) {
        setCh(c.data);
        setChMinutes(c.data.meetingMinutes ?? "");
        setChNote(c.data.note ?? "");
        setChCustomerParticipants(c.data.customerParticipants ?? "");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setActiveTab("summary");
      setEditingClaude(false);
      setEditingCh(false);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordingId]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFor(key);
      setTimeout(() => setCopiedFor(null), 1500);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const handleFetchAll = async () => {
    setFetching(true);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${recordingId}/fetch-all`,
        { method: "POST" }
      );
      const resp = await res.json();
      if (resp.ok) {
        const r = resp.result as {
          aiSummary: { ok: boolean; updated: boolean };
          files: { mp4: boolean; transcript: boolean; chat: boolean };
          participants: { count: number };
        };
        const messages: string[] = [];
        if (r.aiSummary.updated) messages.push("AI要約");
        if (r.files.mp4) messages.push("動画");
        if (r.files.transcript) messages.push("文字起こし");
        if (r.files.chat) messages.push("チャット");
        if (r.participants.count > 0)
          messages.push(`参加者${r.participants.count}名`);
        if (messages.length > 0) {
          toast.success(`取得完了: ${messages.join(" / ")}`);
        } else {
          toast.info(
            "追加で取得できる情報はありませんでした（Zoom側で録画処理中の可能性があります）"
          );
        }
        await load();
        router.refresh();
      } else {
        toast.error(`失敗: ${resp.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "予期しないエラー");
    } finally {
      setFetching(false);
    }
  };

  const doClaudeGenerate = async () => {
    if (!data?.transcriptText) {
      toast.error("文字起こしがまだ取得されていません");
      return;
    }
    setRegenClaude(true);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${recordingId}/regenerate-summary`,
        { method: "POST" }
      );
      const resp = await res.json();
      if (resp.ok) {
        toast.success("Claude議事録を生成しました");
        await load();
      } else {
        toast.error(`失敗: ${resp.message}`);
      }
    } finally {
      setRegenClaude(false);
    }
  };

  const handleSaveClaude = async () => {
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

  const handleSaveCh = async () => {
    setSavingCh(true);
    try {
      const r = await updateContactHistoryFromZoomModal(recordingId, {
        meetingMinutes: chMinutes,
        note: chNote,
        customerParticipants: chCustomerParticipants,
      });
      if (r.ok) {
        toast.success("接触履歴を保存しました");
        setEditingCh(false);
        await load();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSavingCh(false);
    }
  };

  // 参加者パース
  const participants: Participant[] = (() => {
    if (!data?.participantsJson) return [];
    try {
      const p = JSON.parse(data.participantsJson);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  })();

  const title = companyName
    ? `${companyName}様 Zoom商談詳細`
    : "Zoom商談詳細";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="fullwidth"
          className="sm:!max-w-[880px] max-h-[74vh] h-[74vh] overflow-hidden flex flex-col"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Video className="h-4 w-4" />
              {title}
              {data?.label && (
                <span className="text-sm text-muted-foreground">
                  ({data.label})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* ヘッダの取得ボタン */}
          {!loading && data && hasRetryable && (
            <div className="flex items-center justify-between rounded-md border bg-amber-50 border-amber-200 px-3 py-2">
              <span className="text-xs text-amber-900">
                未取得の情報があります。Zoom側で準備できていれば取得できます。
              </span>
              <Button
                size="sm"
                onClick={handleFetchAll}
                disabled={fetching}
                className="shrink-0"
              >
                {fetching ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    取得中...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3 mr-1" />
                    未取得分を取得
                  </>
                )}
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10 flex-1">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-muted-foreground flex-1">
              データがありません
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="w-full justify-start flex-wrap h-auto">
                <TabsTrigger value="summary">
                  <Brain className="h-3 w-3 mr-1" /> 要約
                </TabsTrigger>
                <TabsTrigger value="transcript">
                  <FileText className="h-3 w-3 mr-1" /> 文字起こし
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageCircle className="h-3 w-3 mr-1" /> チャット
                </TabsTrigger>
                <TabsTrigger value="participants">
                  <Users className="h-3 w-3 mr-1" /> 参加者
                </TabsTrigger>
                <TabsTrigger value="contact">
                  <History className="h-3 w-3 mr-1" /> 接触履歴
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-scroll mt-3 pr-1">
                {/* ============ 要約タブ ============ */}
                <TabsContent value="summary" className="space-y-4 mt-0">
                  {/* 基本情報 */}
                  <InfoBar
                    items={[
                      {
                        label: "Meeting ID",
                        value: <MeetingIdText id={data.zoomMeetingId} />,
                      },
                      { label: "ホスト", value: data.hostStaffName ?? "—" },
                      {
                        label: "商談状況",
                        value: data.state,
                      },
                    ]}
                  />

                  {/* Zoom AI要約 */}
                  <SectionCard
                    title="Zoom AI Companion 要約"
                    icon={<Brain className="h-4 w-4 text-blue-600" />}
                  >
                    {data.aiCompanionSummary ? (
                      <pre className="whitespace-pre-wrap text-sm">
                        {data.aiCompanionSummary}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        未取得。ヘッダーの「取得」ボタンで取りに行けます。
                      </p>
                    )}
                  </SectionCard>

                  {/* Next Steps */}
                  {data.summaryNextSteps && (
                    <SectionCard
                      title="ネクストステップ / アクションアイテム"
                      icon={<ListChecks className="h-4 w-4 text-orange-600" />}
                    >
                      <pre className="whitespace-pre-wrap text-sm">
                        {data.summaryNextSteps}
                      </pre>
                    </SectionCard>
                  )}

                  {/* Claude議事録 */}
                  <SectionCard
                    title="Claude生成議事録"
                    icon={<Sparkles className="h-4 w-4 text-purple-600" />}
                    rightAction={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() =>
                          setConfirmDialog({
                            kind: "claude-generate",
                            label: data.claudeSummary ? "再生成" : "生成",
                          })
                        }
                        disabled={regenClaude || !data.transcriptText}
                      >
                        {regenClaude ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        {data.claudeSummary ? "再生成" : "生成"}
                      </Button>
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
                            rows={12}
                            className="text-sm font-mono"
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm">
                            {data.claudeSummary}
                          </pre>
                        )}
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
                                onClick={handleSaveClaude}
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
                            onClick={() =>
                              handleCopy(data.claudeSummary!, "claude")
                            }
                            disabled={editingClaude}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            {copiedFor === "claude" ? "コピー済" : "コピー"}
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
                              ✓ 反映済み（
                              {formatJstDateTime(data.claudeMinutesAppendedAt)}）
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        まだ生成されていません。文字起こしが取得済みの会議で「生成」ボタンから作成できます。
                      </p>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* ============ 文字起こしタブ ============ */}
                <TabsContent value="transcript" className="mt-0">
                  {data.transcriptText ? (
                    <SectionCard
                      title="文字起こし"
                      icon={<FileText className="h-4 w-4 text-slate-600" />}
                      rightAction={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            handleCopy(data.transcriptText!, "transcript")
                          }
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {copiedFor === "transcript" ? "コピー済" : "コピー"}
                        </Button>
                      }
                    >
                      <pre className="whitespace-pre-wrap text-xs max-h-[50vh] overflow-auto bg-slate-50 p-2 rounded">
                        {data.transcriptText}
                      </pre>
                    </SectionCard>
                  ) : (
                    <EmptyState
                      icon={<FileText className="h-6 w-6 text-muted-foreground" />}
                      message="文字起こしはまだ取得されていません。"
                    />
                  )}
                </TabsContent>

                {/* ============ チャットタブ ============ */}
                <TabsContent value="chat" className="mt-0">
                  {data.chatLogText ? (
                    <SectionCard
                      title="会議中チャット"
                      icon={<MessageCircle className="h-4 w-4 text-emerald-600" />}
                      rightAction={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            handleCopy(data.chatLogText!, "chat")
                          }
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {copiedFor === "chat" ? "コピー済" : "コピー"}
                        </Button>
                      }
                    >
                      <pre className="whitespace-pre-wrap text-xs max-h-[50vh] overflow-auto bg-emerald-50 p-2 rounded">
                        {data.chatLogText}
                      </pre>
                    </SectionCard>
                  ) : (
                    <EmptyState
                      icon={
                        <MessageCircle className="h-6 w-6 text-muted-foreground" />
                      }
                      message="チャット記録はありません。会議中に誰もチャットをしなかった場合は取得対象が存在しません。"
                    />
                  )}
                </TabsContent>

                {/* ============ 参加者タブ ============ */}
                <TabsContent value="participants" className="mt-0">
                  {participants.length > 0 ? (
                    <SectionCard
                      title={`参加者 (${participants.length}名)`}
                      icon={<Users className="h-4 w-4 text-indigo-600" />}
                    >
                      <table className="w-full text-sm border-t">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2">名前</th>
                            <th className="text-left p-2">メール</th>
                            <th className="text-left p-2">入室</th>
                            <th className="text-left p-2">退室</th>
                            <th className="text-left p-2">参加時間</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map((p, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">{p.name || "—"}</td>
                              <td className="p-2 text-xs text-muted-foreground">
                                {p.user_email || "—"}
                              </td>
                              <td className="p-2 text-xs">
                                {formatJstDateTime(p.join_time ?? null)}
                              </td>
                              <td className="p-2 text-xs">
                                {formatJstDateTime(p.leave_time ?? null)}
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                {formatDuration(p.duration)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </SectionCard>
                  ) : (
                    <EmptyState
                      icon={<Users className="h-6 w-6 text-muted-foreground" />}
                      message="参加者情報はまだ取得されていないか、存在しません。"
                    />
                  )}
                </TabsContent>

                {/* ============ 接触履歴タブ ============ */}
                <TabsContent value="contact" className="mt-0">
                  {ch ? (
                    <SectionCard
                      title="紐付く接触履歴"
                      icon={<History className="h-4 w-4 text-gray-600" />}
                      rightAction={
                        ch.companyRecordId && (
                          <a
                            href={`/slp/companies/${ch.companyRecordId}`}
                            className="text-xs text-blue-600 underline inline-flex items-center gap-1"
                          >
                            事業者ページへ
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )
                      }
                    >
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <InfoRow label="事業者" value={ch.companyRecordName} />
                        <InfoRow
                          label="接触日時"
                          value={formatJstDateTime(ch.contactDate)}
                        />
                        <InfoRow label="担当スタッフ" value={ch.staffName} />
                        <InfoRow label="接触方法" value={ch.contactMethodName} />
                        <InfoRow
                          label="接触種別"
                          value={ch.contactCategoryName}
                        />
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs mb-1 block">顧客参加者</Label>
                          {editingCh ? (
                            <Input
                              value={chCustomerParticipants}
                              onChange={(e) =>
                                setChCustomerParticipants(e.target.value)
                              }
                              placeholder="例: 田中様、佐藤様"
                            />
                          ) : (
                            <div className="text-sm">
                              {ch.customerParticipants || "—"}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs mb-1 block">議事録</Label>
                          {editingCh ? (
                            <Textarea
                              value={chMinutes}
                              onChange={(e) => setChMinutes(e.target.value)}
                              rows={10}
                              className="text-sm"
                              placeholder="議事録を入力してください"
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm border rounded p-2 bg-gray-50 min-h-[3rem]">
                              {ch.meetingMinutes || "（未記入）"}
                            </pre>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs mb-1 block">メモ</Label>
                          {editingCh ? (
                            <Textarea
                              value={chNote}
                              onChange={(e) => setChNote(e.target.value)}
                              rows={3}
                              className="text-sm"
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm border rounded p-2 bg-gray-50 min-h-[2rem]">
                              {ch.note || "（未記入）"}
                            </pre>
                          )}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {!editingCh ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCh(true)}
                            >
                              編集
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setChMinutes(ch.meetingMinutes ?? "");
                                  setChNote(ch.note ?? "");
                                  setChCustomerParticipants(
                                    ch.customerParticipants ?? ""
                                  );
                                  setEditingCh(false);
                                }}
                                disabled={savingCh}
                              >
                                破棄
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveCh}
                                disabled={savingCh}
                              >
                                {savingCh && (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                )}
                                保存
                              </Button>
                            </>
                          )}
                          {data.claudeSummary && !editingCh && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={handleReflect}
                              disabled={reflecting}
                            >
                              {reflecting ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3 mr-1" />
                              )}
                              Claude議事録を反映
                            </Button>
                          )}
                        </div>
                      </div>
                    </SectionCard>
                  ) : (
                    <EmptyState
                      icon={<History className="h-6 w-6 text-muted-foreground" />}
                      message="紐付く接触履歴が見つかりません。"
                    />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claude議事録生成 確認ダイアログ */}
      <AlertDialog
        open={confirmDialog?.kind === "claude-generate"}
        onOpenChange={(o) => !o && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Claude議事録を生成しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              Claude APIを利用して議事録を生成します。APIの利用料金が発生します。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmDialog(null);
                await doClaudeGenerate();
              }}
            >
              実行する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

function SectionCard({
  title,
  icon,
  rightAction,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
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

function InfoBar({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs bg-muted/30 border rounded px-3 py-2">
      {items.map((it, i) => (
        <div key={i}>
          <span className="text-muted-foreground">{it.label}:</span>{" "}
          <span className="font-mono">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
      {icon}
      <p className="text-sm">{message}</p>
    </div>
  );
}
