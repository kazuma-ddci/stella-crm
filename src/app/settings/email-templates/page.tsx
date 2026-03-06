import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailTemplatesTable } from "./email-templates-table";

type Props = {
  searchParams: Promise<{ project?: string }>;
};

export default async function EmailTemplatesPage({ searchParams }: Props) {
  const params = await searchParams;
  const projectFilter = params.project;

  // プロジェクトフィルタの解決: code → id
  const filterProject = projectFilter
    ? await prisma.masterProject.findFirst({ where: { code: projectFilter, isActive: true } })
    : null;

  const [invoiceTemplates, operatingCompanies, projects] = await Promise.all([
    prisma.invoiceTemplate.findMany({
      where: {
        deletedAt: null,
        ...(filterProject
          ? { OR: [{ projectId: filterProject.id }, { projectId: null }] }
          : {}),
      },
      orderBy: [{ operatingCompanyId: "asc" }, { templateType: "asc" }, { id: "asc" }],
      include: {
        operatingCompany: { select: { id: true, companyName: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, companyName: true },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const data = invoiceTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    templateType: t.templateType,
    operatingCompanyId: String(t.operatingCompanyId),
    operatingCompanyLabel: t.operatingCompany.companyName,
    projectId: t.projectId ? String(t.projectId) : "",
    projectLabel: t.project?.name ?? "",
    emailSubjectTemplate: t.emailSubjectTemplate,
    emailBodyTemplate: t.emailBodyTemplate,
    isDefault: t.isDefault,
  }));

  const companyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {filterProject ? `${filterProject.name} のメールテンプレート管理` : "メールテンプレート管理"}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>テンプレート一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailTemplatesTable
            data={data}
            companyOptions={companyOptions}
            projectOptions={projectOptions}
            filterProjectId={filterProject ? String(filterProject.id) : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
