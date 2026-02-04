"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail } from "@/lib/email";

export async function addStaff(data: Record<string, unknown>) {
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  const projectIds = (data.projectIds as string[]) || [];
  const stellaPermission = (data.stellaPermission as string) || "none";
  const stpPermission = (data.stpPermission as string) || "none";

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

  // 権限を設定
  const permissionsToCreate = [];
  if (stellaPermission && stellaPermission !== "none") {
    permissionsToCreate.push({
      staffId: staff.id,
      projectCode: "stella",
      permissionLevel: stellaPermission,
    });
  }
  if (stpPermission && stpPermission !== "none") {
    permissionsToCreate.push({
      staffId: staff.id,
      projectCode: "stp",
      permissionLevel: stpPermission,
    });
  }
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
  const stellaPermission = (data.stellaPermission as string) || "none";
  const stpPermission = (data.stpPermission as string) || "none";

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

  // 権限を更新（既存を削除して再作成）
  await prisma.staffPermission.deleteMany({
    where: { staffId: id },
  });

  const permissionsToCreate = [];
  if (stellaPermission && stellaPermission !== "none") {
    permissionsToCreate.push({
      staffId: id,
      projectCode: "stella",
      permissionLevel: stellaPermission,
    });
  }
  if (stpPermission && stpPermission !== "none") {
    permissionsToCreate.push({
      staffId: id,
      projectCode: "stp",
      permissionLevel: stpPermission,
    });
  }
  if (permissionsToCreate.length > 0) {
    await prisma.staffPermission.createMany({
      data: permissionsToCreate,
    });
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
