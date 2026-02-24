import { prisma } from "@/lib/prisma";
import { PaymentGroupsPageClient } from "./payment-groups-page-client";
import {
  getPaymentGroups,
  getUngroupedExpenseTransactions,
} from "./actions";
import { getSystemProjectContext } from "@/lib/project-context";

export default async function PaymentGroupsPage() {
  const ctx = await getSystemProjectContext("stp");
  const projectId = ctx?.projectId;
  const [data, ungroupedTransactions, counterparties, operatingCompanies] =
    await Promise.all([
      getPaymentGroups(projectId),
      getUngroupedExpenseTransactions(undefined, projectId),
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

  return (
    <PaymentGroupsPageClient
      data={data}
      ungroupedTransactions={ungroupedTransactions}
      counterpartyOptions={counterpartyOptions}
      operatingCompanyOptions={operatingCompanyOptions}
      projectId={projectId}
    />
  );
}
