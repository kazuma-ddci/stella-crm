import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffTable } from "./staff-table";
import { getEditableProjects } from "./actions";
import { auth } from "@/auth";
import type { UserPermission } from "@/types/auth";

export default async function StaffPage() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = session?.user as any;
  const isAdminUser = currentUser?.loginId === "admin";
  const isFounder = currentUser?.organizationRole === "founder";
  const permissions = (currentUser?.permissions ?? []) as UserPermission[];
  const hasManagerPermission = permissions.some((p) => p.permissionLevel === "manager");
  const hasEditPermission = permissions.some((p) => p.permissionLevel === "edit" || p.permissionLevel === "manager");

  const [staffList, roleTypes, projects, editableProjects] = await Promise.all([
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
        permissions: { include: { project: true } },
      },
    }),
    prisma.staffRoleType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: { projectLinks: true },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    getEditableProjects(),
  ]);

  // プロジェクト権限のカラム情報を構築
  const permissionProjects = projects.map((p) => ({
    code: p.code,
    name: p.name,
  }));

  const data = staffList.map((s) => {
    // 動的にプロジェクト権限を構築
    const projectPermissions: Record<string, string | boolean> = {};
    for (const project of projects) {
      const perm = s.permissions.find((p) => p.project.code === project.code);
      projectPermissions[`perm_${project.code}`] = perm?.permissionLevel || "none";
      projectPermissions[`approve_${project.code}`] = perm?.canApprove ?? false;
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
      projectIds: s.projectAssignments.filter((pa) => pa.project.isActive).map((pa) => String(pa.projectId)),
      projectNames: s.projectAssignments.filter((pa) => pa.project.isActive).map((pa) => pa.project.name).join(", "),
      // 組織ロール
      organizationRole: s.organizationRole,
      organizationRoleLabel: s.organizationRole === "founder" ? "ファウンダー" : "メンバー",
      // 権限
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

  // 役割種別をプロジェクトごとに分類
  const roleTypesByProject: Record<string, { value: string; label: string }[]> = {};

  // _global: プロジェクト紐付けがない役割種別（どのプロジェクトでも表示）
  roleTypesByProject["_global"] = roleTypes
    .filter((rt) => rt.projectLinks.length === 0)
    .map((rt) => ({ value: String(rt.id), label: rt.name }));

  // 各プロジェクトに紐付いた役割種別
  for (const rt of roleTypes) {
    for (const link of rt.projectLinks) {
      const key = String(link.projectId);
      if (!roleTypesByProject[key]) {
        roleTypesByProject[key] = [];
      }
      roleTypesByProject[key].push({ value: String(rt.id), label: rt.name });
    }
  }

  const dynamicOptions = { roleTypesByProject };

  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  // 権限レベルに応じた説明文を生成
  const descriptionItems: { label: string; text: string }[] = [];
  if (isAdminUser) {
    descriptionItems.push(
      { label: "プロジェクト", text: "スタッフが所属するプロジェクトを設定します。所属プロジェクトのデータがサイドバーや一覧に表示されるようになります" },
      { label: "役割", text: "プロジェクト内での業務上の役割（営業、経理など）を設定します。現在は表示用で、権限には影響しません" },
      { label: "組織ロール", text: "「ファウンダー」に設定すると、各プロジェクト権限の設定に関わらず、全プロジェクトの閲覧・編集・スタッフ管理が可能になります。「メンバー」は各プロジェクト権限に従って操作範囲が決まります" },
      { label: "各プロジェクト権限", text: "「メンバー」のスタッフに対して設定します。「閲覧」はデータの参照のみ可能です。「編集」にするとデータの作成・更新・外部ユーザー管理・役割の変更が可能になります。「マネージャー」にすると、さらにそのプロジェクトのスタッフ追加・権限管理（編集権限まで付与可）・有効/無効の切り替え・プロジェクト固有の設定変更が可能になります。ファウンダーの場合は自動的に全権限が付与されるため、個別設定は不要です" },
      { label: "有効", text: "無効にするとそのスタッフはログインできなくなります。データは保持されます" },
      { label: "アカウント", text: "招待メールを送信すると、スタッフにパスワード設定用のリンクが届きます。パスワード設定後にログインできるようになります" },
    );
  } else if (isFounder) {
    descriptionItems.push(
      { label: "プロジェクト", text: "スタッフが所属するプロジェクトを設定します。所属プロジェクトのデータがサイドバーや一覧に表示されるようになります" },
      { label: "役割", text: "プロジェクト内での業務上の役割（営業、経理など）を設定します。現在は表示用で、権限には影響しません" },
      { label: "組織ロール", text: "「ファウンダー」に設定すると、各プロジェクト権限の設定に関わらず、そのスタッフも全プロジェクトの閲覧・編集・スタッフ管理が可能になります。「メンバー」は各プロジェクト権限に従って操作範囲が決まります" },
      { label: "各プロジェクト権限", text: "「メンバー」のスタッフに対して設定します。「閲覧」はデータの参照のみ可能です。「編集」にするとデータの作成・更新・外部ユーザー管理・役割の変更が可能になります。「マネージャー」にすると、さらにそのプロジェクトのスタッフ追加・権限管理（編集権限まで付与可）・有効/無効の切り替え・プロジェクト固有の設定変更が可能になります。ファウンダーの場合は自動的に全権限が付与されるため、個別設定は不要です" },
      { label: "有効", text: "無効にするとそのスタッフはログインできなくなります。データは保持されます" },
      { label: "アカウント", text: "招待メールを送信すると、スタッフにパスワード設定用のリンクが届きます。パスワード設定後にログインできるようになります" },
    );
  } else if (hasManagerPermission) {
    descriptionItems.push(
      { label: "プロジェクト", text: "閲覧のみです。変更はファウンダーが行えます" },
      { label: "役割", text: "閲覧のみです。変更は編集権限以上のスタッフが行えます" },
      { label: "組織ロール", text: "閲覧のみです。変更はファウンダーが行えます" },
      { label: "各プロジェクト権限", text: "担当プロジェクトの「編集」権限まで付与できます。「マネージャー」の任命はファウンダーのみ可能です。担当外のプロジェクト権限は変更できません" },
      { label: "有効", text: "スタッフの有効/無効を切り替えられます。無効にするとそのスタッフはログインできなくなります" },
      { label: "アカウント", text: "招待メールを送信すると、スタッフにパスワード設定用のリンクが届きます。パスワード設定後にログインできるようになります" },
    );
  } else if (hasEditPermission) {
    descriptionItems.push(
      { label: "役割", text: "プロジェクト内での業務上の役割（営業、経理など）を変更できます。現在は表示用で、権限には影響しません" },
    );
  }

  // 説明の概要テキスト
  let descriptionSummary = "";
  if (isAdminUser) {
    descriptionSummary = "スタッフの追加・編集・削除が可能です。";
  } else if (isFounder) {
    descriptionSummary = "スタッフの追加・編集・削除と、全プロジェクトの権限管理が可能です。";
  } else if (hasManagerPermission) {
    descriptionSummary = "担当プロジェクトのスタッフ追加・権限管理が可能です。";
  } else if (hasEditPermission) {
    descriptionSummary = "スタッフ一覧の閲覧と、役割の変更が可能です。スタッフの追加や権限の変更を行うには、マネージャー以上の権限が必要です。";
  } else {
    descriptionSummary = "スタッフ一覧を閲覧できます。スタッフの追加や権限の変更を行うには、マネージャー以上の権限が必要です。";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">スタッフ管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>スタッフ一覧</CardTitle>
          <div className="mt-2 space-y-2">
            <p className="text-sm text-muted-foreground">{descriptionSummary}</p>
            {descriptionItems.length > 0 && (
              <ul className="text-sm text-muted-foreground space-y-1">
                {descriptionItems.map((item) => (
                  <li key={item.label}>
                    <span className="font-medium text-foreground">{item.label}</span>: {item.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <StaffTable
            data={data}
            roleTypeOptions={roleTypeOptions}
            projectOptions={projectOptions}
            permissionProjects={permissionProjects}
            editableProjects={editableProjects}
            canEditOrganizationRole={isAdminUser || isFounder}
            canSetFounder={isAdminUser || isFounder}
            canEditRoleTypes={isAdminUser || isFounder || hasEditPermission}
            canManageStaff={isAdminUser || isFounder || hasManagerPermission}
            dynamicOptions={dynamicOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
