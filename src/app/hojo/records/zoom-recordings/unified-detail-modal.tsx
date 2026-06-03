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
import { DatePicker } from "@/components/ui/date-picker";
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
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import {
  getHojoZoomRecordingDetail,
  reflectHojoClaudeSummaryToMinutes,
  updateHojoClaudeSummary,
  updateHojoZoomRecordingState,
  getHojoContactHistoryForZoomRecording,
  updateHojoContactHistoryFromZoomModal,
  generateHojoZoomTaskCandidates,
  listHojoConsultingActivitiesForZoomTaskReflection,
  reflectHojoZoomTasksToConsultingActivity,
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

type TaskDraft = {
  taskType: "vendor" | "consulting_team";
  content: string;
  deadline: string;
  priority: string;
};

type ActivityOption = {
  id: number;
  label: string;
  activityDate: string;
  title: string | null;
  taskCounts: { vendor: number; consultingTeam: number };
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

const priorityOptions = ["高", "中", "低"];

function TaskDraftGroup({
  title,
  taskType,
  tasks,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  taskType: "vendor" | "consulting_team";
  tasks: TaskDraft[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<TaskDraft>) => void;
  onRemove: (index: number) => void;
}) {
  const filtered = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.taskType === taskType);

  return (
    <section className="rounded border bg-white p-4 space-y-4 min-h-[360px]">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            内容は確定前に編集できます。空欄のタスクは反映されません。
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3 w-3 mr-1" />
          追加
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          タスク候補がありません
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ task, index }) => (
            <div key={index} className="rounded border bg-muted/10 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">内容</Label>
                  <Textarea
                    value={task.content}
                    onChange={(e) => onUpdate(index, { content: e.target.value })}
                    rows={5}
                    className="min-h-[120px] text-sm leading-relaxed"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  onClick={() => onRemove(index)}
                  title="削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">期限</Label>
                  <DatePicker
                    value={task.deadline}
                    onChange={(deadline) => onUpdate(index, { deadline })}
                    placeholder="期限なし"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">優先度</Label>
                  <Select
                    value={task.priority || "none"}
                    onValueChange={(value) =>
                      onUpdate(index, { priority: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {priorityOptions.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
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
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [reflectingTasks, setReflectingTasks] = useState(false);
  const [taskModel, setTaskModel] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, c, activities] = await Promise.all([
        getHojoZoomRecordingDetail(recordingId),
        getHojoContactHistoryForZoomRecording(recordingId),
        listHojoConsultingActivitiesForZoomTaskReflection(recordingId),
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
      if (activities.ok) {
        setActivityOptions(activities.data);
        setSelectedActivityId((current) => {
          if (current && activities.data.some((activity) => String(activity.id) === current)) {
            return current;
          }
          return activities.data[0] ? String(activities.data[0].id) : "";
        });
      } else {
        setActivityOptions([]);
        setSelectedActivityId("");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setEditingClaude(false);
      setEditingCh(false);
      setTaskDrafts([]);
      setTaskModel(null);
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

  const handleGenerateTasks = async () => {
    if (!data?.transcriptText) {
      toast.error("文字起こしがまだ取得されていません");
      return;
    }
    setGeneratingTasks(true);
    try {
      const r = await generateHojoZoomTaskCandidates(recordingId);
      if (r.ok) {
        setTaskDrafts(
          r.data.tasks.map((task) => ({
            taskType: task.taskType,
            content: task.content,
            deadline: task.deadline,
            priority: task.priority,
          }))
        );
        setTaskModel(r.data.model);
        if (r.data.tasks.length > 0) {
          toast.success(`タスク候補を${r.data.tasks.length}件生成しました`);
        } else {
          toast.info("タスク候補は見つかりませんでした");
        }
      } else {
        toast.error(r.error);
      }
    } finally {
      setGeneratingTasks(false);
    }
  };

  const handleReflectTasks = async () => {
    if (!selectedActivityId) {
      toast.error("反映先のコンサル履歴を選択してください");
      return;
    }
    const tasks = taskDrafts.filter((task) => task.content.trim());
    if (tasks.length === 0) {
      toast.error("反映するタスクを入力してください");
      return;
    }
    setReflectingTasks(true);
    try {
      const r = await reflectHojoZoomTasksToConsultingActivity({
        recordingId,
        activityId: Number(selectedActivityId),
        tasks,
      });
      if (r.ok) {
        toast.success(`タスクを${r.data.createdCount}件反映しました`);
        setTaskDrafts([]);
        await load();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setReflectingTasks(false);
    }
  };

  const updateTaskDraft = (index: number, patch: Partial<TaskDraft>) => {
    setTaskDrafts((current) =>
      current.map((task, i) => (i === index ? { ...task, ...patch } : task))
    );
  };

  const addTaskDraft = (taskType: "vendor" | "consulting_team") => {
    setTaskDrafts((current) => [
      ...current,
      { taskType, content: "", deadline: "", priority: "" },
    ]);
  };

  const removeTaskDraft = (index: number) => {
    setTaskDrafts((current) => current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="cloudsign"
        className="w-[min(900px,calc(100vw-2rem))] overflow-hidden flex flex-col gap-0 p-0"
        style={{
          height: "60vh",
          maxHeight: "60vh",
        }}
      >
        <DialogHeader className="shrink-0 border-b p-4 pr-12 sm:p-5 sm:pr-12">
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base sm:text-lg">
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
          <div className="flex flex-1 items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            読み込み中...
          </div>
        )}

        {!loading && data && (
          <div className="min-h-0 flex flex-1 flex-col p-4 sm:p-6 space-y-4">
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

            <Tabs defaultValue="summary" className="min-h-0 flex flex-1 flex-col">
              <TabsList className="h-auto shrink-0 flex-wrap">
                <TabsTrigger value="summary">
                  <Brain className="h-3 w-3 mr-1" />
                  AI要約
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <ListChecks className="h-3 w-3 mr-1" />
                  タスク候補
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

              <TabsContent value="summary" className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-4">
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

              <TabsContent value="tasks" className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-5">
                {ch?.targetType !== "vendor" || !ch.vendorId ? (
                  <div className="rounded border bg-muted/20 p-4 text-sm text-muted-foreground">
                    ベンダー接触履歴に紐づくZoomのみ、コンサル履歴へタスクを反映できます。
                  </div>
                ) : (
                  <>
                    <div className="rounded border bg-muted/20 p-4 space-y-3">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">反映先コンサル履歴</Label>
                          <Select
                            value={selectedActivityId}
                            onValueChange={setSelectedActivityId}
                          >
                            <SelectTrigger className="h-10 bg-white">
                              <SelectValue placeholder="コンサル履歴を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {activityOptions.map((activity) => (
                                <SelectItem key={activity.id} value={String(activity.id)}>
                                  {activity.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {activityOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              このベンダーのコンサル履歴がまだありません。先にコンサル履歴を作成してください。
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <Button
                            size="default"
                            variant="outline"
                            onClick={handleGenerateTasks}
                            disabled={generatingTasks || !data.transcriptText}
                          >
                            {generatingTasks ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="h-3 w-3 mr-1" />
                            )}
                            候補を生成
                          </Button>
                          <Button
                            size="default"
                            onClick={handleReflectTasks}
                            disabled={
                              reflectingTasks ||
                              !selectedActivityId ||
                              taskDrafts.filter((task) => task.content.trim()).length === 0
                            }
                          >
                            {reflectingTasks ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            確定して反映
                          </Button>
                        </div>
                      </div>
                      {taskModel && (
                        <p className="text-[10px] text-muted-foreground">
                          生成モデル: {taskModel}
                        </p>
                      )}
                    </div>

                    {!data.transcriptText && (
                      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        文字起こしがまだ取得されていません。「未取得分を取得」で文字起こしを取得してから生成してください。
                      </div>
                    )}

                    <div className="grid gap-5 xl:grid-cols-2">
                      <TaskDraftGroup
                        title="先方タスク"
                        taskType="vendor"
                        tasks={taskDrafts}
                        onAdd={() => addTaskDraft("vendor")}
                        onUpdate={updateTaskDraft}
                        onRemove={removeTaskDraft}
                      />
                      <TaskDraftGroup
                        title="弊社タスク"
                        taskType="consulting_team"
                        tasks={taskDrafts}
                        onAdd={() => addTaskDraft("consulting_team")}
                        onUpdate={updateTaskDraft}
                        onRemove={removeTaskDraft}
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="video" className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
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

              <TabsContent value="transcript" className="min-h-0 flex-1 overflow-y-auto pr-1">
                {data.transcriptText ? (
                  <pre className="whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs">
                    {data.transcriptText}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    文字起こしがまだ取得されていません
                  </p>
                )}
              </TabsContent>

              <TabsContent value="chat" className="min-h-0 flex-1 overflow-y-auto pr-1">
                {data.chatLogText ? (
                  <pre className="whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs">
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
                <TabsContent value="contact" className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-3">
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
