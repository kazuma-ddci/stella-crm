import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailTemplatesTable } from "./email-templates-table";

export default async function EmailTemplatesPage() {
  const [invoiceTemplates, operatingCompanies] = await Promise.all([
    prisma.invoiceTemplate.findMany({
      where: { deletedAt: null },
      orderBy: [{ operatingCompanyId: "asc" }, { templateType: "asc" }, { id: "asc" }],
      include: {
        operatingCompany: { select: { id: true, companyName: true } },
      },
    }),
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, companyName: true },
    }),
  ]);

  const data = invoiceTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    templateType: t.templateType,
    operatingCompanyId: String(t.operatingCompanyId),
    operatingCompanyLabel: t.operatingCompany.companyName,
    emailSubjectTemplate: t.emailSubjectTemplate,
    emailBodyTemplate: t.emailBodyTemplate,
    isDefault: t.isDefault,
  }));

  const companyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">メールテンプレート管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>テンプレート一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailTemplatesTable data={data} companyOptions={companyOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
