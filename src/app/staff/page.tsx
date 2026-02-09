import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffTable } from "./staff-table";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";

export default async function StaffPage() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userPermissions = ((session?.user as any)?.permissions ?? []) as UserPermission[];
  const isStellaAdmin = isAdmin(userPermissions, "stella");
  const [staffList, roleTypes, projects] = await Promise.all([
    prisma.masterStaff.findMany({
      where: { isSystemUser: false },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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

  // プロジェクト権限のカラム情報を構築
  const permissionProjects = projects.map((p) => ({
    code: p.code,
    name: p.name,
  }));

  // 現在のユーザーが権限変更可能なプロジェクトコードを算出
  const editableProjectCodes: string[] = [];
  if (isStellaAdmin) {
    // Stella管理者は全プロジェクトの権限を変更可能
    editableProjectCodes.push("stella", ...projects.map((p) => p.code));
  } else {
    // 各プロジェクトの管理者は、そのプロジェクトの権限のみ変更可能
    for (const project of projects) {
      if (userPermissions.some((p) => p.projectCode === project.code && p.permissionLevel === "admin")) {
        editableProjectCodes.push(project.code);
      }
    }
  }

  const data = staffList.map((s) => {
    const stellaPermission = s.permissions.find((p) => p.projectCode === "stella");

    // 動的にプロジェクト権限を構築
    const projectPermissions: Record<string, string> = {};
    for (const project of projects) {
      const perm = s.permissions.find((p) => p.projectCode === project.code);
      projectPermissions[`perm_${project.code}`] = perm?.permissionLevel || "none";
    }

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
      ...projectPermissions,
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
            permissionProjects={permissionProjects}
            editableProjectCodes={editableProjectCodes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
