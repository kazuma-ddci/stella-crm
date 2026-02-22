import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseCategoriesTable } from "./expense-categories-table";

export default async function ExpenseCategoriesPage() {
  const [expenseCategories, accounts] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: { defaultAccount: { select: { id: true, code: true, name: true } } },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, code: true, name: true },
    }),
  ]);

  const data = expenseCategories.map((ec) => ({
    id: ec.id,
    name: ec.name,
    type: ec.type,
    defaultAccountId: ec.defaultAccountId ? String(ec.defaultAccountId) : "",
    defaultAccountLabel: ec.defaultAccount
      ? `${ec.defaultAccount.code} - ${ec.defaultAccount.name}`
      : "",
    displayOrder: ec.displayOrder,
    isActive: ec.isActive,
  }));

  const accountOptions = accounts.map((a) => ({
    value: String(a.id),
    label: `${a.code} - ${a.name}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">費目マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>費目一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseCategoriesTable data={data} accountOptions={accountOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
