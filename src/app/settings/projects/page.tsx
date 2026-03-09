import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectsTable } from "./projects-table";
import { OperatingCompaniesTable } from "../operating-companies/operating-companies-table";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function ProjectsPage() {
  const session = await auth();
  const canEditMasterData = canEditMasterDataSync(session?.user);
  const isSystemAdmin = session?.user?.loginId === "admin";

  const [projects, operatingCompanies] = await Promise.all([
    prisma.masterProject.findMany({
      include: {
        operatingCompany: true,
        projectEmails: {
          include: { email: { select: { email: true } } },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
        },
        projectBankAccounts: {
          include: { bankAccount: { select: { bankName: true, branchName: true, accountNumber: true } } },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
        },
      },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      include: {
        bankAccounts: {
          where: { deletedAt: null },
          orderBy: { id: "asc" },
        },
        emails: {
          where: { deletedAt: null },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);

  const projectData = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    displayOrder: p.displayOrder,
    isActive: p.isActive,
    operatingCompanyId: p.operatingCompanyId,
    emails: p.projectEmails.map((pe) => ({
      email: pe.email.email,
      isDefault: pe.isDefault,
    })),
    bankAccounts: p.projectBankAccounts.map((pba) => ({
      label: `${pba.bankAccount.bankName} ${pba.bankAccount.branchName} ${pba.bankAccount.accountNumber}`,
      isDefault: pba.isDefault,
    })),
  }));

  const operatingCompanyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  const companyData: Record<string, unknown>[] = operatingCompanies.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    registrationNumber: c.registrationNumber,
    postalCode: c.postalCode,
    address: c.address,
    address2: c.address2,
    representativeName: c.representativeName,
    phone: c.phone,
    abbreviation: c.abbreviation,
    invoicePrefix: c.invoicePrefix,
    paymentMonthOffset: c.paymentMonthOffset != null ? String(c.paymentMonthOffset) : "",
    paymentDay: c.paymentDay != null ? String(c.paymentDay) : "",
    cloudsignClientId: c.cloudsignClientId ? "********" : "",
    logoPath: c.logoPath,
    bankAccounts: c.bankAccounts.map((b) => ({
      id: b.id,
      operatingCompanyId: b.operatingCompanyId,
      bankName: b.bankName,
      bankCode: b.bankCode,
      branchName: b.branchName,
      branchCode: b.branchCode,
      accountNumber: b.accountNumber,
      accountHolderName: b.accountHolderName,
      note: b.note,
      isDefault: b.isDefault,
    })),
    emails: c.emails.map((e) => ({
      id: e.id,
      operatingCompanyId: e.operatingCompanyId,
      email: e.email,
      label: e.label,
      smtpHost: e.smtpHost,
      smtpPort: e.smtpPort,
      smtpUser: e.smtpUser,
      hasSmtpPass: !!e.smtpPass,
      imapHost: e.imapHost,
      imapPort: e.imapPort,
      imapUser: e.imapUser,
      hasImapPass: !!e.imapPass,
      enableInbound: e.enableInbound,
      isDefault: e.isDefault,
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">組織・プロジェクト管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>運営法人</CardTitle>
        </CardHeader>
        <CardContent>
          <OperatingCompaniesTable data={companyData} canEdit={canEditMasterData} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>プロジェクト</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectsTable
            data={projectData}
            operatingCompanyOptions={operatingCompanyOptions}
            canEdit={canEditMasterData}
            isSystemAdmin={isSystemAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
