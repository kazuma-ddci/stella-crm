import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractStatusesTable } from "./contract-statuses-table";

export default async function ContractStatusesPage() {
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
      <h1 className="text-2xl font-bold">契約書ステータス</h1>
      <Card>
        <CardHeader>
          <CardTitle>契約書ステータス一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractStatusesTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
