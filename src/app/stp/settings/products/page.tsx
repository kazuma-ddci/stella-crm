import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductsTable } from "./products-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function ProductsPage() {
  const session = await auth();
  const canEditMasterData = canEditProjectMasterDataSync(session?.user, "stp");

  const products = await prisma.stpProduct.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = products.map((p) => ({
    id: p.id,
    name: p.name,
    displayOrder: p.displayOrder,
    isActive: p.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">商材設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>商材一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductsTable data={data} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
