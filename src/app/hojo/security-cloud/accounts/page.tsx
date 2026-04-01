import { prisma } from "@/lib/prisma";
import { AccountsTable } from "./accounts-table";

export default async function SecurityCloudAccountsPage() {
  const records = await prisma.hojoWholesaleAccount.findMany({
    where: { deletedAt: null },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  });

  // ベンダーごとのNo.計算
  const vendorCounters: Record<number, number> = {};

  const data = records.map((r, idx) => {
    if (!vendorCounters[r.vendorId]) vendorCounters[r.vendorId] = 0;
    vendorCounters[r.vendorId]++;

    return {
      id: r.id,
      rowNo: idx + 1,
      vendorId: r.vendorId,
      vendorName: r.vendor.name,
      vendorNo: vendorCounters[r.vendorId],
      supportProviderName: r.supportProviderName || "",
      companyName: r.companyName || "",
      email: r.email || "",
      softwareSalesContractUrl: r.softwareSalesContractUrl || "",
      recruitmentRound: r.recruitmentRound,
      adoptionDate: r.adoptionDate?.toISOString().slice(0, 10) ?? null,
      issueRequestDate: r.issueRequestDate?.toISOString().slice(0, 10) ?? null,
      accountApprovalDate: r.accountApprovalDate?.toISOString().slice(0, 10) ?? null,
      grantDate: r.grantDate?.toISOString().slice(0, 10) ?? null,
      toolCost: r.toolCost,
      invoiceStatus: r.invoiceStatus || "",
      deletedByVendor: r.deletedByVendor,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">セキュリティクラウド卸管理 — アカウント管理</h1>
      <AccountsTable data={data} />
    </div>
  );
}
