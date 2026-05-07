import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync, canViewProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ProjectSettings } from "./project-settings";

export default async function AccountingProjectSettingsPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "accounting")) {
    redirect("/accounting/workflow");
  }

  const canEdit = canEditProjectMasterDataSync(user, "accounting");

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

  const approverPermissions = await prisma.staffPermission.findMany({
    where: { projectId: accountingProject.id, canApprove: true },
    select: { staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } } },
  });
  const approverOptions = approverPermissions
    .filter((p) => p.staff.isActive && !p.staff.isSystemUser)
    .map((p) => ({ id: p.staff.id, name: p.staff.name }));

  const projectData = {
    id: accountingProject.id,
    name: accountingProject.name,
    description: accountingProject.description,
    defaultApproverStaffId: accountingProject.defaultApproverStaffId as number | null,
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
        canEdit={canEdit}
        approverOptions={approverOptions}
        emails={accountingProject.projectEmails.map((pe) => ({
          email: pe.email.email,
          label: pe.email.label,
          isDefault: pe.isDefault,
        }))}
        bankAccounts={accountingProject.projectBankAccounts.map((pba) => ({
          bankName: pba.bankAccount.bankName,
          branchName: pba.bankAccount.branchName,
          accountType: pba.bankAccount.accountType,
          accountNumber: pba.bankAccount.accountNumber,
          accountHolderName: pba.bankAccount.accountHolderName,
          isDefault: pba.isDefault,
        }))}
      />
    </div>
  );
}
