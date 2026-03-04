import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageHistoriesTable } from "./stage-histories-table";

export default async function StageHistoriesPage() {
  const histories = await prisma.stpStageHistory.findMany({
    include: {
      stpCompany: {
        include: {
          company: true,
        },
      },
      fromStage: true,
      toStage: true,
    },
    orderBy: { recordedAt: "desc" },
  });

  const data = histories.map((h) => ({
    id: h.id,
    companyName: h.stpCompany.company.name,
    eventType: h.eventType,
    fromStageName: h.fromStage?.name,
    toStageName: h.toStage?.name,
    targetDate: h.targetDate?.toISOString(),
    recordedAt: h.recordedAt.toISOString(),
    changedBy: h.changedBy,
    note: h.note,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">商談パイプライン履歴</h1>
      <Card>
        <CardHeader>
          <CardTitle>履歴一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <StageHistoriesTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
