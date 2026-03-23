import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync, canViewProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ProjectSettings } from "./project-settings";

export default async function SlpProjectSettingsPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "slp")) {
    redirect("/slp/dashboard");
  }

  const canEdit = canEditProjectMasterDataSync(user, "slp");

  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
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

  // SLPプロジェクトの契約種別一覧を取得
  const contractTypes = slpProject
    ? await prisma.contractType.findMany({
        where: { projectId: slpProject.id, isActive: true },
        include: {
          cloudsignTemplates: {
            include: { template: { select: { name: true, cloudsignTemplateId: true } } },
          },
        },
        orderBy: { displayOrder: "asc" },
      })
    : [];

  if (!slpProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">プロジェクト設定</h1>
        <p className="text-muted-foreground">
          SLPプロジェクトが見つかりません。
        </p>
      </div>
    );
  }

  const isSystemAdmin = user?.loginId === "admin";

  const projectData = {
    id: slpProject.id,
    name: slpProject.name,
    description: slpProject.description,
  };

  const operatingCompanyData = slpProject.operatingCompany
    ? {
        id: slpProject.operatingCompany.id,
        companyName: slpProject.operatingCompany.companyName,
        registrationNumber: slpProject.operatingCompany.registrationNumber,
        postalCode: slpProject.operatingCompany.postalCode,
        address: slpProject.operatingCompany.address,
        address2: slpProject.operatingCompany.address2,
        representativeName: slpProject.operatingCompany.representativeName,
        phone: slpProject.operatingCompany.phone,
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
        contractTypes={contractTypes.map((ct) => ({
          id: ct.id,
          name: ct.name,
          templateNames: ct.cloudsignTemplates.map((t) => t.template.name),
        }))}
        currentMemberContractTypeId={slpProject.slpMemberContractTypeId}
        autoSendContract={slpProject.autoSendContract}
        emails={slpProject.projectEmails.map((pe) => ({
          email: pe.email.email,
          label: pe.email.label,
          isDefault: pe.isDefault,
        }))}
        bankAccounts={slpProject.projectBankAccounts.map((pba) => ({
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
