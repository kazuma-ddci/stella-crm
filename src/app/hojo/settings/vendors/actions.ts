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

  const lineFriendId = data.lineFriendId ? Number(data.lineFriendId) : null;
  const joseiLineFriendId = data.joseiLineFriendId ? Number(data.joseiLineFriendId) : null;

  const vendor = await prisma.hojoVendor.create({
    data: {
      name: String(data.name).trim(),
      lineFriendId,
      joseiLineFriendId,
      accessToken: generateToken(),
      memo: data.memo ? String(data.memo).trim() : null,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });

  // 中間テーブルにも登録（初回担当者 = isPrimary）
  if (lineFriendId || joseiLineFriendId) {
    await prisma.hojoVendorContact.create({
      data: {
        vendorId: vendor.id,
        lineFriendId,
        joseiLineFriendId,
        isPrimary: true,
      },
    });
  }

  // 紐づけたLINE友達のuserTypeを「ベンダー」に更新
  if (joseiLineFriendId) {
    await prisma.hojoLineFriendJoseiSupport.update({
      where: { id: joseiLineFriendId },
      data: { userType: "ベンダー" },
    });
  }
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

    if (oldId && oldId !== newId) {
      // 旧紐づけ先が他のベンダーやcontactにも紐づいていなければ「顧客」に戻す
      const otherContactCount = await prisma.hojoVendorContact.count({
        where: { joseiLineFriendId: oldId },
      });
      const otherVendorCount = await prisma.hojoVendor.count({
        where: { joseiLineFriendId: oldId, id: { not: id } },
      });
      if (otherContactCount === 0 && otherVendorCount === 0) {
        await prisma.hojoLineFriendJoseiSupport.update({
          where: { id: oldId },
          data: { userType: "顧客" },
        });
      }
    }

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
      const otherContactCount = await prisma.hojoVendorContact.count({
        where: { lineFriendId: oldScId },
      });
      const otherVendorCount = await prisma.hojoVendor.count({
        where: { lineFriendId: oldScId, id: { not: id } },
      });
      if (otherContactCount === 0 && otherVendorCount === 0) {
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

  const vendor = await prisma.hojoVendor.findUnique({
    where: { id },
    include: { contacts: true },
  });

  // 中間テーブルのcontactsは onDelete: Cascade で自動削除される
  await prisma.hojoVendor.delete({
    where: { id },
  });

  // 紐づいていたLINE友達のuserTypeを「顧客」に戻す
  if (vendor) {
    // 全contactのLINE友達を処理
    const allJoseiIds = new Set<number>();
    const allScIds = new Set<number>();

    if (vendor.joseiLineFriendId) allJoseiIds.add(vendor.joseiLineFriendId);
    if (vendor.lineFriendId) allScIds.add(vendor.lineFriendId);
    for (const c of vendor.contacts) {
      if (c.joseiLineFriendId) allJoseiIds.add(c.joseiLineFriendId);
      if (c.lineFriendId) allScIds.add(c.lineFriendId);
    }

    for (const joseiId of allJoseiIds) {
      const otherCount = await prisma.hojoVendorContact.count({
        where: { joseiLineFriendId: joseiId },
      });
      const otherVendorCount = await prisma.hojoVendor.count({
        where: { joseiLineFriendId: joseiId },
      });
      if (otherCount === 0 && otherVendorCount === 0) {
        await prisma.hojoLineFriendJoseiSupport.update({
          where: { id: joseiId },
          data: { userType: "顧客" },
        });
      }
    }

    for (const scId of allScIds) {
      const otherCount = await prisma.hojoVendorContact.count({
        where: { lineFriendId: scId },
      });
      const otherVendorCount = await prisma.hojoVendor.count({
        where: { lineFriendId: scId },
      });
      if (otherCount === 0 && otherVendorCount === 0) {
        await prisma.hojoLineFriendSecurityCloud.update({
          where: { id: scId },
          data: { userType: "顧客" },
        });
      }
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

// ============================
// ベンダー担当者（VendorContact）管理
// ============================

export async function addVendorContact(
  vendorId: number,
  lineFriendId: number | null,
  joseiLineFriendId: number | null
) {
  await requireProjectMasterDataEditPermission();

  // 既存のcontactがなければisPrimary=true
  const existingCount = await prisma.hojoVendorContact.count({
    where: { vendorId },
  });

  await prisma.hojoVendorContact.create({
    data: {
      vendorId,
      lineFriendId,
      joseiLineFriendId,
      isPrimary: existingCount === 0,
    },
  });

  // userTypeを「ベンダー」に更新
  if (lineFriendId) {
    await prisma.hojoLineFriendSecurityCloud.update({
      where: { id: lineFriendId },
      data: { userType: "ベンダー" },
    });
  }
  if (joseiLineFriendId) {
    await prisma.hojoLineFriendJoseiSupport.update({
      where: { id: joseiLineFriendId },
      data: { userType: "ベンダー" },
    });
  }

  revalidatePath("/hojo/settings/vendors");
}

export async function updateVendorContact(
  contactId: number,
  lineFriendId: number | null,
  joseiLineFriendId: number | null
) {
  await requireProjectMasterDataEditPermission();

  const contact = await prisma.hojoVendorContact.findUnique({
    where: { id: contactId },
  });
  if (!contact) return;

  // 旧紐づけのuserTypeを戻す
  if (contact.lineFriendId && contact.lineFriendId !== lineFriendId) {
    const otherCount = await prisma.hojoVendorContact.count({
      where: { lineFriendId: contact.lineFriendId, id: { not: contactId } },
    });
    const otherVendorCount = await prisma.hojoVendor.count({
      where: { lineFriendId: contact.lineFriendId },
    });
    if (otherCount === 0 && otherVendorCount === 0) {
      await prisma.hojoLineFriendSecurityCloud.update({
        where: { id: contact.lineFriendId },
        data: { userType: "顧客" },
      });
    }
  }
  if (contact.joseiLineFriendId && contact.joseiLineFriendId !== joseiLineFriendId) {
    const otherCount = await prisma.hojoVendorContact.count({
      where: { joseiLineFriendId: contact.joseiLineFriendId, id: { not: contactId } },
    });
    const otherVendorCount = await prisma.hojoVendor.count({
      where: { joseiLineFriendId: contact.joseiLineFriendId },
    });
    if (otherCount === 0 && otherVendorCount === 0) {
      await prisma.hojoLineFriendJoseiSupport.update({
        where: { id: contact.joseiLineFriendId },
        data: { userType: "顧客" },
      });
    }
  }

  await prisma.hojoVendorContact.update({
    where: { id: contactId },
    data: { lineFriendId, joseiLineFriendId },
  });

  // 新紐づけのuserTypeをベンダーに
  if (lineFriendId) {
    await prisma.hojoLineFriendSecurityCloud.update({
      where: { id: lineFriendId },
      data: { userType: "ベンダー" },
    });
  }
  if (joseiLineFriendId) {
    await prisma.hojoLineFriendJoseiSupport.update({
      where: { id: joseiLineFriendId },
      data: { userType: "ベンダー" },
    });
  }

  revalidatePath("/hojo/settings/vendors");
}

export async function deleteVendorContact(contactId: number) {
  await requireProjectMasterDataEditPermission();

  const contact = await prisma.hojoVendorContact.findUnique({
    where: { id: contactId },
  });
  if (!contact) return;

  await prisma.hojoVendorContact.delete({
    where: { id: contactId },
  });

  // 削除されたcontactのLINE友達が他のベンダーにも紐づいていなければuserTypeを戻す
  if (contact.lineFriendId) {
    const otherCount = await prisma.hojoVendorContact.count({
      where: { lineFriendId: contact.lineFriendId },
    });
    const otherVendorCount = await prisma.hojoVendor.count({
      where: { lineFriendId: contact.lineFriendId },
    });
    if (otherCount === 0 && otherVendorCount === 0) {
      await prisma.hojoLineFriendSecurityCloud.update({
        where: { id: contact.lineFriendId },
        data: { userType: "顧客" },
      });
    }
  }
  if (contact.joseiLineFriendId) {
    const otherCount = await prisma.hojoVendorContact.count({
      where: { joseiLineFriendId: contact.joseiLineFriendId },
    });
    const otherVendorCount = await prisma.hojoVendor.count({
      where: { joseiLineFriendId: contact.joseiLineFriendId },
    });
    if (otherCount === 0 && otherVendorCount === 0) {
      await prisma.hojoLineFriendJoseiSupport.update({
        where: { id: contact.joseiLineFriendId },
        data: { userType: "顧客" },
      });
    }
  }

  // isPrimaryが削除された場合、残りの最初のcontactをisPrimaryにする
  if (contact.isPrimary) {
    const nextContact = await prisma.hojoVendorContact.findFirst({
      where: { vendorId: contact.vendorId },
      orderBy: { id: "asc" },
    });
    if (nextContact) {
      await prisma.hojoVendorContact.update({
        where: { id: nextContact.id },
        data: { isPrimary: true },
      });
    }
  }

  revalidatePath("/hojo/settings/vendors");
}

export async function setPrimaryContact(contactId: number) {
  await requireProjectMasterDataEditPermission();

  const contact = await prisma.hojoVendorContact.findUnique({
    where: { id: contactId },
  });
  if (!contact) return;

  // 同じベンダーの全contactのisPrimaryをfalseにしてから、指定のcontactをtrueにする
  await prisma.$transaction([
    prisma.hojoVendorContact.updateMany({
      where: { vendorId: contact.vendorId },
      data: { isPrimary: false },
    }),
    prisma.hojoVendorContact.update({
      where: { id: contactId },
      data: { isPrimary: true },
    }),
  ]);

  revalidatePath("/hojo/settings/vendors");
}
