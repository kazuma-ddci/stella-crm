import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { RecordingsClient, type RecordingRow } from "./recordings-client";

function toJstDisplay(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16).replace("T", " ");
}

export default async function HojoZoomRecordingsPage() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);

  const rows = await prisma.hojoZoomRecording.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      contactHistory: {
        include: {
          vendor: { select: { id: true, name: true } },
        },
      },
      hostStaff: { select: { name: true } },
    },
  });

  const GRACE_PERIOD_MS = 6 * 60 * 60 * 1000;
  const now = Date.now();

  const clientRows: RecordingRow[] = rows.map((r) => {
    const contactDate = r.scheduledAt ?? null;
    const meetingEndReference =
      r.recordingEndAt ?? r.scheduledAt ?? r.createdAt;
    const pastGracePeriod =
      now - meetingEndReference.getTime() > GRACE_PERIOD_MS;

    const aiSummaryActuallyAttempted = !!r.aiCompanionFetchedAt;
    const chatActuallyAttempted = !!r.chatFetchedAt;
    const participantsActuallyAttempted = !!r.participantsFetchedAt;
    const recordingActuallyAttempted =
      r.downloadStatus === "completed" || r.downloadStatus === "no_recording";

    const aiSummaryAttempted = aiSummaryActuallyAttempted || pastGracePeriod;
    const chatAttempted = chatActuallyAttempted || pastGracePeriod;
    const participantsAttempted =
      participantsActuallyAttempted || pastGracePeriod;
    const recordingAttempted = recordingActuallyAttempted || pastGracePeriod;

    const hasAiSummary = !!r.aiCompanionSummary;
    const hasMp4 = !!r.mp4Path;
    const hasTranscript = !!r.transcriptText;
    const hasChat = !!r.chatLogText;
    const hasParticipants =
      !!r.participantsJson && r.participantsJson !== "[]";

    const allFetched =
      aiSummaryAttempted &&
      chatAttempted &&
      participantsAttempted &&
      recordingAttempted;

    // 相手先名・種別の解決（targetType カラムで分類、ベンダーのみ FK 参照）
    const tt = r.contactHistory?.targetType ?? "other";
    const targetType =
      tt === "vendor"
        ? "ベンダー"
        : tt === "bbs"
          ? "BBS"
          : tt === "lender"
            ? "貸金業社"
            : "その他";
    const customerName =
      r.contactHistory?.vendor?.name ||
      r.contactHistory?.customerParticipants ||
      null;

    return {
      id: r.id,
      targetType,
      customerName,
      contactDate: toJstDisplay(contactDate),
      hostName: r.hostStaff?.name ?? null,
      zoomMeetingId: r.zoomMeetingId.toString(),
      state: r.state ?? null,
      aiSummaryAttempted,
      chatAttempted,
      participantsAttempted,
      recordingAttempted,
      hasAiSummary,
      hasMp4,
      hasTranscript,
      hasChat,
      hasParticipants,
      allFetched,
      downloadStatus: r.downloadStatus,
    };
  });

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold">Zoom商談録画</h1>
      <Card>
        <CardHeader>
          <CardTitle>録画・議事録一覧（直近100件）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4 space-y-1">
            <p>
              HOJO商談の録画と自動取得された議事録の一覧です。行をクリックすると詳細モーダルが開きます。
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>
                <span className="inline-block w-4 text-center font-bold text-green-700">✓</span>{" "}
                取得済み
              </span>
              <span>
                <span className="inline-block w-4 text-center font-bold text-muted-foreground">―</span>{" "}
                該当なし
              </span>
              <span>
                <span className="inline-block w-4 text-center font-bold text-amber-700">○</span>{" "}
                未取得
              </span>
            </p>
          </div>
          <RecordingsClient rows={clientRows} />
        </CardContent>
      </Card>
    </div>
  );
}
