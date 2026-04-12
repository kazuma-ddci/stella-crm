import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractTypesTable } from "@/app/settings/contract-types/contract-types-table";
import { auth } from "@/auth";
import {
  canEditProjectMasterDataSync,
  canViewProjectMasterDataSync,
} from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";

/**
 * SLP（公的）専用 契約種別マスタ
 *
 * 既存の汎用 ContractTypesTable を `filterProjectId` 固定モードで埋め込み、
 * 新規追加時にプロジェクトを SLP に自動セットする。
 */
export default async function SlpContractTypesPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "slp")) {
    redirect("/slp/dashboard");
  }

  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true, name: true },
  });

  if (!slpProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">契約種別</h1>
        <p className="text-muted-foreground">SLPプロジェクトが見つかりません。</p>
      </div>
    );
  }

  const canEdit = canEditProjectMasterDataSync(user, "slp");

  const contractTypes = await prisma.contractType.findMany({
    where: { projectId: slpProject.id },
    include: {
      project: true,
      cloudsignTemplates: {
        include: {
          template: { select: { name: true } },
        },
      },
    },
    orderBy: [{ displayOrder: "asc" }],
  });

  const data = contractTypes.map((ct) => ({
    id: ct.id,
    projectId: String(ct.projectId),
    projectName: ct.project.name,
    name: ct.name,
    description: ct.description ?? "",
    displayOrder: ct.displayOrder,
    isActive: ct.isActive,
    templateCount: ct.cloudsignTemplates.length,
    templateNames: ct.cloudsignTemplates.map((l) => l.template.name).join(", "),
  }));

  // SLP専用なのでプロジェクトオプションは公的のみ
  const projectOptions = [
    { value: String(slpProject.id), label: slpProject.name },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">契約種別</h1>
        <span className="text-sm text-muted-foreground">公的（SLP）プロジェクト専用</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>契約種別一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTypesTable
            data={data}
            projectOptions={projectOptions}
            canEdit={canEdit}
            filterProjectId={slpProject.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
