import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatingCompaniesTable } from "./operating-companies-table";
import { auth } from "@/auth";

export default async function OperatingCompaniesPage() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEditMasterData = (session?.user as any)?.canEditMasterData === true;

  const companies = await prisma.operatingCompany.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  const data: Record<string, unknown>[] = companies.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    registrationNumber: c.registrationNumber,
    postalCode: c.postalCode,
    address: c.address,
    representativeName: c.representativeName,
    phone: c.phone,
    bankInfo: c.bankInfo,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">運営法人マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>運営法人一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <OperatingCompaniesTable data={data} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
    </div>
  );
}
