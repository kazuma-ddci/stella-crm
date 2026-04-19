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
    where: { deletedAt: null },
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
            },
          },
          session: { select: { scheduledAt: true } },
        },
      },
      hostStaff: { select: { name: true } },
    },
  });

  // 猶予期間: 会議終了から6時間経過でZoom処理が完了しているとみなす
  const GRACE_PERIOD_MS = 6 * 60 * 60 * 1000;
  const now = Date.now();

  const clientRows: RecordingRow[] = rows.map((r) => {
    const contactDate =
      r.scheduledAt ?? r.contactHistory?.session?.scheduledAt ?? null;

    // 会議終了時刻（優先順位: recordingEndAt > scheduledAt > createdAt）
    const meetingEndReference =
      r.recordingEndAt ?? r.scheduledAt ?? r.createdAt;
    const pastGracePeriod =
      now - meetingEndReference.getTime() > GRACE_PERIOD_MS;

    // 実際に取得を試みたかどうか（API結果に基づく厳密な試行済みフラグ）
    const aiSummaryActuallyAttempted = !!r.aiCompanionFetchedAt;
    const chatActuallyAttempted = !!r.chatFetchedAt;
    const participantsActuallyAttempted = !!r.participantsFetchedAt;
    const recordingActuallyAttempted =
      r.downloadStatus === "completed" || r.downloadStatus === "no_recording";

    // 表示用「試行済み」（猶予期間超過で "該当なし確定" とみなす）
    const aiSummaryAttempted = aiSummaryActuallyAttempted || pastGracePeriod;
    const chatAttempted = chatActuallyAttempted || pastGracePeriod;
    const participantsAttempted =
      participantsActuallyAttempted || pastGracePeriod;
    const recordingAttempted =
      recordingActuallyAttempted || pastGracePeriod;

    // 「データが存在する」フラグ
    const hasAiSummary = !!r.aiCompanionSummary;
    const hasMp4 = !!r.mp4Path;
    const hasTranscript = !!r.transcriptText;
    const hasChat = !!r.chatLogText;
    const hasParticipants =
      !!r.participantsJson && r.participantsJson !== "[]";
    const hasNextSteps = !!r.summaryNextSteps;

    // 全項目が試行済みなら「取得済み」とみなす（グレー含む）
    const allFetched =
      aiSummaryAttempted &&
      chatAttempted &&
      participantsAttempted &&
      recordingAttempted;

    // 実際に全項目が試行済みか（再取得ボタン非表示の判定用）
    const actuallyAllFetched =
      aiSummaryActuallyAttempted &&
      chatActuallyAttempted &&
      participantsActuallyAttempted &&
      recordingActuallyAttempted;

    return {
      id: r.id,
      category: r.category as "briefing" | "consultation",
      companyName: r.contactHistory?.companyRecord?.companyName ?? null,
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
      hasNextSteps,
      allFetched,
      actuallyAllFetched,
      pastGracePeriod,
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
          <div className="text-sm text-muted-foreground mb-4 space-y-1">
            <p>
              Zoom商談の録画と自動取得された議事録の一覧です。行をクリックすると詳細モーダルが開き、取得・要約・文字起こし・チャット・参加者・接触履歴・お礼文案などを確認・操作できます。
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>
                <span className="inline-block w-4 text-center font-bold text-green-700">✓</span>{" "}
                取得済み
              </span>
              <span>
                <span className="inline-block w-4 text-center font-bold text-muted-foreground">―</span>{" "}
                該当なし（Zoom側に元々存在しない・確定）
              </span>
              <span>
                <span className="inline-block w-4 text-center font-bold text-amber-700">○</span>{" "}
                未取得（「未取得分を取得」ボタンまたは詳細モーダルから取得）
              </span>
            </p>
          </div>
          <RecordingsClient rows={clientRows} />
        </CardContent>
      </Card>
    </div>
  );
}
