import { prisma } from "@/lib/prisma";
import { getSession, canEdit, isFounder, isSystemAdmin } from "@/lib/auth";
import { PaymentGroupsPageClient } from "./payment-groups-page-client";
import {
  getPaymentGroups,
  getUngroupedExpenseTransactions,
  getUngroupedAllocationItems,
} from "./actions";
import { getExpenseCategories } from "../transactions/actions";
import { getSystemProjectContext } from "@/lib/project-context";
import {
  getPendingInboundInvoices,
  getMatchablePaymentGroups,
} from "./inbound-invoice-actions";

export default async function PaymentGroupsPage() {
  const ctx = await getSystemProjectContext("stp");
  if (!ctx) throw new Error("STPプロジェクトのコンテキストが取得できません");
  const projectId = ctx.projectId;
  const session = await getSession();
  const canEditAccounting = isSystemAdmin(session) || isFounder(session) || canEdit(session.permissions, "accounting");
  const [data, ungroupedTransactions, ungroupedAllocationItems, counterparties, operatingCompanies, expenseCategories, pendingInboundInvoices, matchablePaymentGroups] =
    await Promise.all([
      getPaymentGroups(projectId),
      getUngroupedExpenseTransactions(undefined, projectId),
      getUngroupedAllocationItems(projectId),
      prisma.counterparty.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.operatingCompany.findMany({
        where: { isActive: true },
        orderBy: { id: "asc" },
      }),
      getExpenseCategories(),
      getPendingInboundInvoices(),
      getMatchablePaymentGroups(),
    ]);

  const counterpartyOptions = counterparties.map((c) => ({
    value: String(c.id),
    label: c.displayId ? `${c.displayId} ${c.name}` : c.name,
    isStellaCustomer: c.companyId !== null,
  }));

  const operatingCompanyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  return (
    <PaymentGroupsPageClient
      data={data}
      ungroupedTransactions={ungroupedTransactions}
      ungroupedAllocationItems={ungroupedAllocationItems}
      counterpartyOptions={counterpartyOptions}
      operatingCompanyOptions={operatingCompanyOptions}
      expenseCategories={expenseCategories}
      projectId={projectId}
      canEditAccounting={canEditAccounting}
      pendingInboundInvoices={pendingInboundInvoices}
      matchablePaymentGroups={matchablePaymentGroups}
    />
  );
}
