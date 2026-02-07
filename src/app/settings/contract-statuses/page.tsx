import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractStatusesTable } from "./contract-statuses-table";
import { auth } from "@/auth";

export default async function ContractStatusesPage() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEditMasterData = (session?.user as any)?.canEditMasterData === true;

  const contractStatuses = await prisma.masterContractStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = contractStatuses.map((cs) => ({
    id: cs.id,
    name: cs.name,
    displayOrder: cs.displayOrder,
    isTerminal: cs.isTerminal,
    isActive: cs.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約ステータス</h1>
      <Card>
        <CardHeader>
          <CardTitle>契約ステータス一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractStatusesTable data={data} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
