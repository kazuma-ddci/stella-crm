import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringTransactionsTable } from "./recurring-transactions-table";
import { toLocalDateString } from "@/lib/utils";

export default async function RecurringTransactionsPage() {
  const [
    recurringTransactions,
    counterparties,
    expenseCategories,
    costCenters,
    allocationTemplates,
    paymentMethods,
    projects,
  ] = await Promise.all([
    prisma.recurringTransaction.findMany({
      where: { deletedAt: null },
      orderBy: [{ id: "asc" }],
      include: {
        counterparty: { select: { id: true, name: true } },
        expenseCategory: { select: { id: true, name: true, type: true } },
        costCenter: { select: { id: true, name: true } },
        allocationTemplate: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { transactions: { where: { deletedAt: null } } } },
      },
    }),
    prisma.counterparty.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, displayId: true },
    }),
    prisma.expenseCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.costCenter.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    prisma.allocationTemplate.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentMethod.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    prisma.masterProject.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const data = recurringTransactions.map((rt) => ({
    id: rt.id,
    type: rt.type,
    name: rt.name,
    counterpartyId: String(rt.counterpartyId),
    counterpartyName: rt.counterparty?.name ?? "",
    expenseCategoryId: String(rt.expenseCategoryId),
    expenseCategoryName: rt.expenseCategory?.name ?? "",
    expenseCategoryType: rt.expenseCategory?.type ?? "",
    amountType: rt.amountType,
    amount: rt.amount,
    taxAmount: rt.taxAmount,
    taxRate: rt.taxRate,
    frequency: rt.frequency,
    executionDay: rt.executionDay,
    startDate: toLocalDateString(rt.startDate),
    endDate: rt.endDate ? toLocalDateString(rt.endDate) : "",
    costCenterId: rt.costCenterId ? String(rt.costCenterId) : "",
    costCenterName: rt.costCenter?.name ?? "",
    allocationTemplateId: rt.allocationTemplateId
      ? String(rt.allocationTemplateId)
      : "",
    allocationTemplateName: rt.allocationTemplate?.name ?? "",
    paymentMethodId: rt.paymentMethodId ? String(rt.paymentMethodId) : "",
    paymentMethodName: rt.paymentMethod?.name ?? "",
    projectId: rt.projectId ? String(rt.projectId) : "",
    projectName: rt.project?.name ?? "",
    note: rt.note ?? "",
    isActive: rt.isActive,
    transactionCount: rt._count.transactions,
  }));

  const counterpartyOptions = counterparties.map((c) => ({
    value: String(c.id),
    label: c.displayId ? `${c.displayId} ${c.name}` : c.name,
  }));

  // 費目を種別ごとにグループ分け（dynamicOptions用）
  const expenseCategoryByType: Record<
    string,
    { value: string; label: string }[]
  > = {};
  for (const ec of expenseCategories) {
    const options = [
      { value: String(ec.id), label: ec.name },
    ];
    // "revenue" タイプに追加
    if (ec.type === "revenue" || ec.type === "both") {
      if (!expenseCategoryByType["revenue"]) {
        expenseCategoryByType["revenue"] = [];
      }
      expenseCategoryByType["revenue"].push(...options);
    }
    // "expense" タイプに追加
    if (ec.type === "expense" || ec.type === "both") {
      if (!expenseCategoryByType["expense"]) {
        expenseCategoryByType["expense"] = [];
      }
      expenseCategoryByType["expense"].push(...options);
    }
  }

  const costCenterOptions = costCenters.map((cc) => ({
    value: String(cc.id),
    label: cc.name,
  }));

  const allocationTemplateOptions = allocationTemplates.map((at) => ({
    value: String(at.id),
    label: at.name,
  }));

  const paymentMethodOptions = paymentMethods.map((pm) => ({
    value: String(pm.id),
    label: pm.name,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">定期取引</h1>
      <Card>
        <CardHeader>
          <CardTitle>定期取引一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <RecurringTransactionsTable
            data={data}
            counterpartyOptions={counterpartyOptions}
            expenseCategoryByType={expenseCategoryByType}
            costCenterOptions={costCenterOptions}
            allocationTemplateOptions={allocationTemplateOptions}
            paymentMethodOptions={paymentMethodOptions}
            projectOptions={projectOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
