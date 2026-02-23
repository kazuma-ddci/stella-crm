import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterpartiesTable } from "./counterparties-table";

export default async function CounterpartiesPage() {
  const [counterparties, companies] = await Promise.all([
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        company: { select: { id: true, name: true, companyCode: true } },
      },
    }),
    prisma.masterStellaCompany.findMany({
      where: { deletedAt: null, mergedIntoId: null },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, companyCode: true },
    }),
  ]);

  const data = counterparties.map((cp) => ({
    id: cp.id,
    name: cp.name,
    counterpartyType: cp.counterpartyType,
    companyId: cp.companyId ? String(cp.companyId) : "",
    memo: cp.memo ?? "",
    isActive: cp.isActive,
  }));

  const companyOptions = companies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} - ${c.name}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">取引先マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>取引先一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CounterpartiesTable data={data} companyOptions={companyOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
