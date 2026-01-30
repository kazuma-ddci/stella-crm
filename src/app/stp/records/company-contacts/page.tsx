import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyContactsTable } from "./company-contacts-table";

export default async function CompanyContactsPage() {
  const [contacts, stpCompanies, contactMethods] = await Promise.all([
    prisma.stpContactHistory.findMany({
      where: {
        stpCompanyId: { not: null },
      },
      include: {
        stpCompany: {
          include: {
            company: true,
          },
        },
        contactMethod: true,
      },
      orderBy: { contactDate: "desc" },
    }),
    prisma.stpCompany.findMany({
      include: {
        company: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.stpContactMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const data = contacts.map((c) => ({
    id: c.id,
    stpCompanyId: c.stpCompanyId,
    companyName: c.stpCompany?.company.name,
    contactDate: c.contactDate.toISOString(),
    contactMethodId: c.contactMethodId,
    contactMethodName: c.contactMethod?.name,
    assignedTo: c.assignedTo,
    meetingMinutes: c.meetingMinutes,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const stpCompanyOptions = stpCompanies.map((c) => ({
    value: String(c.id),
    label: c.company.name,
  }));

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">企業接触履歴</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触履歴一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyContactsTable
            data={data}
            stpCompanyOptions={stpCompanyOptions}
            contactMethodOptions={contactMethodOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
