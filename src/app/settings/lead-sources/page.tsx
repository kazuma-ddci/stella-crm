import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadSourcesTable } from "./lead-sources-table";
import { auth } from "@/auth";

export default async function LeadSourcesPage() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEditMasterData = (session?.user as any)?.canEditMasterData === true;

  const leadSources = await prisma.stpLeadSource.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = leadSources.map((ls) => ({
    id: ls.id,
    name: ls.name,
    displayOrder: ls.displayOrder,
    isActive: ls.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP_流入経路</h1>
      <Card>
        <CardHeader>
          <CardTitle>流入経路一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadSourcesTable data={data} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
