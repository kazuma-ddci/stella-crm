import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectsTable } from "./projects-table";

export default async function ProjectsPage() {
  const projects = await prisma.masterProject.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    displayOrder: p.displayOrder,
    isActive: p.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロジェクト管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>プロジェクト一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
