"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UnifiedDetailModal } from "./unified-detail-modal";

export type RecordingRow = {
  id: number;
  targetType: string;
  customerName: string | null;
  contactDate: string | null;
  hostName: string | null;
  zoomMeetingId: string;
  state: string | null;
  aiSummaryAttempted: boolean;
  chatAttempted: boolean;
  participantsAttempted: boolean;
  recordingAttempted: boolean;
  hasAiSummary: boolean;
  hasMp4: boolean;
  hasTranscript: boolean;
  hasChat: boolean;
  hasParticipants: boolean;
  allFetched: boolean;
  downloadStatus: string;
};

function StatusCell({ has, attempted }: { has: boolean; attempted: boolean }) {
  if (has) return <span className="text-green-700 font-bold">✓</span>;
  if (attempted) return <span className="text-muted-foreground">―</span>;
  return <span className="text-amber-700">○</span>;
}

function StateBadge({ state }: { state: string | null }) {
  if (!state) return null;
  const style =
    state === "完了"
      ? "bg-green-100 text-green-900"
      : state === "失敗"
        ? "bg-red-100 text-red-900"
        : state === "取得中"
          ? "bg-blue-100 text-blue-900"
          : "bg-amber-100 text-amber-900";
  return <Badge className={`text-[10px] ${style}`}>{state}</Badge>;
}

export function RecordingsClient({ rows }: { rows: RecordingRow[] }) {
  const [detailId, setDetailId] = useState<number | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">日時</TableHead>
              <TableHead className="w-[100px]">種別</TableHead>
              <TableHead>相手先</TableHead>
              <TableHead className="w-[120px]">ホスト</TableHead>
              <TableHead className="w-[80px]">状態</TableHead>
              <TableHead className="w-[50px] text-center">AI要約</TableHead>
              <TableHead className="w-[50px] text-center">MP4</TableHead>
              <TableHead className="w-[50px] text-center">文字起こし</TableHead>
              <TableHead className="w-[50px] text-center">チャット</TableHead>
              <TableHead className="w-[50px] text-center">参加者</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Zoom録画はまだ登録されていません
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setDetailId(r.id)}
              >
                <TableCell className="text-xs">{r.contactDate ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {r.targetType}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{r.customerName ?? "-"}</TableCell>
                <TableCell className="text-xs">{r.hostName ?? "-"}</TableCell>
                <TableCell>
                  <StateBadge state={r.state} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusCell has={r.hasAiSummary} attempted={r.aiSummaryAttempted} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusCell has={r.hasMp4} attempted={r.recordingAttempted} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusCell has={r.hasTranscript} attempted={r.recordingAttempted} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusCell has={r.hasChat} attempted={r.chatAttempted} />
                </TableCell>
                <TableCell className="text-center">
                  <StatusCell
                    has={r.hasParticipants}
                    attempted={r.participantsAttempted}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {detailId !== null && (
        <UnifiedDetailModal
          open={detailId !== null}
          onOpenChange={(o) => {
            if (!o) setDetailId(null);
          }}
          recordingId={detailId}
        />
      )}
    </>
  );
}
