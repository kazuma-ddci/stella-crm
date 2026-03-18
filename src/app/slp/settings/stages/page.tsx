import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlpStagesTable } from "./stages-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function SlpStagesPage() {
  const session = await auth();
  const canEditMasterData = canEditProjectMasterDataSync(session?.user);
  const stages = await prisma.slpStage.findMany({
    orderBy: { stageNumber: "asc" },
  });

  const data = stages.map((s) => ({
    id: s.id,
    name: s.name,
    stageNumber: s.stageNumber,
    phase: s.phase,
    winRate: s.winRate,
    autoAction: s.autoAction,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">パイプライン設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>パイプライン一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <SlpStagesTable data={data} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
