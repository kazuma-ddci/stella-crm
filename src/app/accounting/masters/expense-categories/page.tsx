import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseCategoriesTable } from "./expense-categories-table";
import { ensureCostCentersForActiveProjects } from "@/lib/accounting/cost-centers";

export default async function ExpenseCategoriesPage() {
  await ensureCostCentersForActiveProjects();

  const [expenseCategories, accounts, projects] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: {
        defaultAccount: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, name: true, defaultCostCenter: { select: { name: true } } } },
      },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, defaultCostCenter: { select: { name: true } } },
    }),
  ]);

  const data = expenseCategories.map((ec) => ({
    id: ec.id,
    name: ec.name,
    type: ec.type,
    projectId: ec.projectId ? String(ec.projectId) : "",
    projectName: ec.project?.defaultCostCenter?.name ?? ec.project?.name ?? "共通",
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

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.defaultCostCenter?.name ?? p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">費目</h1>
      <p className="text-sm text-muted-foreground">
        売上・経費取引の分類、予実管理、定期取引、自動仕訳ルールで使う分類です。
      </p>
      <Card>
        <CardHeader>
          <CardTitle>費目一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseCategoriesTable
            data={data}
            accountOptions={accountOptions}
            projectOptions={projectOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
