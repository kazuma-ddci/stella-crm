import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusesTable } from "./statuses-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function StatusesPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const statuses = await prisma.hojoApplicationStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ステータス</h1>
      <Card>
        <CardHeader>
          <CardTitle>ステータス一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusesTable data={data} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
