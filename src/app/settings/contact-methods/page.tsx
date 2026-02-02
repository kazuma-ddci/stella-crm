import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactMethodsTable } from "./contact-methods-table";

export default async function ContactMethodsPage() {
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
      <h1 className="text-2xl font-bold">連絡手段</h1>
      <Card>
        <CardHeader>
          <CardTitle>連絡手段一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactMethodsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
