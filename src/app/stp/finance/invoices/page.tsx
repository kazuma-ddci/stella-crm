import { prisma } from "@/lib/prisma";
import { getInvoiceGroups, getUngroupedTransactions, getUngroupedAllocationItems, getUnconfirmedTransactions } from "./actions";
import { InvoicesPageClient } from "./invoices-page-client";
import { getExpenseCategories } from "../transactions/actions";
import { getSystemProjectContext } from "@/lib/project-context";

export default async function InvoiceGroupsPage() {
  const ctx = await getSystemProjectContext("stp");
  if (!ctx) throw new Error("STPプロジェクトのコンテキストが取得できません");
  const projectId = ctx.projectId;
  const [data, ungroupedTransactions, ungroupedAllocationItems, counterparties, operatingCompanies, expenseCategories, unconfirmedTransactions] =
    await Promise.all([
      getInvoiceGroups(projectId),
      getUngroupedTransactions(undefined, projectId),
      getUngroupedAllocationItems(projectId),
      prisma.counterparty.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.operatingCompany.findMany({
        where: { isActive: true },
        include: { bankAccounts: { where: { deletedAt: null } } },
        orderBy: { id: "asc" },
      }),
      getExpenseCategories(),
      getUnconfirmedTransactions(projectId),
    ]);

  const counterpartyOptions = counterparties.map((c) => ({
    value: String(c.id),
    label: c.displayId ? `${c.displayId} ${c.name}` : c.name,
  }));

  const operatingCompanyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  // 運営法人IDごとの銀行口座マップ
  const bankAccountsByCompany: Record<
    string,
    { value: string; label: string }[]
  > = {};
  for (const company of operatingCompanies) {
    bankAccountsByCompany[String(company.id)] = company.bankAccounts.map(
      (ba) => ({
        value: String(ba.id),
        label: `${ba.bankName} ${ba.branchName} ${ba.accountNumber}`,
      })
    );
  }

  return (
    <InvoicesPageClient
      data={data}
      ungroupedTransactions={ungroupedTransactions}
      ungroupedAllocationItems={ungroupedAllocationItems}
      counterpartyOptions={counterpartyOptions}
      operatingCompanyOptions={operatingCompanyOptions}
      bankAccountsByCompany={bankAccountsByCompany}
      expenseCategories={expenseCategories}
      unconfirmedTransactions={unconfirmedTransactions}
      projectId={projectId}
    />
  );
}
