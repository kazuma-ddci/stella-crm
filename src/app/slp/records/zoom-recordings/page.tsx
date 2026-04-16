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
    return {
      id: r.id,
      category: r.category as "briefing" | "consultation",
      companyName: r.contactHistory?.companyRecord?.companyName ?? null,
      contactDate: toJstDisplay(contactDate),
      hostName: r.hostStaff?.name ?? null,
      hasMp4: !!r.mp4Path,
      hasTranscript: !!r.transcriptText,
      aiCompanionSummary: r.aiCompanionSummary,
      claudeSummary: r.claudeSummary,
      claudeSummaryGeneratedAt: toJstDisplay(r.claudeSummaryGeneratedAt),
      claudeSummaryModel: r.claudeSummaryModel,
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
            Zoom商談の録画と自動生成された要約の一覧です。
            「Claude生成」でAI議事録を生成・再生成でき、「お礼文案」で送信用メッセージの下書きを作成できます。
          </p>
          <RecordingsClient rows={clientRows} />
        </CardContent>
      </Card>
    </div>
  );
}
