import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorsTable } from "./vendors-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function VendorsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const vendors = await prisma.hojoVendor.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    accessToken: v.accessToken,
    displayOrder: v.displayOrder,
    isActive: v.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ベンダー</h1>
      <Card>
        <CardHeader>
          <CardTitle>ベンダー一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <VendorsTable data={data} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
