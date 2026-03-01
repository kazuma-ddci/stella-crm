import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterpartiesTable } from "./counterparties-table";

export default async function CounterpartiesPage() {
  const counterparties = await prisma.counterparty.findMany({
    where: { deletedAt: null, mergedIntoId: null, companyId: null },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const data = counterparties.map((cp) => ({
    id: cp.id,
    displayId: cp.displayId ?? "",
    name: cp.name,
    counterpartyType: cp.counterpartyType,
    memo: cp.memo ?? "",
    isActive: cp.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">その他取引先</h1>
      <Card>
        <CardHeader>
          <CardTitle>取引先一覧（Stella全顧客マスタ以外）</CardTitle>
        </CardHeader>
        <CardContent>
          <CounterpartiesTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
