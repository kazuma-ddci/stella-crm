import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisplayViewsTable } from "./display-views-table";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function DisplayViewsPage() {
  const session = await auth();
  const canEditMasterData = canEditMasterDataSync(session?.user);

  const [views, projects] = await Promise.all([
    prisma.displayView.findMany({
      orderBy: { id: "asc" },
      include: { project: true },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const data = views.map((v) => ({
    id: v.id,
    viewKey: v.viewKey,
    viewName: v.viewName,
    projectId: String(v.projectId),
    projectName: v.project.name,
    description: v.description,
    isActive: v.isActive,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">外部ユーザー表示区分</h1>
      <Card>
        <CardHeader>
          <CardTitle>表示区分一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <DisplayViewsTable data={data} canEdit={canEditMasterData} projectOptions={projectOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
