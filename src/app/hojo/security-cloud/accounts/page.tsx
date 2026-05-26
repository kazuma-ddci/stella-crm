import { prisma } from "@/lib/prisma";
import { AccountsTable } from "./accounts-table";

export default async function SecurityCloudAccountsPage() {
  const records = await prisma.hojoWholesaleAccount.findMany({
    where: { deletedAt: null },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  });

  const data = records.map((r, idx) => {
    return {
      id: r.id,
      rowNo: idx + 1,
      vendorId: r.vendorId,
      vendorName: r.vendor.name,
      applicantType: r.applicantType || "",
      companyName: r.companyName || "",
      email: r.email || "",
      softwareSalesContractUrl: r.softwareSalesContractUrl || "",
      loanUsage: r.loanUsage || "",
      grantUsage: r.grantUsage || "",
      subsidyTargetAmountTaxIncluded: r.subsidyTargetAmountTaxIncluded,
      applicationAmount: r.applicationAmount,
      recruitmentRound: r.recruitmentRound,
      adoptionDate: r.adoptionDate?.toISOString().slice(0, 10) ?? null,
      issueRequestDate: r.issueRequestDate?.toISOString().slice(0, 10) ?? null,
      accountApprovalDate: r.accountApprovalDate?.toISOString().slice(0, 10) ?? null,
      grantDate: r.grantDate?.toISOString().slice(0, 10) ?? null,
      deletedByVendor: r.deletedByVendor,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">セキュリティクラウド卸管理 — 顧客リスト</h1>
      <AccountsTable data={data} />
    </div>
  );
}
