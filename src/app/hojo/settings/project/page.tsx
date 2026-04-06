import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync, canViewProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ProjectSettings } from "./project-settings";

export default async function HojoProjectSettingsPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "hojo")) {
    redirect("/hojo/settings/vendors");
  }

  const canEdit = canEditProjectMasterDataSync(user, "hojo");

  const hojoProject = await prisma.masterProject.findFirst({
    where: { code: "hojo" },
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

  if (!hojoProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">プロジェクト設定</h1>
        <p className="text-muted-foreground">
          補助金プロジェクトが見つかりません。
        </p>
      </div>
    );
  }

  const isSystemAdmin = user?.loginId === "admin";

  const approverPermissions = await prisma.staffPermission.findMany({
    where: { projectId: hojoProject.id, canApprove: true },
    select: { staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } } },
  });
  const approverOptions = approverPermissions
    .filter((p) => p.staff.isActive && !p.staff.isSystemUser)
    .map((p) => ({ id: p.staff.id, name: p.staff.name }));

  const projectData = {
    id: hojoProject.id,
    name: hojoProject.name,
    description: hojoProject.description,
    defaultApproverStaffId: hojoProject.defaultApproverStaffId as number | null,
  };

  const operatingCompanyData = hojoProject.operatingCompany
    ? {
        id: hojoProject.operatingCompany.id,
        companyName: hojoProject.operatingCompany.companyName,
        registrationNumber: hojoProject.operatingCompany.registrationNumber,
        postalCode: hojoProject.operatingCompany.postalCode,
        address: hojoProject.operatingCompany.address,
        address2: hojoProject.operatingCompany.address2,
        representativeName: hojoProject.operatingCompany.representativeName,
        phone: hojoProject.operatingCompany.phone,
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
        emails={hojoProject.projectEmails.map((pe) => ({
          email: pe.email.email,
          label: pe.email.label,
          isDefault: pe.isDefault,
        }))}
        bankAccounts={hojoProject.projectBankAccounts.map((pba) => ({
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
