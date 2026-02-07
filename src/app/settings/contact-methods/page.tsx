import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactMethodsTable } from "./contact-methods-table";
import { auth } from "@/auth";

export default async function ContactMethodsPage() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEditMasterData = (session?.user as any)?.canEditMasterData === true;

  const contactMethods = await prisma.contactMethod.findMany({
    orderBy: { displayOrder: "asc" },
  });

  const data = contactMethods.map((cm) => ({
    id: cm.id,
    name: cm.name,
    displayOrder: cm.displayOrder,
    isActive: cm.isActive,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">接触方法</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触方法一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactMethodsTable data={data} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
