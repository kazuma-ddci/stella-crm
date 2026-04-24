import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getContactHistoryV2ById } from "@/lib/contact-history-v2/loaders";
import {
  getStatusLabel,
  getTargetTypeLabel,
  getProviderLabel,
  getMeetingStateBadge,
} from "@/lib/contact-history-v2/types";
import { DeleteContactHistoryButton } from "./delete-button";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SlpContactHistoryV2DetailPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const history = await getContactHistoryV2ById(id, { projectCode: "hojo" });
  if (!history) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {history.title ?? `接触履歴 #${history.id}`}
            </h1>
            <Badge
              variant={
                history.status === "scheduled"
                  ? "default"
                  : history.status === "completed"
                    ? "secondary"
                    : "outline"
              }
            >
              {getStatusLabel(history.status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            ID: {history.id} / 作成: {history.createdAt.toLocaleString("ja-JP")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/hojo/records/contact-histories-v2/${history.id}/edit`}>
            <Button variant="outline">編集</Button>
          </Link>
          <DeleteContactHistoryButton id={history.id} />
        </div>
      </div>

      {/* 基本情報 */}
      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">基本情報</h2>
        <DetailRow label="予定開始">{formatDateTime(history.scheduledStartAt)}</DetailRow>
        {history.scheduledEndAt && (
          <DetailRow label="予定終了">{formatDateTime(history.scheduledEndAt)}</DetailRow>
        )}
        {history.actualStartAt && (
          <DetailRow label="実施時刻">{formatDateTime(history.actualStartAt)}</DetailRow>
        )}
        <DetailRow label="接触方法">{history.contactMethod?.name ?? "—"}</DetailRow>
        <DetailRow label="接触種別">{history.contactCategory?.name ?? "—"}</DetailRow>
        <DetailRow label="プロジェクト">{history.project.name}</DetailRow>
        {history.rescheduledCount > 0 && (
          <DetailRow label="リスケ回数">{history.rescheduledCount}回</DetailRow>
        )}
        {history.cancelledAt && (
          <DetailRow label="キャンセル">
            {formatDateTime(history.cancelledAt)}
            {history.cancelledReason && ` - ${history.cancelledReason}`}
          </DetailRow>
        )}
      </section>

      {/* 顧客側参加者 */}
      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">顧客</h2>
        {history.customerParticipants.length === 0 ? (
          <p className="text-sm text-gray-400">顧客が設定されていません</p>
        ) : (
          <div className="space-y-2">
            {history.customerParticipants.map((p) => (
              <div key={p.id} className="rounded border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getTargetTypeLabel(p.targetType)}</Badge>
                  {p.targetId !== null && (
                    <span className="text-sm text-gray-500">ID: {p.targetId}</span>
                  )}
                  {p.isPrimary && <Badge>主顧客</Badge>}
                </div>
                {p.attendees.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">先方参加者:</div>
                    <div className="flex flex-wrap gap-1">
                      {p.attendees.map((a) => (
                        <Badge key={a.id} variant="secondary">
                          {a.name}
                          {a.title && <span className="ml-1 text-gray-400">（{a.title}）</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 弊社スタッフ */}
      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">弊社スタッフ</h2>
        {history.staffParticipants.length === 0 ? (
          <p className="text-sm text-gray-400">担当スタッフが設定されていません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {history.staffParticipants.map((p) => (
              <Badge key={p.id} variant={p.isHost ? "default" : "outline"}>
                {p.staff.name}
                {p.isHost && <span className="ml-1 text-xs">(ホスト)</span>}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* 会議 */}
      {history.meetings.length > 0 && (
        <section className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold">オンライン会議</h2>
          <div className="space-y-3">
            {history.meetings.map((m) => (
              <div key={m.id} className="rounded border p-3">
                <div className="flex items-center gap-2">
                  <Badge>{getProviderLabel(m.provider)}</Badge>
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
                  {m.label && <span className="text-xs text-gray-500">（{m.label}）</span>}
                  {m.isPrimary && <Badge variant="outline">主会議</Badge>}
                </div>
                {m.joinUrl && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">URL: </span>
                    <a
                      href={m.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {m.joinUrl}
                    </a>
                  </div>
                )}
                {m.hostStaff && (
                  <div className="mt-1 text-sm">
                    <span className="text-gray-500">ホスト: </span>
                    {m.hostStaff.name}
                  </div>
                )}
                {m.record?.aiSummary && (
                  <div className="mt-3 rounded bg-gray-50 p-2 text-xs">
                    <div className="font-semibold mb-1">
                      AI要約（{m.record.aiSummarySource}）
                    </div>
                    <div className="whitespace-pre-wrap text-gray-700">
                      {m.record.aiSummary.slice(0, 500)}
                      {m.record.aiSummary.length > 500 && "..."}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 議事録・メモ */}
      {(history.meetingMinutes || history.note) && (
        <section className="rounded-lg border bg-white p-4 space-y-3">
          {history.meetingMinutes && (
            <div>
              <h2 className="text-lg font-semibold mb-2">議事録</h2>
              <div className="whitespace-pre-wrap text-sm text-gray-700">
                {history.meetingMinutes}
              </div>
            </div>
          )}
          {history.note && (
            <div>
              <h2 className="text-lg font-semibold mb-2">メモ</h2>
              <div className="whitespace-pre-wrap text-sm text-gray-700">
                {history.note}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ファイル */}
      {history.files.length > 0 && (
        <section className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold">添付ファイル</h2>
          <ul className="space-y-1 text-sm">
            {history.files.map((f) => (
              <li key={f.id}>
                {f.url ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {f.fileName}
                  </a>
                ) : (
                  <span>{f.fileName}</span>
                )}
                {f.fileSize && (
                  <span className="ml-2 text-gray-400">
                    ({Math.round(f.fileSize / 1024)}KB)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <Link
          href="/hojo/records/contact-histories-v2"
          className="text-sm text-gray-500 hover:underline"
        >
          ← 一覧に戻る
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
      <div className="text-gray-500">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
