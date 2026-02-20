import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactCategoriesTable } from "./contact-categories-table";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function ContactCategoriesPage() {
  const session = await auth();
  const canEditMasterData = canEditMasterDataSync(session?.user);
  const contactCategories = await prisma.contactCategory.findMany({
    include: {
      project: true,
    },
    orderBy: [
      { project: { displayOrder: "asc" } },
      { displayOrder: "asc" },
    ],
  });

  const projects = await prisma.masterProject.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  const data = contactCategories.map((cc) => ({
    id: cc.id,
    projectId: String(cc.projectId),
    projectName: cc.project.name,
    name: cc.name,
    displayOrder: cc.displayOrder,
    isActive: cc.isActive,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">接触種別</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触種別一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactCategoriesTable data={data} projectOptions={projectOptions} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
