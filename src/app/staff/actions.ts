"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail } from "@/lib/email";
import { auth } from "@/auth";
import type { UserPermission, OrganizationRole } from "@/types/auth";

const PERM_PREFIX = "perm_";

// 権限レベルの序列（天井バリデーション用）
const PERM_LEVEL_ORDER: Record<string, number> = {
  none: 0,
  view: 1,
  edit: 2,
  manager: 3,
};

/**
 * 現在のユーザーが権限変更可能なプロジェクトと天井レベルのリストを返す
 * - admin/founder → 全PJ、maxLevel="manager"
 * - manager → 自PJのみ、maxLevel="edit"（managerは付与不可）
 * - edit以下 → 空配列（スタッフ管理不可）
 */
export async function getEditableProjects(): Promise<{ code: string; maxLevel: string }[]> {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const permissions = (user?.permissions ?? []) as UserPermission[];
  const loginId = user?.loginId as string | null;
  const organizationRole = (user?.organizationRole ?? "member") as string;

  const isAdminUser = loginId === "admin";
  const isFounder = organizationRole === "founder";

  // admin or founder → 全PJ、maxLevel="manager"
  if (isAdminUser || isFounder) {
    const allProjects = await prisma.masterProject.findMany({
      where: { isActive: true },
      select: { code: true },
    });
    return allProjects.map((p) => ({ code: p.code, maxLevel: "manager" }));
  }

  // manager → 自PJのみ、maxLevel="edit"（managerは付与不可）
  // edit以下 → 空配列
  return permissions
    .filter((p) => p.permissionLevel === "manager")
    .map((p) => ({ code: p.projectCode, maxLevel: "edit" }));
}

/** getEditableProjects からコードのみ抽出（後方互換ヘルパー） */
async function getEditableProjectCodes(): Promise<string[]> {
  const projects = await getEditableProjects();
  return projects.map((p) => p.code);
}

/** 天井バリデーション: 指定されたpermissionLevelがmaxLevel以下であることを検証 */
function validatePermissionCeiling(
  editableProjects: { code: string; maxLevel: string }[],
  data: Record<string, unknown>
) {
  const projectMap = new Map(editableProjects.map((p) => [p.code, p.maxLevel]));

  // プロジェクト権限のチェック
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(PERM_PREFIX) && typeof value === "string" && value !== "none") {
      const projectCode = key.slice(PERM_PREFIX.length);
      const maxLevel = projectMap.get(projectCode);
      if (!maxLevel || (PERM_LEVEL_ORDER[value] ?? 0) > (PERM_LEVEL_ORDER[maxLevel] ?? 0)) {
        throw new Error("自分の権限レベルを超える権限は設定できません");
      }
    }
  }
}

/**
 * プロジェクト権限（perm_xxx キーから動的取得）を構築
 * projectCode → projectId の変換を行う
 */
async function buildPermissions(
  staffId: number,
  data: Record<string, unknown>
) {
  const permissions: { staffId: number; projectId: number; permissionLevel: string }[] = [];

  // プロジェクトコード → ID のマッピングを取得
  const allProjects = await prisma.masterProject.findMany({
    select: { id: true, code: true },
  });
  const codeToId = new Map(allProjects.map((p) => [p.code, p.id]));

  // プロジェクト権限（perm_xxx キーから動的取得）
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(PERM_PREFIX) && typeof value === "string" && value !== "none") {
      const projectCode = key.slice(PERM_PREFIX.length);
      const projectId = codeToId.get(projectCode);
      if (projectId) {
        permissions.push({ staffId, projectId, permissionLevel: value });
      }
    }
  }

  return permissions;
}

export async function addStaff(data: Record<string, unknown>) {
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  const projectIds = (data.projectIds as string[]) || [];
  const editableProjectsList = await getEditableProjects();
  const editableCodes = editableProjectsList.map((p) => p.code);

  // 天井バリデーション
  validatePermissionCeiling(editableProjectsList, data);

  // organizationRole の設定（admin/founderのみ設定可能）
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = session?.user as any;
  const isAdminUser = currentUser?.loginId === "admin";
  const isFounder = currentUser?.organizationRole === "founder";
  const requestedRole = (data.organizationRole as string) || "member";
  // founderの設定はadmin/founderが可能
  const organizationRole = (isAdminUser || isFounder) ? requestedRole : "member";

  const staff = await prisma.masterStaff.create({
    data: {
      name: data.name as string,
      nameKana: (data.nameKana as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      contractType: (data.contractType as string) || null,
      isActive: data.isActive !== false && data.isActive !== "false",
      organizationRole,
    },
  });

  // 役割を割り当て
  if (roleTypeIds.length > 0) {
    await prisma.staffRoleAssignment.createMany({
      data: roleTypeIds.map((roleTypeId) => ({
        staffId: staff.id,
        roleTypeId: Number(roleTypeId),
      })),
    });
  }

  // プロジェクトを割り当て
  if (projectIds.length > 0) {
    await prisma.staffProjectAssignment.createMany({
      data: projectIds.map((projectId) => ({
        staffId: staff.id,
        projectId: Number(projectId),
      })),
    });
  }

  // ファウンダーの場合は権限を設定しない（全権限が組織ロールで付与される）
  if (organizationRole !== "founder" && editableCodes.length > 0) {
    const allPermissions = await buildPermissions(staff.id, data);
    // editableCodes は projectCode ベースなので、projectId→code の逆引きが必要
    const allProjects = await prisma.masterProject.findMany({ select: { id: true, code: true } });
    const idToCode = new Map(allProjects.map((p) => [p.id, p.code]));
    const permissionsToCreate = allPermissions.filter((p) => {
      const code = idToCode.get(p.projectId);
      return code && editableCodes.includes(code);
    });
    if (permissionsToCreate.length > 0) {
      await prisma.staffPermission.createMany({
        data: permissionsToCreate,
      });
    }
  }

  revalidatePath("/staff");
}

export async function updateStaff(id: number, data: Record<string, unknown>) {
  const editableProjectsList = await getEditableProjects();
  const editableCodes = editableProjectsList.map((p) => p.code);

  // 基本フィールドの更新（渡されたフィールドのみ）
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("nameKana" in data) updateData.nameKana = (data.nameKana as string) || null;
  if ("email" in data) updateData.email = (data.email as string) || null;
  if ("phone" in data) updateData.phone = (data.phone as string) || null;
  if ("contractType" in data) updateData.contractType = (data.contractType as string) || null;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  // organizationRole の更新
  if ("organizationRole" in data) {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentUser = session?.user as any;
    const isAdminUser = currentUser?.loginId === "admin";
    const isFounder = currentUser?.organizationRole === "founder";
    const requestedRole = data.organizationRole as string;
    // founderの設定はadmin/founderが可能
    if (isAdminUser || isFounder) {
      updateData.organizationRole = requestedRole;

      // ファウンダーに変更された場合、全プロジェクト権限を削除
      if (requestedRole === "founder") {
        await prisma.staffPermission.deleteMany({
          where: { staffId: id },
        });
      }
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.masterStaff.update({
      where: { id },
      data: updateData,
    });
  }

  // 役割を更新（roleTypeIdsが渡された場合のみ）
  if ("roleTypeIds" in data) {
    const roleTypeIds = (data.roleTypeIds as string[]) || [];
    await prisma.staffRoleAssignment.deleteMany({
      where: { staffId: id },
    });
    if (roleTypeIds.length > 0) {
      await prisma.staffRoleAssignment.createMany({
        data: roleTypeIds.map((roleTypeId) => ({
          staffId: id,
          roleTypeId: Number(roleTypeId),
        })),
      });
    }
  }

  // プロジェクトを更新（projectIdsが渡された場合のみ）
  if ("projectIds" in data) {
    const projectIds = (data.projectIds as string[]) || [];
    await prisma.staffProjectAssignment.deleteMany({
      where: { staffId: id },
    });
    if (projectIds.length > 0) {
      await prisma.staffProjectAssignment.createMany({
        data: projectIds.map((projectId) => ({
          staffId: id,
          projectId: Number(projectId),
        })),
      });
    }
  }

  // ファウンダーの場合は権限更新をスキップ（組織ロールで全権限が付与される）
  const targetRole = (updateData.organizationRole as string) ?? (
    await prisma.masterStaff.findUnique({ where: { id }, select: { organizationRole: true } })
  )?.organizationRole ?? "member";

  // 権限を更新（権限関連キーが渡された場合のみ、かつファウンダーでない場合）
  const hasPermissionChange = Object.keys(data).some((k) => k.startsWith(PERM_PREFIX));

  if (targetRole !== "founder" && hasPermissionChange && editableCodes.length > 0) {
    // editableCodes → editableProjectIds に変換
    const allProjects = await prisma.masterProject.findMany({ select: { id: true, code: true } });
    const codeToId = new Map(allProjects.map((p) => [p.code, p.id]));
    const idToCode = new Map(allProjects.map((p) => [p.id, p.code]));
    const editableProjectIds = editableCodes
      .map((c) => codeToId.get(c))
      .filter((id): id is number => id !== undefined);

    // 既存の権限を取得（送信されなかった権限を保持するため）
    const existingPermissions = await prisma.staffPermission.findMany({
      where: { staffId: id, projectId: { in: editableProjectIds } },
    });

    // 送信されたデータと既存データをマージしたフル権限データを構築
    const mergedData: Record<string, unknown> = { ...data };

    // プロジェクト権限: 送信されていなければ既存値を保持
    for (const code of editableCodes) {
      const permKey = `${PERM_PREFIX}${code}`;
      if (!(permKey in data)) {
        const projectId = codeToId.get(code);
        const existing = existingPermissions.find((p) => p.projectId === projectId);
        mergedData[permKey] = existing?.permissionLevel || "none";
      }
    }

    // 天井バリデーション
    validatePermissionCeiling(editableProjectsList, mergedData);

    // 編集可能なプロジェクトの権限のみ削除
    await prisma.staffPermission.deleteMany({
      where: { staffId: id, projectId: { in: editableProjectIds } },
    });

    // マージ済みデータから権限を再作成
    const allPermissions = await buildPermissions(id, mergedData);
    const permissionsToCreate = allPermissions.filter((p) => {
      const code = idToCode.get(p.projectId);
      return code && editableCodes.includes(code);
    });
    if (permissionsToCreate.length > 0) {
      await prisma.staffPermission.createMany({
        data: permissionsToCreate,
      });
    }
  }

  revalidatePath("/staff");
}

export async function deleteStaff(id: number) {
  await prisma.masterStaff.delete({
    where: { id },
  });
  revalidatePath("/staff");
}

export async function sendStaffInvite(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const staff = await prisma.masterStaff.findUnique({
    where: { id },
  });

  if (!staff) {
    return { success: false, error: "スタッフが見つかりません" };
  }

  if (!staff.email) {
    return { success: false, error: "メールアドレスが設定されていません" };
  }

  // トークン生成（64文字のランダム文字列）
  const token = randomBytes(32).toString("hex");
  // 有効期限は24時間後
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // トークンをDBに保存
  await prisma.masterStaff.update({
    where: { id },
    data: {
      inviteToken: token,
      inviteTokenExpiresAt: expiresAt,
    },
  });

  // メール送信
  const result = await sendStaffInviteEmail(staff.email, staff.name, token);

  if (!result.success) {
    return { success: false, error: result.error || "メール送信に失敗しました" };
  }

  revalidatePath("/staff");
  return { success: true };
}

export async function reorderStaff(orderedIds: number[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.masterStaff.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/staff");
}
