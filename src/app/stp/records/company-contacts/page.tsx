import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyContactsTable } from "./company-contacts-table";
import { getStaffOptionsByField } from "@/lib/staff/get-staff-by-field";

export default async function CompanyContactsPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [contacts, stpCompanies, allStaff, customerTypes] = await Promise.all([
    // 接触履歴（顧客種別「企業」のコンテキストを持つもの）
    prisma.contactHistory.findMany({
      where: {
        deletedAt: null,
        roles: {
          some: {
            customerType: {
              projectId: STP_PROJECT_ID,
              name: "企業",
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
    prisma.stpCompany.findMany({
      include: { company: true },
      orderBy: { company: { id: "desc" } },
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

  // companyIdからstpCompanyIdを取得するマップ
  const companyIdToStpCompanyId: Record<number, number> = {};
  stpCompanies.forEach((sc) => {
    companyIdToStpCompanyId[sc.companyId] = sc.id;
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
      companyCode: c.company.companyCode,
      companyName: c.company.name,
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
      <h1 className="text-2xl font-bold">企業接触履歴</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触履歴一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyContactsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
