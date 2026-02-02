import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleTypesTable } from "./role-types-table";

export default async function RoleTypesPage() {
  const roleTypes = await prisma.staffRoleType.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = roleTypes.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    displayOrder: r.displayOrder,
    isActive: r.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">役割種別</h1>
      <Card>
        <CardHeader>
          <CardTitle>役割種別一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleTypesTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
