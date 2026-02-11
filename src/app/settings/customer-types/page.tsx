import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerTypesTable } from "./customer-types-table";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function CustomerTypesPage() {
  const session = await auth();
  const canEditMasterData = canEditMasterDataSync(session?.user);
  const customerTypes = await prisma.customerType.findMany({
    include: {
      project: true,
    },
    orderBy: [
      { projectId: "asc" },
      { displayOrder: "asc" },
    ],
  });

  const projects = await prisma.masterProject.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  const data = customerTypes.map((ct) => ({
    id: ct.id,
    projectId: String(ct.projectId),
    projectName: ct.project.name,
    name: ct.name,
    displayOrder: ct.displayOrder,
    isActive: ct.isActive,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">顧客種別</h1>
      <Card>
        <CardHeader>
          <CardTitle>顧客種別一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerTypesTable data={data} projectOptions={projectOptions} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
