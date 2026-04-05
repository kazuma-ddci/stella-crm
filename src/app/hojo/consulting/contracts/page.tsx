import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractListTable } from "./contracts-table";

export default async function ConsultingContractsPage() {
  const contracts = await prisma.hojoConsultingContract.findMany({
    where: { deletedAt: null },
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: { id: "desc" },
  });

  const data = contracts.map((c) => ({
    id: c.id,
    vendorId: c.vendorId,
    vendorName: c.vendor.name,
    companyName: c.companyName,
    representativeName: c.representativeName ?? "",
    mainContactName: c.mainContactName ?? "",
    contractDate: c.contractDate?.toISOString().split("T")[0] ?? "",
    contractPlan: c.contractPlan ?? "",
    contractAmount: c.contractAmount ? Number(c.contractAmount) : null,
    serviceType: c.serviceType ?? "",
    caseStatus: c.caseStatus ?? "",
    hasScSales: c.hasScSales,
    hasSubsidyConsulting: c.hasSubsidyConsulting,
    hasBpoSupport: c.hasBpoSupport,
    consultingPlan: c.consultingPlan ?? "",
    startDate: c.startDate?.toISOString().split("T")[0] ?? "",
    endDate: c.endDate?.toISOString().split("T")[0] ?? "",
    billingStatus: c.billingStatus ?? "",
    paymentStatus: c.paymentStatus ?? "",
    notes: c.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約状況一覧</h1>
      <p className="text-sm text-gray-500">全ベンダーの契約状況を一覧で確認できます。編集は各ベンダーの詳細ページから行ってください。</p>
      <Card>
        <CardHeader>
          <CardTitle>契約一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractListTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
