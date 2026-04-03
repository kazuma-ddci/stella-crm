import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostApplicationTable } from "./post-application-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function PostApplicationPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [records, vendors] = await Promise.all([
    prisma.hojoGrantCustomerPostApplication.findMany({
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
    grantApplicationNumber: r.grantApplicationNumber ?? "",
    subsidyStatus: r.subsidyStatus ?? "",
    applicationCompletedDate: r.applicationCompletedDate?.toISOString().split("T")[0] ?? "",
    hasLoan: r.hasLoan,
    completedDate: r.completedDate?.toISOString().split("T")[0] ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">交付申請フェーズ（交付申請～完了）</h1>
      <Card>
        <CardHeader>
          <CardTitle>交付申請一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <PostApplicationTable
            data={data}
            canEdit={canEdit}
            vendorOptions={vendorOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
