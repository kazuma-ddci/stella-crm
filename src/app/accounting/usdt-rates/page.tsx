import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsdtRatesTable } from "./usdt-rates-table";

export default async function UsdtRatesPage() {
  const rates = await prisma.usdtDailyRate.findMany({
    orderBy: { date: "desc" },
  });

  const data = rates.map((r) => ({
    id: r.id,
    date: r.date.toISOString().split("T")[0],
    rate: Number(r.rate),
    source: r.source,
    createdAt: r.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">USDT日次レート</h1>
      <Card>
        <CardHeader>
          <CardTitle>レート一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <UsdtRatesTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
