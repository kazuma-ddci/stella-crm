import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentContactsTable } from "./agent-contacts-table";
import { getStaffOptionsByField } from "@/lib/staff/get-staff-by-field";

export default async function AgentContactsPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [contacts, allStaff, customerTypes] = await Promise.all([
    // 接触履歴（顧客種別「代理店」のコンテキストを持つもの）
    prisma.contactHistory.findMany({
      where: {
        deletedAt: null,
        roles: {
          some: {
            customerType: {
              projectId: STP_PROJECT_ID,
              name: "代理店",
            },
          },
        },
      },
      include: {
        company: true,
        contactMethod: true,
        contactCategory: true,
        roles: {
          include: {
            customerType: {
              include: {
                project: true,
              },
            },
          },
        },
        files: true,
      },
      orderBy: { contactDate: "desc" },
    }),
    prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.customerType.findMany({
      where: { isActive: true },
      include: { project: true },
      orderBy: [
        { project: { displayOrder: "asc" } },
        { displayOrder: "asc" },
      ],
    }),
  ]);

  // 全代理店を取得してcompanyIdから代理店名のマップを作成
  const allAgents = await prisma.stpAgent.findMany({
    include: { company: true },
  });
  const companyIdToAgentName: Record<number, string> = {};
  allAgents.forEach((a) => {
    companyIdToAgentName[a.companyId] = a.company.name;
  });

  // スタッフIDから名前を取得するマップ
  const staffIdToName: Record<string, string> = {};
  allStaff.forEach((s) => {
    staffIdToName[String(s.id)] = s.name;
  });

  // プロジェクトIDごとのスタッフIDセット（担当者フィールドシステム経由）
  const allProjects = await prisma.masterProject.findMany({ where: { isActive: true } });
  const projectIdToStaffIds: Record<number, Set<string>> = {};
  for (const project of allProjects) {
    const staffOpts = await getStaffOptionsByField("CONTACT_HISTORY_STAFF", project.id);
    projectIdToStaffIds[project.id] = new Set(staffOpts.map(s => s.value));
  }

  // customerTypeIdからprojectIdを取得するマップ
  const customerTypeIdToProjectId: Record<number, number> = {};
  customerTypes.forEach((ct) => {
    customerTypeIdToProjectId[ct.id] = ct.projectId;
  });

  const getStaffNames = (assignedTo: string | null): string => {
    if (!assignedTo) return "";
    const ids = assignedTo.split(",").filter(Boolean);
    return ids.map((id) => staffIdToName[id] || id).join(", ");
  };

  const checkStaffMismatch = (assignedTo: string | null, customerTypeIds: number[]): boolean => {
    if (!assignedTo) return false;
    const staffIds = assignedTo.split(",").filter(Boolean);
    const projectIds = new Set<number>();
    customerTypeIds.forEach((ctId) => {
      const projectId = customerTypeIdToProjectId[ctId];
      if (projectId) projectIds.add(projectId);
    });

    return staffIds.some((staffId) => {
      let hasMatch = false;
      projectIds.forEach((projectId) => {
        if (projectIdToStaffIds[projectId]?.has(staffId)) hasMatch = true;
      });
      return !hasMatch;
    });
  };

  const data = contacts.map((c) => {
    const customerTypeIds = c.roles.map((r) => r.customerTypeId);
    return {
      id: c.id,
      agentCompanyCode: c.company.companyCode,
      agentName: companyIdToAgentName[c.companyId] || c.company.name,
      contactDate: c.contactDate.toISOString(),
      contactMethodName: c.contactMethod?.name,
      contactCategoryName: c.contactCategory?.name,
      staffName: getStaffNames(c.assignedTo),
      hasMismatch: checkStaffMismatch(c.assignedTo, customerTypeIds),
      customerParticipants: c.customerParticipants,
      meetingMinutes: c.meetingMinutes,
      note: c.note,
      customerTypeLabels: c.roles.map((r) =>
        `${r.customerType.project.name}:${r.customerType.name}`
      ).join(", "),
      files: c.files.map((f) => ({
        id: f.id,
        filePath: f.filePath,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
      })),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">代理店接触履歴</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触履歴一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentContactsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
