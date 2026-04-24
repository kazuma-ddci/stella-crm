"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getStatusLabel,
  getTargetTypeLabel,
  getProviderLabel,
  type ContactHistoryV2WithRelations,
  getMeetingStateBadge,
} from "@/lib/contact-history-v2/types";

type Props = {
  histories: ContactHistoryV2WithRelations[];
};

export function ContactHistoriesV2Client({ histories }: Props) {
  if (histories.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-600">
        接触履歴はまだ登録されていません。
        <br />
        データ移行スクリプトを実行すると、既存のHOJO接触履歴がここに表示されます。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">ステータス</TableHead>
            <TableHead className="w-44">日時</TableHead>
            <TableHead>タイトル</TableHead>
            <TableHead>顧客</TableHead>
            <TableHead>先方参加者</TableHead>
            <TableHead>担当スタッフ</TableHead>
            <TableHead>接触方法</TableHead>
            <TableHead>接触種別</TableHead>
            <TableHead>会議</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {histories.map((h) => (
            <TableRow key={h.id} className="cursor-pointer hover:bg-gray-50">
              <TableCell>
                <Link href={`/hojo/records/contact-histories-v2/${h.id}`} className="block">
                  <StatusBadge status={h.status} />
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Link href={`/hojo/records/contact-histories-v2/${h.id}`} className="block">
                  {formatDateTime(h.scheduledStartAt, h.displayTimezone)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/hojo/records/contact-histories-v2/${h.id}`} className="block hover:underline">
                  {h.title ?? <span className="text-gray-400">—</span>}
                </Link>
              </TableCell>
              <TableCell>
                <CustomerParticipantsList participants={h.customerParticipants} />
              </TableCell>
              <TableCell>
                <AttendeesList participants={h.customerParticipants} />
              </TableCell>
              <TableCell>
                <StaffParticipantsList participants={h.staffParticipants} />
              </TableCell>
              <TableCell>{h.contactMethod?.name ?? "—"}</TableCell>
              <TableCell>{h.contactCategory?.name ?? "—"}</TableCell>
              <TableCell>
                <MeetingsList meetings={h.meetings} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = getStatusLabel(status);
  const variant =
    status === "scheduled"
      ? "default"
      : status === "completed"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

function CustomerParticipantsList({
  participants,
}: {
  participants: ContactHistoryV2WithRelations["customerParticipants"];
}) {
  if (participants.length === 0) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {participants.map((p) => (
        <Badge key={p.id} variant="outline">
          {getTargetTypeLabel(p.targetType)}
          {p.targetId !== null && <span className="ml-1 text-gray-400">#{p.targetId}</span>}
          {p.isPrimary && <span className="ml-1 text-xs text-blue-600">主</span>}
        </Badge>
      ))}
    </div>
  );
}

function AttendeesList({
  participants,
}: {
  participants: ContactHistoryV2WithRelations["customerParticipants"];
}) {
  const allAttendees = participants.flatMap((p) => p.attendees);
  if (allAttendees.length === 0) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {allAttendees.map((a) => (
        <Badge key={a.id} variant="secondary">
          {a.name}
          {a.title && <span className="ml-1 text-gray-500">（{a.title}）</span>}
        </Badge>
      ))}
    </div>
  );
}

function MeetingsList({
  meetings,
}: {
  meetings: ContactHistoryV2WithRelations["meetings"];
}) {
  if (meetings.length === 0) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {meetings.map((m) => {
        const hasRecord = m.record !== null;
        const hasAiSummary = hasRecord && m.record?.aiSummary !== null;
        const hasRecording = hasRecord && (m.record?.recordingPath !== null || m.record?.recordingUrl !== null);
        return (
          <div key={m.id} className="flex flex-wrap items-center gap-1 text-xs">
            <Badge variant={m.isPrimary ? "default" : "outline"}>
              {getProviderLabel(m.provider)}
            </Badge>
            {(() => {
              const b = getMeetingStateBadge(m.state);
              return (
                <Badge
                  variant="outline"
                  className={b.className}
                  title={b.description}
                >
                  {b.label}
                </Badge>
              );
            })()}
            {m.label && <span className="text-gray-500">（{m.label}）</span>}
            {hasRecording && <Badge variant="secondary">録画</Badge>}
            {hasAiSummary && (
              <Badge variant="secondary">
                AI要約({m.record?.aiSummarySource ?? ""})
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StaffParticipantsList({
  participants,
}: {
  participants: ContactHistoryV2WithRelations["staffParticipants"];
}) {
  if (participants.length === 0) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {participants.map((p) => (
        <Badge key={p.id} variant={p.isHost ? "default" : "outline"}>
          {p.staff.name}
          {p.isHost && <span className="ml-1 text-xs">(ホスト)</span>}
        </Badge>
      ))}
    </div>
  );
}

function formatDateTime(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
