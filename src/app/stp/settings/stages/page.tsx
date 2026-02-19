import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StagesTable } from "./stages-table";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function StagesPage() {
  const session = await auth();
  const canEditMasterData = canEditMasterDataSync(session?.user);
  const stages = await prisma.stpStage.findMany({
    orderBy: { displayOrder: { sort: "asc", nulls: "last" } },
  });

  const data = stages.map((s) => ({
    id: s.id,
    name: s.name,
    stageType: s.stageType,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">商談ステージ設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>ステージ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <StagesTable data={data} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
