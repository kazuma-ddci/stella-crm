import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoJournalTable } from "./auto-journal-table";

export default async function AutoJournalPage() {
  const [rules, counterparties, expenseCategories, accounts] =
    await Promise.all([
      prisma.autoJournalRule.findMany({
        where: { deletedAt: null },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
        include: {
          counterparty: { select: { id: true, name: true } },
          expenseCategory: { select: { id: true, name: true } },
          debitAccount: { select: { id: true, code: true, name: true } },
          creditAccount: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.counterparty.findMany({
        where: { deletedAt: null, mergedIntoId: null, isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.expenseCategory.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.account.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
        select: { id: true, code: true, name: true },
      }),
    ]);

  const data = rules.map((rule) => ({
    id: rule.id,
    counterpartyId: rule.counterpartyId ? String(rule.counterpartyId) : "",
    counterpartyLabel: rule.counterparty?.name ?? "",
    transactionType: rule.transactionType ?? "",
    expenseCategoryId: rule.expenseCategoryId
      ? String(rule.expenseCategoryId)
      : "",
    expenseCategoryLabel: rule.expenseCategory?.name ?? "",
    debitAccountId: String(rule.debitAccountId),
    debitAccountLabel: `${rule.debitAccount.code} - ${rule.debitAccount.name}`,
    creditAccountId: String(rule.creditAccountId),
    creditAccountLabel: `${rule.creditAccount.code} - ${rule.creditAccount.name}`,
    priority: rule.priority,
    isActive: rule.isActive,
  }));

  const counterpartyOptions = counterparties.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const expenseCategoryOptions = expenseCategories.map((ec) => ({
    value: String(ec.id),
    label: ec.name,
  }));

  const accountOptions = accounts.map((a) => ({
    value: String(a.id),
    label: `${a.code} - ${a.name}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">自動仕訳ルール</h1>
      <Card>
        <CardHeader>
          <CardTitle>ルール一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AutoJournalTable
            data={data}
            counterpartyOptions={counterpartyOptions}
            expenseCategoryOptions={expenseCategoryOptions}
            accountOptions={accountOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
