import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactMethodsTable } from "./contact-methods-table";

export default async function ContactMethodsPage() {
  const methods = await prisma.contactMethod.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = methods.map((m) => ({
    id: m.id,
    name: m.name,
    displayOrder: m.displayOrder,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">接触方法設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触方法一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactMethodsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
