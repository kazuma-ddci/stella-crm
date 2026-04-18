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
  // 試行状態
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
  // コンパニオン情報（モーダル側へ渡す用）
  downloadStatus: string;
  companyRecordId: number | null;
  prolineUid: string | null;
};

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
    containerCls = "border-green-300 text-green-800";
    markCls = "text-green-600";
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
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] bg-white ${containerCls} w-[110px] justify-between`}
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
              <th className="text-left p-3 whitespace-nowrap">担当</th>
              <th className="text-left p-3">取得状況</th>
            </tr>
          </thead>
          <tbody>
            {localRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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
                <td className="p-3 whitespace-nowrap">{r.hostName ?? "—"}</td>
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
                    {r.allFetched ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        取得できる情報はすべて取得しました
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 font-medium disabled:opacity-60"
                          disabled={bulkBusy === r.id}
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
                              未取得分を取得
                            </>
                          )}
                        </button>
                        <span className="text-muted-foreground">
                          クリックで詳細
                        </span>
                      </>
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
          hasRetryable={!openRecord.allFetched}
          companyName={openRecord.companyName}
        />
      )}
    </div>
  );
}
