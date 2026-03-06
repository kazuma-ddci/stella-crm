import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractTypesTable } from "./contract-types-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function ContractTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectCode } = await searchParams;
  const session = await auth();
  const canEditMasterData = canEditProjectMasterDataSync(session?.user);

  // プロジェクトコードからIDを解決
  let filterProjectId: number | undefined;
  if (projectCode) {
    const proj = await prisma.masterProject.findFirst({
      where: { code: projectCode },
    });
    if (proj) {
      filterProjectId = proj.id;
    }
  }

  const contractTypes = await prisma.contractType.findMany({
    include: {
      project: true,
    },
    where: filterProjectId ? { projectId: filterProjectId } : undefined,
    orderBy: [
      { projectId: "asc" },
      { displayOrder: "asc" },
    ],
  });

  const projects = await prisma.masterProject.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  const data = contractTypes.map((ct) => ({
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
      <h1 className="text-2xl font-bold">契約種別</h1>
      <Card>
        <CardHeader>
          <CardTitle>契約種別一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTypesTable data={data} projectOptions={projectOptions} canEdit={canEditMasterData} filterProjectId={filterProjectId} />
        </CardContent>
      </Card>
    </div>
  );
}
