import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageHistoriesTable } from "./stage-histories-table";

export default async function StageHistoriesPage() {
  const [histories, stpCompanies, stages] = await Promise.all([
    prisma.stpStageHistory.findMany({
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
    }),
    prisma.stpCompany.findMany({
      include: {
        company: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.stpStage.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const data = histories.map((h) => ({
    id: h.id,
    stpCompanyId: h.stpCompanyId,
    companyName: h.stpCompany.company.name,
    eventType: h.eventType,
    fromStageId: h.fromStageId,
    fromStageName: h.fromStage?.name,
    toStageId: h.toStageId,
    toStageName: h.toStage?.name,
    targetDate: h.targetDate?.toISOString(),
    recordedAt: h.recordedAt.toISOString(),
    changedBy: h.changedBy,
    note: h.note,
  }));

  const stpCompanyOptions = stpCompanies.map((c) => ({
    value: String(c.id),
    label: c.company.name,
  }));

  const stageOptions = stages.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">商談パイプライン履歴</h1>
      <Card>
        <CardHeader>
          <CardTitle>履歴一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <StageHistoriesTable
            data={data}
            stpCompanyOptions={stpCompanyOptions}
            stageOptions={stageOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
