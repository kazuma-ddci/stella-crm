import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { listMeetingRecordsForProject } from "@/lib/contact-history-v2/meeting-records/loaders";
import { MeetingRecordsTable } from "@/components/meeting-records/recordings-table";

export default async function HojoMeetingRecordsPage() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  const rows = await listMeetingRecordsForProject({
    projectCode: "hojo",
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">会議録画・議事録</h1>
      <Card>
        <CardHeader>
          <CardTitle>録画・議事録一覧（直近100件）</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            オンライン会議（Zoom / Google Meet / Teams 等）の録画・議事録・参加者情報をまとめて確認できます。
            行をクリックすると詳細ページで、要約・動画・文字起こし・チャット・参加者・接触履歴のタブをご覧いただけます。
          </p>
          <MeetingRecordsTable projectCode="hojo" rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
