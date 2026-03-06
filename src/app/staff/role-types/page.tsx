import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleTypesTable } from "./role-types-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function RoleTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await auth();
  const canEditMasterData = canEditProjectMasterDataSync(session?.user);
  const { project } = await searchParams;

  // プロジェクトコードからIDを取得
  let filterProjectId: number | undefined;
  if (project) {
    const masterProject = await prisma.masterProject.findUnique({
      where: { code: project },
      select: { id: true },
    });
    if (masterProject) {
      filterProjectId = masterProject.id;
    }
  }

  const [roleTypes, projects] = await Promise.all([
    prisma.staffRoleType.findMany({
      where: filterProjectId
        ? { projectLinks: { some: { projectId: filterProjectId } } }
        : undefined,
      orderBy: { displayOrder: "asc" },
      include: {
        projectLinks: true,
      },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const data = roleTypes.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    displayOrder: r.displayOrder,
    isActive: r.isActive,
    projectIds: r.projectLinks.map((pl) => String(pl.projectId)),
    projectNames: r.projectLinks
      .map((pl) => projects.find((p) => p.id === pl.projectId)?.name)
      .filter(Boolean)
      .join(", "),
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">役割種別</h1>
      <Card>
        <CardHeader>
          <CardTitle>役割種別一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleTypesTable
            data={data}
            canEdit={canEditMasterData}
            projectOptions={projectOptions}
            filterProjectId={filterProjectId ? String(filterProjectId) : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
