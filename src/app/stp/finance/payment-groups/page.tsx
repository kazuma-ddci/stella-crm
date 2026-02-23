import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentGroupsTable } from "./payment-groups-table";
import { getPaymentGroups } from "./actions";

export default async function PaymentGroupsPage() {
  const [data, counterparties, operatingCompanies] = await Promise.all([
    getPaymentGroups(),
    prisma.counterparty.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const counterpartyOptions = counterparties.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const operatingCompanyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  // サマリー計算
  const totalCount = data.length;
  const beforeRequestCount = data.filter(
    (r) => r.status === "before_request"
  ).length;
  const totalAmount = data.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
  const confirmedAmount = data
    .filter((r) => ["confirmed", "paid"].includes(r.status))
    .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">支払グループ管理</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">総件数</div>
            <div className="text-2xl font-bold">{totalCount}件</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">依頼前</div>
            <div className="text-2xl font-bold text-orange-600">
              {beforeRequestCount}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">支払合計</div>
            <div className="text-2xl font-bold text-emerald-600">
              ¥{totalAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">確認済み</div>
            <div className="text-2xl font-bold text-blue-600">
              ¥{confirmedAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentGroupsTable
        data={data}
        counterpartyOptions={counterpartyOptions}
        operatingCompanyOptions={operatingCompanyOptions}
      />
    </div>
  );
}
