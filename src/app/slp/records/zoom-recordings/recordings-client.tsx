"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Video,
  FileText,
  MessageCircle,
  Users,
  ListChecks,
  CheckCircle2,
  Download,
  Loader2,
} from "lucide-react";
import { UnifiedDetailModal } from "./unified-detail-modal";

export type RecordingRow = {
  id: number;
  category: "briefing" | "consultation";
  companyName: string | null;
  contactDate: string | null;
  hostName: string | null;
  zoomMeetingId: string | null;
  state: string | null;
  // 試行状態（猶予期間6時間超過で自動的にtrue扱い）
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
  // 表示上「すべて試行済み」(実試行 or 猶予期間でのみなし)
  allFetched: boolean;
  // 実際にAPI試行済みか（猶予期間考慮なし、ボタン非表示判定用）
  actuallyAllFetched: boolean;
  // 猶予期間(6時間)を超えているか
  pastGracePeriod: boolean;
  // コンパニオン情報（モーダル側へ渡す用）
  downloadStatus: string;
  companyRecordId: number | null;
  prolineUid: string | null;
};

/**
 * Zoom Meeting ID をハイフン区切り表記にしつつ、iOS Safariの
 * 電話番号自動検出を避けるために各グループを別spanでレンダリング。
 * 単純な文字列連結より堅牢で、安全。
 */
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

/**
 * 取得状況を固定6スロットで表示するためのアイコン。
 * 位置をレコード毎に揃えることでページ全体のごちゃつきを無くす。
 */
function StatusCell({
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
  let markCls: string;
  let mark: string;
  let title: string;
  if (exists) {
    containerCls = "border-indigo-300 text-indigo-800 bg-indigo-50/50";
    markCls = "text-indigo-600";
    mark = "✓";
    title = `${label}: 取得済み`;
  } else if (attempted) {
    containerCls = "border-gray-200 text-muted-foreground opacity-60";
    markCls = "text-muted-foreground";
    mark = "―";
    title = `${label}: 該当なし（Zoom側に存在しない・確定）`;
  } else {
    containerCls = "border-amber-300 border-dashed text-amber-800";
    markCls = "text-amber-600";
    mark = "○";
    title = `${label}: 未取得`;
  }
  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] bg-white ${containerCls} w-[88px] justify-between shrink-0`}
    >
      <span className="inline-flex items-center gap-1 truncate">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className={`font-bold shrink-0 ${markCls}`}>{mark}</span>
    </div>
  );
}

export function RecordingsClient({ rows }: { rows: RecordingRow[] }) {
  const router = useRouter();
  const [localRows, setLocalRows] = useState<RecordingRow[]>(rows);
  const [openRecord, setOpenRecord] = useState<RecordingRow | null>(null);
  const [bulkBusy, setBulkBusy] = useState<number | null>(null);

  // サーバーから新しいrowsが来たら同期
  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 whitespace-nowrap">日時</th>
              <th className="text-left p-3 whitespace-nowrap">種別</th>
              <th className="text-left p-3 min-w-[16em]">事業者名</th>
              <th className="text-left p-3 whitespace-nowrap pr-8">担当</th>
              <th className="text-left p-3 whitespace-nowrap">Meeting ID</th>
              <th className="text-left p-3 whitespace-nowrap">商談状況</th>
              <th className="text-left p-3">取得状況</th>
            </tr>
          </thead>
          <tbody>
            {localRows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-muted-foreground"
                >
                  録画データはまだありません
                </td>
              </tr>
            )}
            {localRows.map((r) => (
              <tr
                key={r.id}
                className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setOpenRecord(r)}
              >
                <td className="p-3 whitespace-nowrap">
                  {r.contactDate ?? "—"}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {r.category === "briefing" ? "概要案内" : "導入希望商談"}
                </td>
                <td className="p-3">{r.companyName ?? "—"}</td>
                <td className="p-3 whitespace-nowrap pr-8">{r.hostName ?? "—"}</td>
                <td className="p-3 whitespace-nowrap font-mono text-xs">
                  <MeetingIdText id={r.zoomMeetingId} />
                </td>
                <td className="p-3 whitespace-nowrap">
                  {r.state ? (
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                        r.state === "完了"
                          ? "bg-green-100 text-green-800"
                          : r.state === "予定"
                            ? "bg-blue-100 text-blue-800"
                            : r.state === "失敗"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {r.state}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3">
                  {/* 6スロットを常に固定位置でレンダリング */}
                  <div className="flex flex-wrap gap-1.5">
                    <StatusCell
                      attempted={r.aiSummaryAttempted}
                      exists={r.hasAiSummary}
                      Icon={Brain}
                      label="AI要約"
                    />
                    <StatusCell
                      attempted={r.recordingAttempted}
                      exists={r.hasMp4}
                      Icon={Video}
                      label="動画"
                    />
                    <StatusCell
                      attempted={r.recordingAttempted}
                      exists={r.hasTranscript}
                      Icon={FileText}
                      label="文字起こし"
                    />
                    <StatusCell
                      attempted={r.chatAttempted}
                      exists={r.hasChat}
                      Icon={MessageCircle}
                      label="チャット"
                    />
                    <StatusCell
                      attempted={r.participantsAttempted}
                      exists={r.hasParticipants}
                      Icon={Users}
                      label="参加者"
                    />
                    <StatusCell
                      attempted={r.aiSummaryAttempted}
                      exists={r.hasNextSteps}
                      Icon={ListChecks}
                      label="アクション"
                    />
                  </div>
                  <div className="mt-2 text-xs flex items-center gap-2 flex-wrap">
                    {/*
                      取得ボタンは常に表示する（ユーザー要件）。
                      - 全取得済み → グレー disabled風、ラベル「再取得」
                      - 6時間超過 未取得あり → グレー、ラベル「未取得分を取得」
                      - 6時間以内 未取得あり → amber（目立つ）、ラベル「未取得分を取得」
                      どのパターンでもクリックは可能で、fetchAllForRecording が走る。
                    */}
                    <button
                      type="button"
                      className={
                        r.actuallyAllFetched
                          ? "inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-white text-gray-500 hover:bg-gray-50 font-medium disabled:opacity-60"
                          : r.pastGracePeriod
                            ? "inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium disabled:opacity-60"
                            : "inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 font-medium disabled:opacity-60"
                      }
                      disabled={bulkBusy === r.id}
                      title={
                        r.actuallyAllFetched
                          ? "全て取得済みですが、もう一度取りに行く場合はこのボタン"
                          : r.pastGracePeriod
                            ? "会議終了から6時間超過しているため、Zoom側の処理は完了済みの可能性が高いです。念のため再取得する場合はこのボタン"
                            : "未取得の情報を取得"
                      }
                      onClick={async (e) => {
                        e.stopPropagation();
                        setBulkBusy(r.id);
                        try {
                          const res = await fetch(
                            `/api/slp/zoom-recordings/${r.id}/fetch-all`,
                            { method: "POST" }
                          );
                          const data = await res.json();
                          if (data.ok) {
                            router.refresh();
                          }
                        } finally {
                          setBulkBusy(null);
                        }
                      }}
                    >
                      {bulkBusy === r.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          取得中...
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3" />
                          {r.actuallyAllFetched ? "再取得" : "未取得分を取得"}
                        </>
                      )}
                    </button>
                    {r.actuallyAllFetched ? (
                      <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        取得できる情報はすべて取得しました
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        クリックで詳細
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openRecord && (
        <UnifiedDetailModal
          open={!!openRecord}
          onOpenChange={(o) => !o && setOpenRecord(null)}
          recordingId={openRecord.id}
          hasRetryable={!openRecord.actuallyAllFetched}
          companyName={openRecord.companyName}
        />
      )}
    </div>
  );
}
