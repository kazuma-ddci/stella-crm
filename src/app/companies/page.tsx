import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompaniesTable } from "./companies-table";
import type { MasterStellaCompany } from "@prisma/client";

export default async function CompaniesPage() {
  const companies = await prisma.masterStellaCompany.findMany({
    orderBy: { id: "asc" },
  });

  const data = companies.map((c: MasterStellaCompany) => ({
    id: c.id,
    companyCode: c.companyCode,
    name: c.name,
    contactPerson: c.contactPerson,
    email: c.email,
    phone: c.phone,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stella全顧客マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>顧客一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CompaniesTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
