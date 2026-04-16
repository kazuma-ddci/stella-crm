import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { RecordingsClient, type RecordingRow } from "./recordings-client";

function toJstDisplay(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16).replace("T", " ");
}

export default async function ZoomRecordingsPage() {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

  const rows = await prisma.slpZoomRecording.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      contactHistory: {
        include: {
          companyRecord: {
            select: {
              id: true,
              companyName: true,
              prolineUid: true,
              briefingDate: true,
              consultationDate: true,
            },
          },
        },
      },
      hostStaff: { select: { name: true } },
    },
  });

  const clientRows: RecordingRow[] = rows.map((r) => {
    const isBriefing = r.category === "briefing";
    const contactDate = isBriefing
      ? r.contactHistory?.companyRecord?.briefingDate
      : r.contactHistory?.companyRecord?.consultationDate;

    const hasAiSummary = !!r.aiCompanionSummary;
    const hasMp4 = !!r.mp4Path;
    const hasTranscript = !!r.transcriptText;
    const hasChat = !!r.chatLogText;
    const hasParticipants = !!r.participantsFetchedAt;
    const allFetched =
      hasAiSummary && hasMp4 && hasTranscript && hasParticipants;

    return {
      id: r.id,
      category: r.category as "briefing" | "consultation",
      companyName: r.contactHistory?.companyRecord?.companyName ?? null,
      contactDate: toJstDisplay(contactDate),
      hostName: r.hostStaff?.name ?? null,
      hasAiSummary,
      hasMp4,
      hasTranscript,
      hasChat,
      hasParticipants,
      hasNextSteps: !!r.summaryNextSteps,
      allFetched,
      aiCompanionSummary: r.aiCompanionSummary,
      summaryNextSteps: r.summaryNextSteps,
      claudeSummary: r.claudeSummary,
      claudeSummaryGeneratedAt: toJstDisplay(r.claudeSummaryGeneratedAt),
      claudeSummaryModel: r.claudeSummaryModel,
      transcriptText: r.transcriptText,
      chatLogText: r.chatLogText,
      participantsJson: r.participantsJson,
      mp4Path: r.mp4Path,
      downloadStatus: r.downloadStatus,
      companyRecordId: r.contactHistory?.companyRecord?.id ?? null,
      prolineUid: r.contactHistory?.companyRecord?.prolineUid ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Zoom商談録画</h1>
      <Card>
        <CardHeader>
          <CardTitle>録画・議事録一覧（直近100件）</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Zoom商談の録画と自動取得された議事録の一覧です。
            各行のアイコンで取得状況が確認できます。「取得」ボタンで未取得分をまとめて取りに行きます。
          </p>
          <RecordingsClient rows={clientRows} />
        </CardContent>
      </Card>
    </div>
  );
}
