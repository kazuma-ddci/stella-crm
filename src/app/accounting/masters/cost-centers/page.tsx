import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CostCentersTable } from "./cost-centers-table";

export default async function CostCentersPage() {
  const [costCenters, projects] = await Promise.all([
    prisma.costCenter.findMany({
      where: { deletedAt: null },
      orderBy: [{ id: "asc" }],
      include: { project: { select: { id: true, code: true, name: true } } },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const data = costCenters.map((cc) => ({
    id: cc.id,
    name: cc.name,
    projectId: cc.projectId ? String(cc.projectId) : "",
    projectLabel: cc.project
      ? `${cc.project.code} - ${cc.project.name}`
      : "",
    isActive: cc.isActive,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: `${p.code} - ${p.name}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">経理用プロジェクト管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>経理専用プロジェクト一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CostCentersTable data={data} projectOptions={projectOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
