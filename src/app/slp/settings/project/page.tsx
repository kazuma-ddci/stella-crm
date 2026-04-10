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

  // SLPプロジェクトの契約種別一覧（追加モーダル表示用）
  const contractTypes = slpProject
    ? await prisma.contractType.findMany({
        where: { projectId: slpProject.id, isActive: true },
        orderBy: { displayOrder: "asc" },
      })
    : [];

  // SLP契約種別に紐付いた CloudSign テンプレート一覧（自動送付契約書の選択肢）
  // B案: 何らかのSLP契約種別に紐付いているテンプレートのみ
  const memberTemplates = slpProject
    ? await prisma.cloudSignTemplate.findMany({
        where: {
          isActive: true,
          contractTypes: {
            some: {
              contractType: {
                projectId: slpProject.id,
                isActive: true,
              },
            },
          },
        },
        include: {
          contractTypes: {
            include: {
              contractType: { select: { name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
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

  const approverPermissions = await prisma.staffPermission.findMany({
    where: { projectId: slpProject.id, canApprove: true },
    select: { staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } } },
  });
  const approverOptions = approverPermissions
    .filter((p) => p.staff.isActive && !p.staff.isSystemUser)
    .map((p) => ({ id: p.staff.id, name: p.staff.name }));

  const projectData = {
    id: slpProject.id,
    name: slpProject.name,
    description: slpProject.description,
    defaultApproverStaffId: slpProject.defaultApproverStaffId as number | null,
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
        approverOptions={approverOptions}
        contractTypes={contractTypes.map((ct) => ({
          id: ct.id,
          name: ct.name,
        }))}
        memberTemplates={memberTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          cloudsignTemplateId: t.cloudsignTemplateId,
          contractTypeNames: t.contractTypes.map((ct) => ct.contractType.name),
        }))}
        currentMemberCloudSignTemplateId={slpProject.slpMemberCloudSignTemplateId}
        autoSendContract={slpProject.autoSendContract}
        slpForm5AutoSendOnLink={slpProject.slpForm5AutoSendOnLink}
        emails={slpProject.projectEmails.map((pe) => ({
          email: pe.email.email,
          label: pe.email.label,
          isDefault: pe.isDefault,
        }))}
        bankAccounts={slpProject.projectBankAccounts.map((pba) => ({
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
