"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithAnyEditPermission } from "@/lib/auth/staff-action";

type LocationDto = {
  id: number;
  companyId: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getLocations(companyId: number) {
  const locations = await prisma.stellaCompanyLocation.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });
  return locations.map((l) => ({
    id: l.id,
    companyId: l.companyId,
    name: l.name,
    address: l.address,
    phone: l.phone,
    email: l.email,
    isPrimary: l.isPrimary,
    note: l.note,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));
}

export async function addLocation(
  companyId: number,
  data: Record<string, unknown>
): Promise<ActionResult<LocationDto>> {
  // 認証: 社内スタッフ + いずれかのプロジェクトで edit 以上
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithAnyEditPermission();
  try {
    // isPrimary が true の場合、他の拠点の isPrimary を false にする
    if (data.isPrimary) {
      await prisma.stellaCompanyLocation.updateMany({
        where: { companyId, isPrimary: true, deletedAt: null },
        data: { isPrimary: false },
      });
    }

    const location = await prisma.stellaCompanyLocation.create({
      data: {
        companyId,
        name: data.name as string,
        address: (data.address as string) || null,
        phone: (data.phone as string) || null,
        email: (data.email as string) || null,
        isPrimary: (data.isPrimary as boolean) || false,
        note: (data.note as string) || null,
      },
    });

    revalidatePath("/companies");
    return ok({
      id: location.id,
      companyId: location.companyId,
      name: location.name,
      address: location.address,
      phone: location.phone,
      email: location.email,
      isPrimary: location.isPrimary,
      note: location.note,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[addLocation] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateLocation(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult<LocationDto>> {
  await requireStaffWithAnyEditPermission();
  try {
    const existing = await prisma.stellaCompanyLocation.findUnique({
      where: { id },
    });
    if (!existing) return err("拠点が見つかりません");

    // isPrimary が true の場合、他の拠点の isPrimary を false にする
    if (data.isPrimary) {
      await prisma.stellaCompanyLocation.updateMany({
        where: { companyId: existing.companyId, isPrimary: true, deletedAt: null, NOT: { id } },
        data: { isPrimary: false },
      });
    }

    const location = await prisma.stellaCompanyLocation.update({
      where: { id },
      data: {
        name: data.name as string,
        address: (data.address as string) || null,
        phone: (data.phone as string) || null,
        email: (data.email as string) || null,
        isPrimary: (data.isPrimary as boolean) || false,
        note: (data.note as string) || null,
      },
    });

    revalidatePath("/companies");
    return ok({
      id: location.id,
      companyId: location.companyId,
      name: location.name,
      address: location.address,
      phone: location.phone,
      email: location.email,
      isPrimary: location.isPrimary,
      note: location.note,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[updateLocation] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteLocation(id: number): Promise<ActionResult> {
  await requireStaffWithAnyEditPermission();
  try {
    // 論理削除：deletedAtに現在日時を設定
    await prisma.stellaCompanyLocation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/companies");
    return ok();
  } catch (e) {
    console.error("[deleteLocation] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
