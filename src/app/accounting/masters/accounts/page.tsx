import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountsTable } from "./accounts-table";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });

  const data = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    category: a.category,
    subcategory: a.subcategory,
    displayOrder: a.displayOrder,
    isActive: a.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">勘定科目マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>勘定科目一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
