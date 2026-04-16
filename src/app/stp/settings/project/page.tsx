import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync, canViewProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ProjectSettings } from "./project-settings";

export default async function StpProjectSettingsPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "stp")) {
    redirect("/stp/dashboard");
  }

  const canEdit = canEditProjectMasterDataSync(user, "stp");

  const stpProject = await prisma.masterProject.findFirst({
    where: { code: "stp" },
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

  if (!stpProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">プロジェクト設定</h1>
        <p className="text-muted-foreground">
          STPプロジェクトが見つかりません。
        </p>
      </div>
    );
  }

  const isSystemAdmin = user?.loginId === "admin";

  // デフォルト承認者候補（ファウンダーのみ選択可能）
  const founderStaff = await prisma.masterStaff.findMany({
    where: {
      organizationRole: "founder",
      isActive: true,
      isSystemUser: false,
    },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  const approverOptions = founderStaff.map((s) => ({ id: s.id, name: s.name }));

  const projectData = {
    id: stpProject.id,
    name: stpProject.name,
    description: stpProject.description,
    defaultApproverStaffId: stpProject.defaultApproverStaffId as number | null,
  };

  const operatingCompanyData = stpProject.operatingCompany
    ? {
        id: stpProject.operatingCompany.id,
        companyName: stpProject.operatingCompany.companyName,
        registrationNumber: stpProject.operatingCompany.registrationNumber,
        postalCode: stpProject.operatingCompany.postalCode,
        address: stpProject.operatingCompany.address,
        address2: stpProject.operatingCompany.address2,
        representativeName: stpProject.operatingCompany.representativeName,
        phone: stpProject.operatingCompany.phone,
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
        emails={stpProject.projectEmails.map((pe) => ({
          email: pe.email.email,
          label: pe.email.label,
          isDefault: pe.isDefault,
        }))}
        bankAccounts={stpProject.projectBankAccounts.map((pba) => ({
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
