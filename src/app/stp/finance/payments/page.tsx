import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentsTable } from "./payments-table";

export default async function PaymentsPage() {
  const [transactions, revenueRecords, expenseRecords] = await Promise.all([
    prisma.stpPaymentTransaction.findMany({
      where: { deletedAt: null },
      include: {
        allocations: {
          include: {
            revenueRecord: {
              include: {
                stpCompany: { include: { company: true } },
              },
            },
            expenseRecord: {
              include: {
                agent: { include: { company: true } },
              },
            },
          },
        },
        processor: true,
      },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
    }),
    prisma.stpRevenueRecord.findMany({
      where: {
        deletedAt: null,
        status: { not: "cancelled" },
      },
      include: {
        stpCompany: { include: { company: true } },
      },
    }),
    prisma.stpExpenseRecord.findMany({
      where: {
        deletedAt: null,
        status: { not: "cancelled" },
      },
      include: {
        agent: { include: { company: true } },
      },
    }),
  ]);

  const formatDate = (date: Date | null): string | null => {
    if (!date) return null;
    return date.toISOString().split("T")[0];
  };

  const data: Record<string, unknown>[] = transactions.map((t) => ({
    id: t.id,
    direction: t.direction,
    transactionDate: formatDate(t.transactionDate),
    amount: t.amount,
    counterpartyName: t.counterpartyName,
    bankAccountName: t.bankAccountName,
    accountCode: t.accountCode,
    accountName: t.accountName,
    withholdingTaxAmount: t.withholdingTaxAmount,
    status: t.status,
    note: t.note,
    allocations: t.allocations.map((a) => ({
      id: a.id,
      allocatedAmount: a.allocatedAmount,
      note: a.note,
      revenueRecordId: a.revenueRecordId,
      expenseRecordId: a.expenseRecordId,
      revenueCompanyName: a.revenueRecord?.stpCompany?.company?.name || null,
      expenseAgentName: a.expenseRecord?.agent?.company?.name || null,
    })),
    totalAllocated: t.allocations.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0
    ),
  }));

  // Revenue records for allocation modal
  const revenueOptions = revenueRecords.map((r) => ({
    id: r.id,
    companyName: r.stpCompany.company.name,
    revenueType: r.revenueType,
    targetMonth: formatDate(r.targetMonth),
    expectedAmount: r.expectedAmount,
    status: r.status,
  }));

  // Expense records for allocation modal
  const expenseOptions = expenseRecords.map((r) => ({
    id: r.id,
    agentName: r.agent?.company?.name || "-",
    expenseType: r.expenseType,
    targetMonth: formatDate(r.targetMonth),
    expectedAmount: r.expectedAmount,
    status: r.status,
  }));

  // Summary cards
  const totalIncoming = transactions
    .filter((t) => t.direction === "incoming")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOutgoing = transactions
    .filter((t) => t.direction === "outgoing")
    .reduce((sum, t) => sum + t.amount, 0);
  const unmatchedCount = transactions.filter(
    (t) => t.status === "unmatched"
  ).length;
  const matchedCount = transactions.filter(
    (t) => t.status === "matched"
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">入出金履歴管理</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">入金合計</div>
            <div className="text-2xl font-bold text-green-600">
              ¥{totalIncoming.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">出金合計</div>
            <div className="text-2xl font-bold text-red-600">
              ¥{totalOutgoing.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">未消込件数</div>
            <div className="text-2xl font-bold text-gray-600">
              {unmatchedCount}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">消込済件数</div>
            <div className="text-2xl font-bold text-blue-600">
              {matchedCount}件
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>入出金一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentsTable
            data={data}
            revenueOptions={revenueOptions}
            expenseOptions={expenseOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
