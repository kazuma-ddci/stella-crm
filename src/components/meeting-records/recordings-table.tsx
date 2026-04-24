"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Brain,
  Video,
  FileText,
  MessageCircle,
  Users,
  Download,
  Loader2,
} from "lucide-react";
import type { MeetingRecordRow } from "@/lib/contact-history-v2/meeting-records/loaders";

type Props = {
  projectCode: "stp" | "slp" | "hojo";
  rows: MeetingRecordRow[];
};

function formatJst(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function MeetingIdText({ id }: { id: string | null }) {
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

function StatusCell({
  exists,
  Icon,
  label,
}: {
  exists: boolean;
  Icon: typeof Video;
  label: string;
}) {
  const cls = exists
    ? "border-indigo-300 text-indigo-800 bg-indigo-50/50"
    : "border-gray-200 text-muted-foreground opacity-60";
  const markCls = exists ? "text-indigo-600" : "text-muted-foreground";
  const mark = exists ? "✓" : "○";
  const title = exists ? `${label}: 取得済み` : `${label}: 未取得`;
  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] bg-white ${cls} w-[88px] justify-between shrink-0`}
    >
      <span className="inline-flex items-center gap-1 truncate">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className={`font-bold shrink-0 ${markCls}`}>{mark}</span>
    </div>
  );
}

export function MeetingRecordsTable({ projectCode, rows }: Props) {
  const router = useRouter();
  const [fetchingId, setFetchingId] = useState<number | null>(null);

  async function handleFetchAll(recordId: number) {
    setFetchingId(recordId);
    try {
      const res = await fetch(
        `/api/contact-history-v2/meeting-records/${recordId}/fetch-all`,
        { method: "POST" },
      );
      if (res.ok) router.refresh();
    } finally {
      setFetchingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        会議録画・議事録のデータはまだありません
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 whitespace-nowrap">日時</th>
            <th className="text-left p-3 whitespace-nowrap">プロバイダ</th>
            <th className="text-left p-3 min-w-[16em]">相手先</th>
            <th className="text-left p-3 whitespace-nowrap">担当</th>
            <th className="text-left p-3 whitespace-nowrap">Meeting ID</th>
            <th className="text-left p-3 whitespace-nowrap">状態</th>
            <th className="text-left p-3">取得状況</th>
            <th className="text-left p-3 whitespace-nowrap"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.recordId} className="border-t hover:bg-muted/30">
              <td className="p-3 whitespace-nowrap">
                {formatJst(r.scheduledStartAt)}
              </td>
              <td className="p-3 whitespace-nowrap">
                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {r.providerLabel}
                </span>
              </td>
              <td className="p-3">
                <Link
                  href={`/${projectCode}/records/meeting-records/${r.recordId}`}
                  className="text-blue-600 hover:underline"
                >
                  {r.primaryCustomerLabel}
                </Link>
                {r.title && (
                  <div className="text-xs text-muted-foreground truncate max-w-[24em]">
                    {r.title}
                  </div>
                )}
              </td>
              <td className="p-3 whitespace-nowrap">{r.hostStaffName ?? "—"}</td>
              <td className="p-3 whitespace-nowrap font-mono text-xs">
                <MeetingIdText id={r.externalMeetingId} />
              </td>
              <td className="p-3 whitespace-nowrap">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                    r.state === "完了"
                      ? "bg-green-100 text-green-800"
                      : r.state === "予定"
                        ? "bg-blue-100 text-blue-800"
                        : r.state === "取得中"
                          ? "bg-amber-100 text-amber-800"
                          : r.state === "失敗"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {r.state}
                </span>
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  <StatusCell exists={r.hasAiSummary} Icon={Brain} label="AI要約" />
                  <StatusCell exists={r.hasRecording} Icon={Video} label="動画" />
                  <StatusCell
                    exists={r.hasTranscript}
                    Icon={FileText}
                    label="文字起こし"
                  />
                  <StatusCell exists={r.hasChat} Icon={MessageCircle} label="チャット" />
                  <StatusCell exists={r.hasAttendance} Icon={Users} label="参加者" />
                </div>
              </td>
              <td className="p-3 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/${projectCode}/records/meeting-records/${r.recordId}`}
                    className="inline-flex items-center px-2 py-0.5 rounded border text-xs hover:bg-muted"
                  >
                    詳細
                  </Link>
                  {r.provider === "zoom" && (
                    <button
                      type="button"
                      disabled={fetchingId === r.recordId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 text-xs disabled:opacity-60"
                      onClick={() => handleFetchAll(r.recordId)}
                    >
                      {fetchingId === r.recordId ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          取得中
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          取得
                        </>
                      )}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
