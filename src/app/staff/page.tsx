import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffTable } from "./staff-table";

export default async function StaffPage() {
  const [staffList, roleTypes, projects] = await Promise.all([
    prisma.masterStaff.findMany({
      orderBy: { id: "asc" },
      include: {
        roleAssignments: {
          include: {
            roleType: true,
          },
        },
        projectAssignments: {
          include: {
            project: true,
          },
        },
        permissions: true,
      },
    }),
    prisma.staffRoleType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const data = staffList.map((s) => {
    const stellaPermission = s.permissions.find((p) => p.projectCode === "stella");
    const stpPermission = s.permissions.find((p) => p.projectCode === "stp");

    return {
      id: s.id,
      name: s.name,
      nameKana: s.nameKana,
      email: s.email,
      phone: s.phone,
      contractType: s.contractType,
      isActive: s.isActive,
      // 役割（複数選択）
      roleTypeIds: s.roleAssignments.map((ra) => String(ra.roleTypeId)),
      roleTypeNames: s.roleAssignments.map((ra) => ra.roleType.name).join(", "),
      // プロジェクト（複数選択）
      projectIds: s.projectAssignments.map((pa) => String(pa.projectId)),
      projectNames: s.projectAssignments.map((pa) => pa.project.name).join(", "),
      // 権限
      stellaPermission: stellaPermission?.permissionLevel || "none",
      stpPermission: stpPermission?.permissionLevel || "none",
      // 招待状態
      hasPassword: !!s.passwordHash,
      hasInviteToken: !!s.inviteToken,
      inviteTokenExpired: s.inviteTokenExpiresAt ? s.inviteTokenExpiresAt < new Date() : false,
    };
  });

  const roleTypeOptions = roleTypes.map((rt) => ({
    value: String(rt.id),
    label: rt.name,
  }));

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">スタッフ管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>スタッフ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffTable
            data={data}
            roleTypeOptions={roleTypeOptions}
            projectOptions={projectOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
