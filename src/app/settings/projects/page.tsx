import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectsTable } from "./projects-table";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function ProjectsPage() {
  const session = await auth();
  const canEditMasterData = canEditMasterDataSync(session?.user);
  const [projects, operatingCompanies] = await Promise.all([
    prisma.masterProject.findMany({
      include: { operatingCompany: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const data = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    displayOrder: p.displayOrder,
    isActive: p.isActive,
    operatingCompanyId: p.operatingCompanyId,
  }));

  const operatingCompanyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロジェクト管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>プロジェクト一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectsTable
            data={data}
            operatingCompanyOptions={operatingCompanyOptions}
            canEdit={canEditMasterData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
