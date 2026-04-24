"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  Video,
  FileText,
  MessageCircle,
  Users,
  History,
  Download as DownloadIcon,
  RefreshCw,
  Copy,
  Loader2,
  AlertCircle,
  Save,
  ClipboardCheck,
  Edit3,
} from "lucide-react";
import type { MeetingRecordDetail } from "@/lib/contact-history-v2/meeting-records/loaders";

type TabId =
  | "summary"
  | "recording"
  | "transcript"
  | "chat"
  | "participants"
  | "contact";

type AttendanceItem = {
  name?: string;
  user_name?: string;
  user_email?: string;
  email?: string;
  join_time?: string;
  leave_time?: string;
  duration?: number;
};

function formatJst(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatBytes(raw: string | null): string {
  if (!raw) return "—";
  const n = Number(raw);
  if (isNaN(n)) return "—";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function parseAttendance(raw: unknown): AttendanceItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as AttendanceItem[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function MeetingRecordDetailTabs({
  detail,
}: {
  detail: MeetingRecordDetail;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [fetching, setFetching] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [stateBusy, setStateBusy] = useState(false);

  async function updateState(newState: "予定" | "完了" | "失敗") {
    if (stateBusy || newState === detail.state) return;
    setStateBusy(true);
    try {
      const res = await fetch(
        `/api/contact-history-v2/meeting-records/${detail.recordId}/state`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: newState }),
        },
      );
      if (res.ok) router.refresh();
    } finally {
      setStateBusy(false);
    }
  }

  const canFetch = detail.provider === "zoom" && !!detail.host;
  const canRegenerate =
    detail.provider === "zoom" &&
    !!detail.record.transcriptText &&
    detail.record.transcriptText.trim().length > 0;

  async function runFetchAll() {
    setFetching(true);
    try {
      const res = await fetch(
        `/api/contact-history-v2/meeting-records/${detail.recordId}/fetch-all`,
        { method: "POST" },
      );
      if (res.ok) router.refresh();
    } finally {
      setFetching(false);
    }
  }

  async function runRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/contact-history-v2/meeting-records/${detail.recordId}/regenerate-summary`,
        { method: "POST" },
      );
      if (res.ok) router.refresh();
    } finally {
      setRegenerating(false);
    }
  }

  const tabs: { id: TabId; label: string; Icon: typeof Brain }[] = [
    { id: "summary", label: "要約", Icon: Brain },
    { id: "recording", label: "レコーディング", Icon: Video },
    { id: "transcript", label: "文字起こし", Icon: FileText },
    { id: "chat", label: "チャット", Icon: MessageCircle },
    { id: "participants", label: "参加者", Icon: Users },
    { id: "contact", label: "接触履歴", Icon: History },
  ];

  const attendance = parseAttendance(detail.record.attendanceJson);

  return (
    <div className="space-y-4">
      {/* ヘッダー (会議基本情報 + アクション) */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs">
                {detail.providerLabel}
              </span>
              {detail.state === "取得中" ? (
                <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-xs">
                  取得中
                </span>
              ) : (
                <label className="inline-flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">状況:</span>
                  <select
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                      detail.state === "完了"
                        ? "bg-green-50 border-green-300 text-green-800"
                        : detail.state === "予定"
                          ? "bg-blue-50 border-blue-300 text-blue-800"
                          : detail.state === "失敗"
                            ? "bg-red-50 border-red-300 text-red-800"
                            : "bg-gray-50 border-gray-300 text-gray-800"
                    }`}
                    disabled={stateBusy}
                    value={detail.state}
                    onChange={(e) =>
                      updateState(e.target.value as "予定" | "完了" | "失敗")
                    }
                  >
                    <option value="予定">予定</option>
                    <option value="完了">完了</option>
                    <option value="失敗">失敗</option>
                  </select>
                </label>
              )}
              {detail.externalMeetingId && (
                <span className="font-mono text-xs text-muted-foreground">
                  ID: {detail.externalMeetingId}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold">
              {detail.contactHistory.title ??
                `${detail.contactHistory.customerParticipants[0]?.companyName ?? "—"} 接触`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatJst(detail.contactHistory.scheduledStartAt)}
              {detail.host && <> / ホスト: {detail.host.name}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canFetch && (
              <button
                type="button"
                onClick={runFetchAll}
                disabled={fetching}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-60 text-sm"
              >
                {fetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 取得中
                  </>
                ) : (
                  <>
                    <DownloadIcon className="h-4 w-4" /> まとめて取得
                  </>
                )}
              </button>
            )}
            {canRegenerate && (
              <button
                type="button"
                onClick={runRegenerate}
                disabled={regenerating}
                className="inline-flex items-center gap-1 px-3 py-1 rounded border hover:bg-muted disabled:opacity-60 text-sm"
              >
                {regenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 再生成中
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" /> Claude再要約
                  </>
                )}
              </button>
            )}
            <Link
              href={`/${detail.projectCode}/records/contact-histories-v2/${detail.contactHistoryId}`}
              className="inline-flex items-center gap-1 px-3 py-1 rounded border hover:bg-muted text-sm"
            >
              接触履歴を開く
            </Link>
          </div>
        </div>

        {detail.apiError && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>API エラー:</strong> {detail.apiError}
            </div>
          </div>
        )}
      </div>

      {/* タブ */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-1 px-3 py-2 text-sm border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* タブ内容 */}
      <div className="rounded-lg border bg-white p-4">
        {activeTab === "summary" && <SummaryTab detail={detail} />}
        {activeTab === "recording" && <RecordingTab detail={detail} />}
        {activeTab === "transcript" && <TranscriptTab detail={detail} />}
        {activeTab === "chat" && <ChatTab detail={detail} />}
        {activeTab === "participants" && (
          <ParticipantsTab attendance={attendance} />
        )}
        {activeTab === "contact" && <ContactTab detail={detail} />}
      </div>
    </div>
  );
}

function SummaryTab({ detail }: { detail: MeetingRecordDetail }) {
  const router = useRouter();
  const current =
    detail.summaries.find((s) => s.isCurrent) ??
    detail.summaries[detail.summaries.length - 1];

  const currentText = current?.summaryText ?? detail.record.aiSummary ?? "";
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentText);
  const [saving, setSaving] = useState(false);
  const [reflecting, setReflecting] = useState(false);

  if (!current && !detail.record.aiSummary) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        要約はまだ生成されていません
      </p>
    );
  }

  async function saveSummary() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/contact-history-v2/meeting-records/${detail.recordId}/summary`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summaryText: draft }),
        },
      );
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function reflectToMinutes(mode: "append" | "replace") {
    setReflecting(true);
    try {
      const res = await fetch(
        `/api/contact-history-v2/meeting-records/${detail.recordId}/reflect-minutes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );
      if (res.ok) router.refresh();
    } finally {
      setReflecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              現行版:{" "}
              <strong>
                {current
                  ? sourceLabel(current.source)
                  : sourceLabel(detail.record.aiSummarySource)}
              </strong>
            </span>
            {current?.generatedAt && (
              <span>{formatJst(current.generatedAt)}</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <CopyButton text={currentText} />
            {!isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(currentText);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted text-xs"
              >
                <Edit3 className="h-3 w-3" />
                編集
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveSummary}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-xs disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted text-xs"
                >
                  キャンセル
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => reflectToMinutes("append")}
              disabled={reflecting || !currentText}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-600 text-white hover:bg-teal-700 text-xs disabled:opacity-60"
              title="接触履歴の議事録欄に追記します"
            >
              {reflecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ClipboardCheck className="h-3 w-3" />
              )}
              議事録に反映
            </button>
          </div>
        </div>
        {isEditing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded border p-3 text-sm min-h-[40vh] font-sans"
          />
        ) : (
          <div className="rounded border bg-gray-50 p-3 whitespace-pre-wrap text-sm max-h-[50vh] overflow-y-auto">
            {currentText || "—"}
          </div>
        )}
      </div>

      {detail.summaries.length > 1 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">バージョン履歴</p>
          <div className="space-y-2">
            {detail.summaries
              .slice()
              .sort((a, b) => b.version - a.version)
              .map((s) => (
                <details
                  key={s.id}
                  className="rounded border bg-white"
                  open={s.isCurrent}
                >
                  <summary className="cursor-pointer px-3 py-2 text-sm flex items-center gap-2">
                    <span className="font-mono">v{s.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {sourceLabel(s.source)}
                      {s.model && ` (${s.model})`}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatJst(s.generatedAt)}
                    </span>
                    {s.isCurrent && (
                      <span className="inline-flex items-center rounded bg-green-100 text-green-800 px-1.5 py-0.5 text-[10px]">
                        現行
                      </span>
                    )}
                  </summary>
                  <div className="px-3 py-2 border-t text-sm whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                    {s.summaryText}
                  </div>
                </details>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordingTab({ detail }: { detail: MeetingRecordDetail }) {
  if (!detail.record.recordingPath) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        動画ファイルはありません
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <video
        controls
        className="w-full max-h-[60vh] rounded bg-black"
        src={detail.record.recordingPath}
      >
        お使いのブラウザは動画再生に対応していません
      </video>
      <div className="flex flex-wrap gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">サイズ:</span>{" "}
          {formatBytes(detail.record.recordingSizeBytes)}
        </div>
        <div>
          <span className="text-muted-foreground">開始:</span>{" "}
          {formatJst(detail.record.recordingStartAt)}
        </div>
        <div>
          <span className="text-muted-foreground">終了:</span>{" "}
          {formatJst(detail.record.recordingEndAt)}
        </div>
        <a
          href={detail.record.recordingPath}
          download
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted"
        >
          <DownloadIcon className="h-4 w-4" />
          ダウンロード
        </a>
      </div>
    </div>
  );
}

function TranscriptTab({ detail }: { detail: MeetingRecordDetail }) {
  if (!detail.record.transcriptText) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        文字起こしはありません
      </p>
    );
  }
  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={detail.record.transcriptText} />
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm max-h-[60vh] overflow-y-auto rounded border bg-gray-50 p-3">
        {detail.record.transcriptText}
      </pre>
    </div>
  );
}

function ChatTab({ detail }: { detail: MeetingRecordDetail }) {
  if (!detail.record.chatLogText) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        チャットログはありません
      </p>
    );
  }
  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={detail.record.chatLogText} />
      </div>
      <pre className="whitespace-pre-wrap font-sans text-sm max-h-[60vh] overflow-y-auto rounded border bg-gray-50 p-3">
        {detail.record.chatLogText}
      </pre>
    </div>
  );
}

function ParticipantsTab({ attendance }: { attendance: AttendanceItem[] }) {
  if (attendance.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        参加者情報はありません
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/30">
        <tr>
          <th className="text-left p-2">名前</th>
          <th className="text-left p-2">メール</th>
          <th className="text-left p-2">入室</th>
          <th className="text-left p-2">退室</th>
          <th className="text-left p-2">参加時間(分)</th>
        </tr>
      </thead>
      <tbody>
        {attendance.map((a, i) => (
          <tr key={i} className="border-t">
            <td className="p-2">{a.name ?? a.user_name ?? "—"}</td>
            <td className="p-2">{a.email ?? a.user_email ?? "—"}</td>
            <td className="p-2">
              {a.join_time ? new Date(a.join_time).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—"}
            </td>
            <td className="p-2">
              {a.leave_time ? new Date(a.leave_time).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—"}
            </td>
            <td className="p-2">
              {a.duration != null ? Math.round(a.duration / 60) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContactTab({ detail }: { detail: MeetingRecordDetail }) {
  const ch = detail.contactHistory;
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-[10em_1fr] gap-x-3 gap-y-2">
        <dt className="text-muted-foreground">接触日時</dt>
        <dd>{formatJst(ch.scheduledStartAt)}</dd>
        <dt className="text-muted-foreground">ステータス</dt>
        <dd>{ch.status}</dd>
        <dt className="text-muted-foreground">接触方法</dt>
        <dd>{ch.contactMethod ?? "—"}</dd>
        <dt className="text-muted-foreground">接触種別</dt>
        <dd>{ch.contactCategory ?? "—"}</dd>
        <dt className="text-muted-foreground">先方</dt>
        <dd>
          {ch.customerParticipants.map((cp) => (
            <div key={cp.id}>
              <strong>{cp.companyName ?? "—"}</strong>
              {cp.attendees.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({cp.attendees.map((a) => a.name).join(", ")})
                </span>
              )}
            </div>
          ))}
        </dd>
        <dt className="text-muted-foreground">スタッフ</dt>
        <dd>
          {ch.staffParticipants
            .map((sp) => `${sp.staffName}${sp.isHost ? " (ホスト)" : ""}`)
            .join(", ") || "—"}
        </dd>
      </dl>

      <div>
        <h3 className="font-semibold mb-1">議事録</h3>
        <div className="rounded border bg-gray-50 p-3 whitespace-pre-wrap">
          {ch.meetingMinutes ?? "—"}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-1">備考</h3>
        <div className="rounded border bg-gray-50 p-3 whitespace-pre-wrap">
          {ch.note ?? "—"}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // noop
        }
      }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted text-xs"
    >
      <Copy className="h-3 w-3" />
      {copied ? "コピー済み" : "コピー"}
    </button>
  );
}

function sourceLabel(source: string | null): string {
  switch (source) {
    case "zoom_ai_companion":
      return "Zoom AI Companion";
    case "claude":
      return "Claude";
    case "gemini":
      return "Gemini";
    case "manual":
      return "手動入力";
    default:
      return source ?? "—";
  }
}
