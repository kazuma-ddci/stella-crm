import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ProjectSettings } from "./project-settings";

export default async function AccountingProjectSettingsPage() {
  const session = await auth();
  const user = session?.user;

  if (!canEditProjectMasterDataSync(user, "accounting")) {
    redirect("/accounting/dashboard");
  }

  const accountingProject = await prisma.masterProject.findFirst({
    where: { code: "accounting" },
    include: {
      operatingCompany: true,
      projectEmails: {
        include: { email: true },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      },
      projectBankAccounts: {
        include: { bankAccount: true },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      },
    },
  });

  if (!accountingProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">プロジェクト設定</h1>
        <p className="text-muted-foreground">
          経理プロジェクトが見つかりません。
        </p>
      </div>
    );
  }

  const isSystemAdmin = user?.loginId === "admin";

  const projectData = {
    id: accountingProject.id,
    name: accountingProject.name,
    description: accountingProject.description,
  };

  const operatingCompanyData = accountingProject.operatingCompany
    ? {
        id: accountingProject.operatingCompany.id,
        companyName: accountingProject.operatingCompany.companyName,
        registrationNumber: accountingProject.operatingCompany.registrationNumber,
        postalCode: accountingProject.operatingCompany.postalCode,
        address: accountingProject.operatingCompany.address,
        address2: accountingProject.operatingCompany.address2,
        representativeName: accountingProject.operatingCompany.representativeName,
        phone: accountingProject.operatingCompany.phone,
      }
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロジェクト設定</h1>
      <ProjectSettings
        project={projectData}
        operatingCompany={operatingCompanyData}
        isSystemAdmin={isSystemAdmin}
        emails={accountingProject.projectEmails.map((pe) => ({
          email: pe.email.email,
          label: pe.email.label,
          isDefault: pe.isDefault,
        }))}
        bankAccounts={accountingProject.projectBankAccounts.map((pba) => ({
          bankName: pba.bankAccount.bankName,
          branchName: pba.bankAccount.branchName,
          accountNumber: pba.bankAccount.accountNumber,
          accountHolderName: pba.bankAccount.accountHolderName,
          isDefault: pba.isDefault,
        }))}
      />
    </div>
  );
}
