"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  FileText,
  MessageCircle,
  Users,
  Video,
  Brain,
  Download,
  RefreshCw,
  Sparkles,
  Save,
  History,
  Pencil,
} from "lucide-react";
import {
  getHojoZoomRecordingDetail,
  reflectHojoClaudeSummaryToMinutes,
  updateHojoClaudeSummary,
  updateHojoZoomRecordingState,
  getHojoContactHistoryForZoomRecording,
  updateHojoContactHistoryFromZoomModal,
} from "@/app/hojo/contact-histories/zoom-actions";

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
  mp4SizeBytes: number | null;
  aiCompanionSummary: string | null;
  aiCompanionFetchedAt: string | null;
  summaryNextSteps: string | null;
  claudeSummary: string | null;
  claudeSummaryGeneratedAt: string | null;
  claudeSummaryModel: string | null;
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
  targetType: string;
  vendorId: number | null;
  vendorName: string | null;
};

type Participant = {
  name?: string;
  user_email?: string;
  join_time?: string;
  leave_time?: string;
};

function formatJst(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(d);
}

function formatBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export function UnifiedDetailModal({
  open,
  onOpenChange,
  recordingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: number;
}) {
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(null);
  const [ch, setCh] = useState<ContactHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [regenClaude, setRegenClaude] = useState(false);
  const [savingClaude, setSavingClaude] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [savingState, setSavingState] = useState(false);
  const [savingCh, setSavingCh] = useState(false);
  const [editingClaude, setEditingClaude] = useState(false);
  const [editingCh, setEditingCh] = useState(false);
  const [claudeDraft, setClaudeDraft] = useState("");
  const [chMinutes, setChMinutes] = useState("");
  const [chNote, setChNote] = useState("");
  const [chCustomerParticipants, setChCustomerParticipants] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        getHojoZoomRecordingDetail(recordingId),
        getHojoContactHistoryForZoomRecording(recordingId),
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
      setEditingClaude(false);
      setEditingCh(false);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordingId]);

  const participants: Participant[] = (() => {
    if (!data?.participantsJson) return [];
    try {
      const parsed = JSON.parse(data.participantsJson);
      return Array.isArray(parsed) ? (parsed as Participant[]) : [];
    } catch {
      return [];
    }
  })();

  const handleFetchAll = async () => {
    setFetching(true);
    try {
      const res = await fetch(
        `/api/hojo/zoom-recordings/${recordingId}/fetch-all`,
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

  const handleClaudeGenerate = async () => {
    if (!data?.transcriptText) {
      toast.error("文字起こしがまだ取得されていません");
      return;
    }
    setRegenClaude(true);
    try {
      const res = await fetch(
        `/api/hojo/zoom-recordings/${recordingId}/regenerate-summary`,
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
      const r = await updateHojoClaudeSummary(recordingId, claudeDraft);
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
      const r = await reflectHojoClaudeSummaryToMinutes(recordingId, false);
      if (r.ok) {
        if (r.data.alreadyAppended && !r.data.appended) {
          const confirmed = window.confirm("既に反映済みです。上書きしますか？");
          if (!confirmed) return;
          const r2 = await reflectHojoClaudeSummaryToMinutes(recordingId, true);
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

  const handleStateChange = async (newState: "予定" | "完了" | "失敗") => {
    if (!data) return;
    if (data.state === newState) return;
    setSavingState(true);
    try {
      const r = await updateHojoZoomRecordingState(recordingId, newState);
      if (r.ok) {
        toast.success(`状態を「${newState}」に変更しました`);
        await load();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSavingState(false);
    }
  };

  const handleSaveCh = async () => {
    setSavingCh(true);
    try {
      const r = await updateHojoContactHistoryFromZoomModal(recordingId, {
        meetingMinutes: chMinutes || null,
        note: chNote || null,
        customerParticipants: chCustomerParticipants || null,
      });
      if (r.ok) {
        toast.success("接触履歴を更新しました");
        setEditingCh(false);
        await load();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSavingCh(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Video className="h-5 w-5" />
            Zoom商談録画 詳細
            {data && (
              <>
                <Badge variant="outline">Meeting ID: {data.zoomMeetingId}</Badge>
                {data.label && <Badge variant="secondary">{data.label}</Badge>}
                {data.hostStaffName && (
                  <span className="text-xs text-muted-foreground">
                    ホスト: {data.hostStaffName}
                  </span>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            読み込み中...
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {/* 操作バー */}
            <div className="flex flex-wrap gap-2 items-center rounded-lg border bg-muted/20 p-2">
              <Label className="text-xs">状態:</Label>
              <Select
                value={data.state}
                onValueChange={(v) => handleStateChange(v as "予定" | "完了" | "失敗")}
                disabled={savingState}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="予定">予定</SelectItem>
                  <SelectItem value="完了">完了</SelectItem>
                  <SelectItem value="失敗">失敗</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                onClick={handleFetchAll}
                disabled={fetching}
                className="h-8"
              >
                {fetching ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                未取得分を取得
              </Button>

              {data.recordingStartAt && (
                <span className="text-xs text-muted-foreground ml-auto">
                  録画: {formatJst(data.recordingStartAt)} 〜 {formatJst(data.recordingEndAt)}
                </span>
              )}
            </div>

            {data.downloadError && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <div className="font-semibold mb-1">ダウンロードエラー</div>
                <div className="break-all">{data.downloadError}</div>
              </div>
            )}

            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">
                  <Brain className="h-3 w-3 mr-1" />
                  AI要約
                </TabsTrigger>
                <TabsTrigger value="video">
                  <Video className="h-3 w-3 mr-1" />
                  動画
                </TabsTrigger>
                <TabsTrigger value="transcript">
                  <FileText className="h-3 w-3 mr-1" />
                  文字起こし
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageCircle className="h-3 w-3 mr-1" />
                  チャット
                </TabsTrigger>
                <TabsTrigger value="participants">
                  <Users className="h-3 w-3 mr-1" />
                  参加者 ({participants.length})
                </TabsTrigger>
                {ch && (
                  <TabsTrigger value="contact">
                    <History className="h-3 w-3 mr-1" />
                    接触履歴
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <section>
                  <h3 className="text-sm font-semibold mb-2">
                    Zoom AI Companion 要約
                  </h3>
                  {data.aiCompanionSummary ? (
                    <pre className="whitespace-pre-wrap rounded bg-muted/30 p-3 text-sm">
                      {data.aiCompanionSummary}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      まだ要約が生成されていません
                    </p>
                  )}
                  {data.summaryNextSteps && (
                    <>
                      <h4 className="text-xs font-semibold mt-3 mb-1">
                        ネクストステップ
                      </h4>
                      <pre className="whitespace-pre-wrap rounded bg-muted/30 p-3 text-sm">
                        {data.summaryNextSteps}
                      </pre>
                    </>
                  )}
                </section>

                <section>
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">Claude生成議事録</h3>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClaudeGenerate}
                        disabled={regenClaude || !data.transcriptText}
                      >
                        {regenClaude ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        {data.claudeSummary ? "再生成" : "生成"}
                      </Button>
                      {data.claudeSummary && !editingClaude && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingClaude(true)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          編集
                        </Button>
                      )}
                      {data.claudeSummary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleReflect}
                          disabled={reflecting}
                        >
                          {reflecting && (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          )}
                          議事録に反映
                        </Button>
                      )}
                    </div>
                  </div>
                  {data.claudeSummaryGeneratedAt && (
                    <p className="text-[10px] text-muted-foreground mb-1">
                      生成日時: {formatJst(data.claudeSummaryGeneratedAt)}
                      {data.claudeSummaryModel && ` / モデル: ${data.claudeSummaryModel}`}
                    </p>
                  )}
                  {editingClaude ? (
                    <div className="space-y-2">
                      <Textarea
                        value={claudeDraft}
                        onChange={(e) => setClaudeDraft(e.target.value)}
                        rows={12}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveClaude}
                          disabled={savingClaude}
                        >
                          {savingClaude ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingClaude(false);
                            setClaudeDraft(data.claudeSummary ?? "");
                          }}
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : data.claudeSummary ? (
                    <pre className="whitespace-pre-wrap rounded bg-muted/30 p-3 text-sm">
                      {data.claudeSummary}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Claude生成議事録はまだ生成されていません
                    </p>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="video" className="space-y-2">
                {data.mp4Path ? (
                  <div className="space-y-2">
                    <video
                      src={`/${data.mp4Path}`}
                      controls
                      className="w-full rounded border"
                    />
                    <div className="flex items-center gap-2 text-xs">
                      <a
                        href={`/${data.mp4Path}`}
                        download
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        ダウンロード
                      </a>
                      {data.mp4SizeBytes && (
                        <span className="text-muted-foreground">
                          サイズ: {formatBytes(data.mp4SizeBytes)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    動画ファイルがまだ取得されていません
                  </p>
                )}
              </TabsContent>

              <TabsContent value="transcript">
                {data.transcriptText ? (
                  <pre className="whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs max-h-[50vh] overflow-y-auto">
                    {data.transcriptText}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    文字起こしがまだ取得されていません
                  </p>
                )}
              </TabsContent>

              <TabsContent value="chat">
                {data.chatLogText ? (
                  <pre className="whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs max-h-[50vh] overflow-y-auto">
                    {data.chatLogText}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    チャットログがまだ取得されていません
                  </p>
                )}
              </TabsContent>

              <TabsContent value="participants">
                {participants.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    参加者情報がまだ取得されていません
                  </p>
                ) : (
                  <div className="space-y-1">
                    {participants.map((p, i) => (
                      <div
                        key={i}
                        className="rounded border p-2 text-xs flex justify-between"
                      >
                        <span>
                          <span className="font-medium">{p.name ?? "(名前なし)"}</span>
                          {p.user_email && (
                            <span className="text-muted-foreground ml-2">
                              {p.user_email}
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {p.join_time ? formatJst(p.join_time) : ""}
                          {p.leave_time ? ` 〜 ${formatJst(p.leave_time)}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {ch && (
                <TabsContent value="contact" className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">接触日時</div>
                      <div>{formatJst(ch.contactDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">相手種別</div>
                      <div>
                        {ch.targetType === "vendor"
                          ? "ベンダー"
                          : ch.targetType === "bbs"
                            ? "BBS"
                            : ch.targetType === "lender"
                              ? "貸金業社"
                              : "その他"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">担当スタッフ</div>
                      <div>{ch.staffName ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">接触方法</div>
                      <div>{ch.contactMethodName ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">接触種別</div>
                      <div>{ch.contactCategoryName ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">相手先</div>
                      <div>{ch.vendorName ?? "-"}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      議事録・メモ（簡易編集）
                    </Label>
                    {!editingCh ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCh(true)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        編集
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={handleSaveCh} disabled={savingCh}>
                          {savingCh ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCh(false);
                            setChMinutes(ch.meetingMinutes ?? "");
                            setChNote(ch.note ?? "");
                            setChCustomerParticipants(ch.customerParticipants ?? "");
                          }}
                        >
                          キャンセル
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">先方参加者</Label>
                      {editingCh ? (
                        <Input
                          value={chCustomerParticipants}
                          onChange={(e) => setChCustomerParticipants(e.target.value)}
                        />
                      ) : (
                        <div className="text-sm rounded bg-muted/30 p-2">
                          {ch.customerParticipants || "-"}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">議事録</Label>
                      {editingCh ? (
                        <Textarea
                          value={chMinutes}
                          onChange={(e) => setChMinutes(e.target.value)}
                          rows={10}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-sm">
                          {ch.meetingMinutes || "-"}
                        </pre>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">メモ</Label>
                      {editingCh ? (
                        <Textarea
                          value={chNote}
                          onChange={(e) => setChNote(e.target.value)}
                          rows={4}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-sm">
                          {ch.note || "-"}
                        </pre>
                      )}
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
