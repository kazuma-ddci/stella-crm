import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreApplicationTable } from "./pre-application-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function PreApplicationPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [records, vendors] = await Promise.all([
    prisma.hojoGrantCustomerPreApplication.findMany({
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

  const data = records.map((r) => ({
    id: r.id,
    vendorId: String(r.vendorId),
    vendorName: r.vendor.name,
    applicantName: r.applicantName ?? "",
    status: r.status ?? "",
    category: r.category ?? "",
    prospectLevel: r.prospectLevel ?? "",
    nextContactDate: r.nextContactDate?.toISOString().split("T")[0] ?? "",
    businessName: r.businessName ?? "",
    salesStaff: r.salesStaff ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">概要案内フェーズ（概要案内～申請完了）</h1>
      <Card>
        <CardHeader>
          <CardTitle>概要案内一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <PreApplicationTable
            data={data}
            canEdit={canEdit}
            vendorOptions={vendorOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
