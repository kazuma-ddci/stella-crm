"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { revalidatePath } from "next/cache";
import { ok, err, type ActionResult } from "@/lib/action-result";

// ============================================
// 代理店 CRUD
// ============================================

export async function getAgencies() {
  return prisma.slpAgency.findMany({
    where: { deletedAt: null },
    include: {
      contractStatus: { select: { id: true, name: true } },
      contacts: {
        include: {
          lineFriend: { select: { id: true, snsname: true, uid: true } },
        },
        orderBy: { id: "asc" },
      },
      children: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
    orderBy: { id: "asc" },
  });
}

export async function createAgency(data: {
  name: string;
  corporateName?: string;
  email?: string;
  phone?: string;
  address?: string;
  contractStatusId?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  notes?: string;
  parentId?: number | null;
}) {
  await requireProjectMasterDataEditPermission("slp");

  const agency = await prisma.slpAgency.create({
    data: {
      name: data.name,
      corporateName: data.corporateName || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      contractStatusId: data.contractStatusId ?? null,
      contractStartDate: data.contractStartDate
        ? new Date(data.contractStartDate)
        : null,
      contractEndDate: data.contractEndDate
        ? new Date(data.contractEndDate)
        : null,
      notes: data.notes || null,
      parentId: data.parentId ?? null,
    },
  });

  revalidatePath("/slp/agencies");
  return agency;
}

export async function updateAgency(
  id: number,
  data: {
    name?: string;
    corporateName?: string;
    email?: string;
    phone?: string;
    address?: string;
    contractStatusId?: number | null;
    contractStartDate?: string | null;
    contractEndDate?: string | null;
    notes?: string;
  }
) {
  await requireProjectMasterDataEditPermission("slp");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.corporateName !== undefined)
    updateData.corporateName = data.corporateName || null;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.contractStatusId !== undefined)
    updateData.contractStatusId = data.contractStatusId;
  if (data.contractStartDate !== undefined)
    updateData.contractStartDate = data.contractStartDate
      ? new Date(data.contractStartDate)
      : null;
  if (data.contractEndDate !== undefined)
    updateData.contractEndDate = data.contractEndDate
      ? new Date(data.contractEndDate)
      : null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  await prisma.slpAgency.update({ where: { id }, data: updateData });
  revalidatePath("/slp/agencies");
}

export async function deleteAgency(id: number) {
  await requireProjectMasterDataEditPermission("slp");

  // 子代理店も含めて論理削除
  async function softDeleteRecursive(agencyId: number) {
    const children = await prisma.slpAgency.findMany({
      where: { parentId: agencyId, deletedAt: null },
      select: { id: true },
    });
    for (const child of children) {
      await softDeleteRecursive(child.id);
    }
    await prisma.slpAgency.update({
      where: { id: agencyId },
      data: { deletedAt: new Date() },
    });
  }

  await softDeleteRecursive(id);
  revalidatePath("/slp/agencies");
}

// ============================================
// 担当者 CRUD
// ============================================

export async function addAgencyContact(data: {
  agencyId: number;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  lineFriendId?: number | null;
}) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.slpAgencyContact.create({
    data: {
      agencyId: data.agencyId,
      name: data.name,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      lineFriendId: data.lineFriendId ?? null,
    },
  });

  revalidatePath("/slp/agencies");
}

export async function updateAgencyContact(
  id: number,
  data: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    lineFriendId?: number | null;
  }
) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.slpAgencyContact.update({
    where: { id },
    data: {
      name: data.name,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      lineFriendId: data.lineFriendId ?? null,
    },
  });

  revalidatePath("/slp/agencies");
}

export async function deleteAgencyContact(id: number) {
  await requireProjectMasterDataEditPermission("slp");
  await prisma.slpAgencyContact.delete({ where: { id } });
  revalidatePath("/slp/agencies");
}

// ============================================
// 契約ステータス CRUD
// ============================================

export async function getAllAgencyContractStatuses() {
  return prisma.slpAgencyContractStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
}

export async function addAgencyContractStatus(data: { name: string }) {
  await requireProjectMasterDataEditPermission("slp");

  const maxOrder = await prisma.slpAgencyContractStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.slpAgencyContractStatus.create({
    data: {
      name: String(data.name).trim(),
      displayOrder,
      isActive: true,
    },
  });

  revalidatePath("/slp/agencies");
}

export async function updateAgencyContractStatus(
  id: number,
  data: { name?: string; isActive?: boolean }
) {
  await requireProjectMasterDataEditPermission("slp");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await prisma.slpAgencyContractStatus.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/slp/agencies");
}

export async function deleteAgencyContractStatus(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    const usageCount = await prisma.slpAgency.count({
      where: { contractStatusId: id, deletedAt: null },
    });
    if (usageCount > 0) {
      return err(
        `このステータスは${usageCount}件の代理店で使用中のため削除できません`
      );
    }

    await prisma.slpAgencyContractStatus.delete({ where: { id } });
    revalidatePath("/slp/agencies");
    return ok();
  } catch (e) {
    console.error("[deleteAgencyContractStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderAgencyContractStatuses(
  orderedIds: number[]
) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.slpAgencyContractStatus.update({
        where: { id },
        data: { displayOrder: index },
      })
    )
  );

  revalidatePath("/slp/agencies");
}

// ============================================
// 担当AS解決ロジック
// ============================================

type AsResolution = {
  contactId: number;
  contactName: string;
  asId: number | null;
  asName: string | null;
  chain: string[]; // 辿った紹介者チェーン（デバッグ用）
};

/**
 * 代理店の担当者からAS（アソシエイトスタッフ）を紹介者チェーンで解決する
 *
 * ロジック:
 * 1. 担当者のlineFriendIdからSlpLineFriendのuidを取得
 * 2. そのLineFriendのfree1（紹介者uid）を辿る
 * 3. 辿った先のLineFriendがSlpAsに登録されていれば担当AS
 * 4. 登録されていなければさらにfree1を辿る（最大20段階）
 */
export async function resolveAgencyAs(agencyId: number): Promise<AsResolution[]> {
  // 代理店の担当者（LINE紐付けあり）を取得
  const contacts = await prisma.slpAgencyContact.findMany({
    where: { agencyId },
    include: {
      lineFriend: { select: { id: true, uid: true, snsname: true, free1: true } },
    },
    orderBy: { id: "asc" },
  });

  // SlpAs一覧（lineFriendId → SlpLineFriend.uid マップ）
  const asRecords = await prisma.slpAs.findMany({
    include: {
      lineFriend: { select: { uid: true } },
    },
  });

  // uid → SlpAs のマップ
  const uidToAs = new Map<string, { id: number; name: string }>();
  for (const as of asRecords) {
    if (as.lineFriend?.uid) {
      uidToAs.set(as.lineFriend.uid, { id: as.id, name: as.name });
    }
  }

  // uid → SlpLineFriend のマップ（free1解決用）
  const allFriends = await prisma.slpLineFriend.findMany({
    where: { deletedAt: null },
    select: { uid: true, free1: true, snsname: true },
  });
  const uidToFriend = new Map(
    allFriends.map((f) => [f.uid, { free1: f.free1, snsname: f.snsname }])
  );

  const results: AsResolution[] = [];

  for (const contact of contacts) {
    if (!contact.lineFriend) {
      results.push({
        contactId: contact.id,
        contactName: contact.name,
        asId: null,
        asName: null,
        chain: [],
      });
      continue;
    }

    // 紹介者チェーンを辿る
    const chain: string[] = [];
    let currentUid: string | null = contact.lineFriend.free1;
    let foundAs: { id: number; name: string } | null = null;
    const visited = new Set<string>();
    const MAX_DEPTH = 20;

    for (let depth = 0; depth < MAX_DEPTH && currentUid; depth++) {
      if (visited.has(currentUid)) break; // 循環防止
      visited.add(currentUid);

      const friendName = uidToFriend.get(currentUid)?.snsname ?? currentUid;
      chain.push(friendName);

      // このuidがASとして登録されているか
      const as = uidToAs.get(currentUid);
      if (as) {
        foundAs = as;
        break;
      }

      // 次の紹介者を辿る
      const friend = uidToFriend.get(currentUid);
      currentUid = friend?.free1 ?? null;
    }

    results.push({
      contactId: contact.id,
      contactName: contact.name,
      asId: foundAs?.id ?? null,
      asName: foundAs?.name ?? null,
      chain,
    });
  }

  return results;
}
