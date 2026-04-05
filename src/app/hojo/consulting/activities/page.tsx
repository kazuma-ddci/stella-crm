import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityListTable } from "./activities-table";

export default async function ConsultingActivitiesPage() {
  const activities = await prisma.hojoConsultingActivity.findMany({
    where: { deletedAt: null },
    include: {
      vendor: { select: { id: true, name: true } },
      tasks: { orderBy: [{ taskType: "asc" }, { displayOrder: "asc" }] },
    },
    orderBy: { activityDate: "desc" },
  });

  const data = activities.map((a) => ({
    id: a.id,
    vendorId: a.vendorId,
    vendorName: a.vendor.name,
    activityDate: a.activityDate.toISOString().split("T")[0],
    contactMethod: a.contactMethod ?? "",
    vendorIssue: a.vendorIssue ?? "",
    hearingContent: a.hearingContent ?? "",
    responseContent: a.responseContent ?? "",
    proposalContent: a.proposalContent ?? "",
    vendorNextAction: a.vendorNextAction ?? "",
    nextDeadline: a.nextDeadline?.toISOString().split("T")[0] ?? "",
    tasks: a.tasks.map((t) => ({
      id: t.id,
      taskType: t.taskType as "vendor" | "consulting_team",
      content: t.content ?? "",
      deadline: t.deadline?.toISOString().split("T")[0] ?? "",
      priority: t.priority ?? "",
      completed: t.completed,
    })),
    attachmentUrls: (a.attachmentUrls as string[] | null) ?? [],
    recordingUrls: (a.recordingUrls as string[] | null) ?? [],
    screenshotUrls: (a.screenshotUrls as string[] | null) ?? [],
    notes: a.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">コンサル履歴一覧</h1>
      <p className="text-sm text-gray-500">全ベンダーのコンサル履歴を一覧で確認できます。編集は各ベンダーの詳細ページから行ってください。</p>
      <Card>
        <CardHeader>
          <CardTitle>コンサル履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityListTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
