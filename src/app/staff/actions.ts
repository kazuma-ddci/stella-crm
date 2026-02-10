"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail } from "@/lib/email";
import { auth } from "@/auth";
import type { UserPermission } from "@/types/auth";

const PERM_PREFIX = "perm_";

/**
 * 現在のユーザーが権限変更可能なプロジェクトコードのリストを返す
 * - Stella管理者: 全プロジェクト（stella含む）
 * - プロジェクト管理者: そのプロジェクトのみ
 * - それ以外: 空配列
 */
async function getEditableProjectCodes(): Promise<string[]> {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions = ((session?.user as any)?.permissions ?? []) as UserPermission[];

  const isStellaAdmin = permissions.some(
    (p) => p.projectCode === "stella" && p.permissionLevel === "admin"
  );

  if (isStellaAdmin) {
    const allProjects = await prisma.masterProject.findMany({
      where: { isActive: true },
      select: { code: true },
    });
    return ["stella", ...allProjects.map((p) => p.code)];
  }

  // プロジェクト別管理者はそのプロジェクトのみ
  return permissions
    .filter((p) => p.permissionLevel === "admin" && p.projectCode !== "stella")
    .map((p) => p.projectCode);
}

/**
 * Stella権限（固定）+ プロジェクト権限（perm_xxx キーから動的取得）を構築
 * projectCode → projectId の変換を行う
 */
async function buildPermissions(
  staffId: number,
  data: Record<string, unknown>,
  stellaPermission: string
) {
  const permissions: { staffId: number; projectId: number; permissionLevel: string }[] = [];

  // プロジェクトコード → ID のマッピングを取得
  const allProjects = await prisma.masterProject.findMany({
    select: { id: true, code: true },
  });
  const codeToId = new Map(allProjects.map((p) => [p.code, p.id]));

  // Stella権限（固定）
  const stellaId = codeToId.get("stella");
  if (stellaPermission && stellaPermission !== "none" && stellaId) {
    permissions.push({ staffId, projectId: stellaId, permissionLevel: stellaPermission });
  }

  // プロジェクト権限（perm_xxx キーから動的取得、stellaは上で処理済みなのでスキップ）
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(PERM_PREFIX) && typeof value === "string" && value !== "none") {
      const projectCode = key.slice(PERM_PREFIX.length);
      if (projectCode === "stella") continue;
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
  const editableCodes = await getEditableProjectCodes();
  const canEditStella = editableCodes.includes("stella");
  const stellaPermission = canEditStella ? ((data.stellaPermission as string) || "none") : "none";

  const staff = await prisma.masterStaff.create({
    data: {
      name: data.name as string,
      nameKana: (data.nameKana as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      contractType: (data.contractType as string) || null,
      isActive: data.isActive !== false && data.isActive !== "false", // デフォルトで有効
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

  // 権限を設定（編集可能なプロジェクトのみ）
  if (editableCodes.length > 0) {
    const allPermissions = await buildPermissions(staff.id, data, stellaPermission);
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
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  const projectIds = (data.projectIds as string[]) || [];
  const editableCodes = await getEditableProjectCodes();
  const canEditStella = editableCodes.includes("stella");
  const stellaPermission = canEditStella ? ((data.stellaPermission as string) || "none") : "none";

  await prisma.masterStaff.update({
    where: { id },
    data: {
      name: data.name as string,
      nameKana: (data.nameKana as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      contractType: (data.contractType as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });

  // 役割を更新（既存を削除して再作成）
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

  // プロジェクトを更新（既存を削除して再作成）
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

  // 権限を更新（編集可能なプロジェクトのみ変更、それ以外は保持）
  if (editableCodes.length > 0) {
    // editableCodes → editableProjectIds に変換
    const allProjects = await prisma.masterProject.findMany({ select: { id: true, code: true } });
    const codeToId = new Map(allProjects.map((p) => [p.code, p.id]));
    const idToCode = new Map(allProjects.map((p) => [p.id, p.code]));
    const editableProjectIds = editableCodes
      .map((c) => codeToId.get(c))
      .filter((id): id is number => id !== undefined);

    // 編集可能なプロジェクトの権限のみ削除
    await prisma.staffPermission.deleteMany({
      where: { staffId: id, projectId: { in: editableProjectIds } },
    });

    // 編集可能なプロジェクトの権限のみ作成
    const allPermissions = await buildPermissions(id, data, stellaPermission);
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
