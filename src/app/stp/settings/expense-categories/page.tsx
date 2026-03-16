import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseCategoriesTable } from "./expense-categories-table";
import { getSystemProjectContext } from "@/lib/project-context";
import { ensureSystemExpenseCategories } from "@/lib/expense-category-defaults";

export default async function StpExpenseCategoriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const canEdit = canEditProjectMasterDataSync(session.user, "stp");

  const ctx = await getSystemProjectContext("stp");
  if (!ctx) throw new Error("STPプロジェクトのコンテキストが取得できません");

  // システムデフォルト費目を自動作成（不足分のみ）
  await ensureSystemExpenseCategories(ctx.projectId);

  const expenseCategories = await prisma.expenseCategory.findMany({
    where: {
      deletedAt: null,
      projectId: ctx.projectId,
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });

  const data = expenseCategories.map((ec) => ({
    id: ec.id,
    name: ec.name,
    type: ec.type,
    systemCode: ec.systemCode,
    displayOrder: ec.displayOrder,
    isActive: ec.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">費目マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>費目一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseCategoriesTable data={data} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
