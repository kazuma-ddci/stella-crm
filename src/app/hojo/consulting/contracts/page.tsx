import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractsTable } from "./contracts-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function ConsultingContractsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [contracts, vendors] = await Promise.all([
    prisma.hojoConsultingContract.findMany({
      where: { deletedAt: null },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const vendorOptions = vendors.map((v) => ({
    value: String(v.id),
    label: v.name,
  }));

  const data = contracts.map((c) => ({
    id: c.id,
    vendorId: String(c.vendorId),
    vendorName: c.vendor.name,
    lineNumber: c.lineNumber ?? "",
    lineName: c.lineName ?? "",
    referralUrl: c.referralUrl ?? "",
    assignedAs: c.assignedAs ?? "",
    consultingStaff: c.consultingStaff ?? "",
    companyName: c.companyName,
    representativeName: c.representativeName ?? "",
    mainContactName: c.mainContactName ?? "",
    customerEmail: c.customerEmail ?? "",
    customerPhone: c.customerPhone ?? "",
    contractDate: c.contractDate?.toISOString().split("T")[0] ?? "",
    contractPlan: c.contractPlan ?? "",
    contractAmount: c.contractAmount ? Number(c.contractAmount) : "",
    serviceType: c.serviceType ?? "",
    caseStatus: c.caseStatus ?? "",
    hasScSales: c.hasScSales,
    hasSubsidyConsulting: c.hasSubsidyConsulting,
    hasBpoSupport: c.hasBpoSupport,
    consultingPlan: c.consultingPlan ?? "",
    successFee: c.successFee ? Number(c.successFee) : "",
    startDate: c.startDate?.toISOString().split("T")[0] ?? "",
    endDate: c.endDate?.toISOString().split("T")[0] ?? "",
    billingStatus: c.billingStatus ?? "",
    paymentStatus: c.paymentStatus ?? "",
    revenueRecordingDate: c.revenueRecordingDate?.toISOString().split("T")[0] ?? "",
    grossProfit: c.grossProfit ? Number(c.grossProfit) : "",
    notes: c.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">コンサル/BPO 契約管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>契約一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractsTable
            data={data}
            canEdit={canEdit}
            vendorOptions={vendorOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
