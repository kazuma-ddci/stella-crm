"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function addVendor(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoVendor.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const joseiLineFriendId = data.joseiLineFriendId ? Number(data.joseiLineFriendId) : null;

  await prisma.hojoVendor.create({
    data: {
      name: String(data.name).trim(),
      lineFriendId: data.lineFriendId ? Number(data.lineFriendId) : null,
      joseiLineFriendId,
      accessToken: generateToken(),
      memo: data.memo ? String(data.memo).trim() : null,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });

  // 紐づけたLINE友達のuserTypeを「ベンダー」に更新
  if (joseiLineFriendId) {
    await prisma.hojoLineFriendJoseiSupport.update({
      where: { id: joseiLineFriendId },
      data: { userType: "ベンダー" },
    });
  }

  // SecurityCloud側のuserTypeも「ベンダー」に更新
  const lineFriendId = data.lineFriendId ? Number(data.lineFriendId) : null;
  if (lineFriendId) {
    await prisma.hojoLineFriendSecurityCloud.update({
      where: { id: lineFriendId },
      data: { userType: "ベンダー" },
    });
  }

  revalidatePath("/hojo/settings/vendors");
}

export async function updateVendor(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  // 変更前のベンダー情報を取得
  const currentVendor = await prisma.hojoVendor.findUnique({ where: { id } });

  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("lineFriendId" in data) updateData.lineFriendId = data.lineFriendId ? Number(data.lineFriendId) : null;
  if ("joseiLineFriendId" in data) updateData.joseiLineFriendId = data.joseiLineFriendId ? Number(data.joseiLineFriendId) : null;
  if ("memo" in data) updateData.memo = data.memo ? String(data.memo).trim() : null;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoVendor.update({
      where: { id },
      data: updateData,
    });
  }

  // joseiLineFriendIdが変更された場合、userTypeを連動更新
  if ("joseiLineFriendId" in data && currentVendor) {
    const oldId = currentVendor.joseiLineFriendId;
    const newId = data.joseiLineFriendId ? Number(data.joseiLineFriendId) : null;

    // 旧紐づけ先を「顧客」に戻す（他のベンダーに紐づいていなければ）
    if (oldId && oldId !== newId) {
      const otherVendorCount = await prisma.hojoVendor.count({
        where: { joseiLineFriendId: oldId, id: { not: id } },
      });
      if (otherVendorCount === 0) {
        await prisma.hojoLineFriendJoseiSupport.update({
          where: { id: oldId },
          data: { userType: "顧客" },
        });
      }
    }

    // 新紐づけ先を「ベンダー」にする
    if (newId) {
      await prisma.hojoLineFriendJoseiSupport.update({
        where: { id: newId },
        data: { userType: "ベンダー" },
      });
    }
  }

  // lineFriendId（SecurityCloud）が変更された場合、userTypeを連動更新
  if ("lineFriendId" in data && currentVendor) {
    const oldScId = currentVendor.lineFriendId;
    const newScId = data.lineFriendId ? Number(data.lineFriendId) : null;

    if (oldScId && oldScId !== newScId) {
      const otherVendorCount = await prisma.hojoVendor.count({
        where: { lineFriendId: oldScId, id: { not: id } },
      });
      if (otherVendorCount === 0) {
        await prisma.hojoLineFriendSecurityCloud.update({
          where: { id: oldScId },
          data: { userType: "顧客" },
        });
      }
    }

    if (newScId) {
      await prisma.hojoLineFriendSecurityCloud.update({
        where: { id: newScId },
        data: { userType: "ベンダー" },
      });
    }
  }

  revalidatePath("/hojo/settings/vendors");
}

export async function deleteVendor(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoApplicationSupport.count({
    where: { vendorId: id, deletedAt: null },
  });
  if (usageCount > 0) {
    throw new Error(`このベンダーは${usageCount}件の申請管理で使用中のため削除できません`);
  }

  // 削除前にベンダー情報を取得
  const vendor = await prisma.hojoVendor.findUnique({ where: { id } });

  await prisma.hojoVendor.delete({
    where: { id },
  });

  // 紐づいていたLINE友達のuserTypeを「顧客」に戻す（他のベンダーに紐づいていなければ）
  if (vendor?.joseiLineFriendId) {
    const otherVendorCount = await prisma.hojoVendor.count({
      where: { joseiLineFriendId: vendor.joseiLineFriendId },
    });
    if (otherVendorCount === 0) {
      await prisma.hojoLineFriendJoseiSupport.update({
        where: { id: vendor.joseiLineFriendId },
        data: { userType: "顧客" },
      });
    }
  }

  // SecurityCloud側のuserTypeも「顧客」に戻す
  if (vendor?.lineFriendId) {
    const otherVendorCount = await prisma.hojoVendor.count({
      where: { lineFriendId: vendor.lineFriendId },
    });
    if (otherVendorCount === 0) {
      await prisma.hojoLineFriendSecurityCloud.update({
        where: { id: vendor.lineFriendId },
        data: { userType: "顧客" },
      });
    }
  }

  revalidatePath("/hojo/settings/vendors");
}

export async function reorderVendors(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoVendor.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/vendors");
}
