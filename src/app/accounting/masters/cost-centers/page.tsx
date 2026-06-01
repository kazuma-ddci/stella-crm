import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureCostCentersForActiveProjects } from "@/lib/accounting/cost-centers";
import { CostCentersTable } from "./cost-centers-table";
import { OperatingCompaniesTable } from "@/app/settings/operating-companies/operating-companies-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync, canViewProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";

export default async function CostCentersPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "accounting")) {
    redirect("/accounting/workflow");
  }

  const canEdit = canEditProjectMasterDataSync(user, "accounting");
  await ensureCostCentersForActiveProjects();

  const [costCenters, projects, operatingCompanies] = await Promise.all([
    prisma.costCenter.findMany({
      where: { deletedAt: null },
      orderBy: [{ id: "asc" }],
      include: {
        operatingCompany: { select: { id: true, companyName: true } },
        costCenterBankAccounts: {
          include: {
            bankAccount: {
              select: {
                bankName: true,
                branchName: true,
                accountType: true,
                accountNumber: true,
              },
            },
          },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            operatingCompanyId: true,
            operatingCompany: { select: { id: true, companyName: true } },
            projectBankAccounts: {
              include: {
                bankAccount: {
                  select: {
                    bankName: true,
                    branchName: true,
                    accountType: true,
                    accountNumber: true,
                  },
                },
              },
              orderBy: [{ isDefault: "desc" }, { id: "asc" }],
            },
          },
        },
      },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, code: true, name: true },
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

  const data = costCenters.map((cc) => ({
    id: cc.id,
    name: cc.name,
    projectId: cc.projectId ? String(cc.projectId) : "",
    projectLabel: cc.project
      ? `${cc.project.code} - ${cc.project.name}`
      : "",
    hasCrmProject: !!cc.projectId,
    operatingCompanyId: cc.projectId ? "" : cc.operatingCompanyId ? String(cc.operatingCompanyId) : "",
    effectiveOperatingCompanyLabel: cc.projectId
      ? cc.project?.operatingCompany?.companyName ?? "（未設定）"
      : cc.operatingCompany?.companyName ?? "（未設定）",
    bankAccounts: (cc.projectId
      ? cc.project?.projectBankAccounts.map((pba) => ({
          label: `${pba.bankAccount.bankName} ${pba.bankAccount.branchName} ${pba.bankAccount.accountType} ${pba.bankAccount.accountNumber}`,
          isDefault: pba.isDefault,
        })) ?? []
      : cc.costCenterBankAccounts.map((ccba) => ({
          label: `${ccba.bankAccount.bankName} ${ccba.bankAccount.branchName} ${ccba.bankAccount.accountType} ${ccba.bankAccount.accountNumber}`,
          isDefault: ccba.isDefault,
        }))),
    isActive: cc.isActive,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: `${p.code} - ${p.name}`,
  }));

  const operatingCompanyOptions = operatingCompanies.map((company) => ({
    value: String(company.id),
    label: company.companyName,
  }));

  const companyData: Record<string, unknown>[] = operatingCompanies.map((company) => ({
    id: company.id,
    companyName: company.companyName,
    registrationNumber: company.registrationNumber,
    postalCode: company.postalCode,
    address: company.address,
    address2: company.address2,
    representativeName: company.representativeName,
    phone: company.phone,
    abbreviation: company.abbreviation,
    invoicePrefix: company.invoicePrefix,
    fiscalClosingMonth: String(company.fiscalClosingMonth ?? 3),
    paymentMonthOffset: company.paymentMonthOffset != null ? String(company.paymentMonthOffset) : "",
    paymentDay: company.paymentDay != null ? String(company.paymentDay) : "",
    cloudsignClientId: company.cloudsignClientId ? "********" : "",
    cloudsignRegisteredEmail: company.cloudsignRegisteredEmail || "",
    logoPath: company.logoPath,
    bankAccounts: company.bankAccounts.map((account) => ({
      id: account.id,
      operatingCompanyId: account.operatingCompanyId,
      bankName: account.bankName,
      bankCode: account.bankCode,
      branchName: account.branchName,
      branchCode: account.branchCode,
      accountType: account.accountType,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountHolderName,
      note: account.note,
      isDefault: account.isDefault,
    })),
    emails: company.emails.map((email) => ({
      id: email.id,
      operatingCompanyId: email.operatingCompanyId,
      email: email.email,
      label: email.label,
      smtpHost: email.smtpHost,
      smtpPort: email.smtpPort,
      smtpUser: email.smtpUser,
      hasSmtpPass: !!email.smtpPass,
      imapHost: email.imapHost,
      imapPort: email.imapPort,
      imapUser: email.imapUser,
      hasImapPass: !!email.imapPass,
      enableInbound: email.enableInbound,
      isDefault: email.isDefault,
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">経理用プロジェクト管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>運営法人</CardTitle>
        </CardHeader>
        <CardContent>
          <OperatingCompaniesTable data={companyData} canEdit={canEdit} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>経理専用プロジェクト一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CostCentersTable
            data={data}
            projectOptions={projectOptions}
            operatingCompanyOptions={operatingCompanyOptions}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
