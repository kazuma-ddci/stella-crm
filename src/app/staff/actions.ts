"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail } from "@/lib/email";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";

const PERM_PREFIX = "perm_";

async function checkStellaAdmin(): Promise<boolean> {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions = ((session?.user as any)?.permissions ?? []) as UserPermission[];
  return isAdmin(permissions, "stella");
}

/**
 * Stella権限（固定）+ プロジェクト権限（perm_xxx キーから動的取得）を構築
 */
function buildPermissions(
  staffId: number,
  data: Record<string, unknown>,
  stellaPermission: string
) {
  const permissions: { staffId: number; projectCode: string; permissionLevel: string }[] = [];

  // Stella権限（固定）
  if (stellaPermission && stellaPermission !== "none") {
    permissions.push({ staffId, projectCode: "stella", permissionLevel: stellaPermission });
  }

  // プロジェクト権限（perm_xxx キーから動的取得）
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(PERM_PREFIX) && typeof value === "string" && value !== "none") {
      const projectCode = key.slice(PERM_PREFIX.length);
      permissions.push({ staffId, projectCode, permissionLevel: value });
    }
  }

  return permissions;
}

export async function addStaff(data: Record<string, unknown>) {
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  const projectIds = (data.projectIds as string[]) || [];
  const canEdit = await checkStellaAdmin();
  const stellaPermission = canEdit ? ((data.stellaPermission as string) || "none") : "none";

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

  // 権限を設定（Stella admin のみ変更可能）
  const permissionsToCreate = canEdit ? buildPermissions(staff.id, data, stellaPermission) : [];
  if (permissionsToCreate.length > 0) {
    await prisma.staffPermission.createMany({
      data: permissionsToCreate,
    });
  }

  revalidatePath("/staff");
}

export async function updateStaff(id: number, data: Record<string, unknown>) {
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  const projectIds = (data.projectIds as string[]) || [];
  const canEdit = await checkStellaAdmin();
  const stellaPermission = canEdit ? ((data.stellaPermission as string) || "none") : "none";

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

  // 権限を更新（Stella admin のみ変更可能）
  if (canEdit) {
    await prisma.staffPermission.deleteMany({
      where: { staffId: id },
    });

    const permissionsToCreate = buildPermissions(id, data, stellaPermission);
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
