"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { disconnectZoomForStaff } from "@/lib/zoom/oauth";
import { prisma } from "@/lib/prisma";

/**
 * 自分自身の Zoom 連携を解除する。誰でも（自分分だけは）可能。
 */
export async function disconnectZoomSelf(): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaff();
  try {
    await disconnectZoomForStaff({
      staffId: user.id,
      actingStaffId: user.id,
    });
    revalidatePath("/staff/me/integrations");
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "解除に失敗しました" };
  }
}

/**
 * 他スタッフのZoom連携を解除する。SLP manager 以上のみ可能。
 */
export async function disconnectZoomForOtherStaff(
  targetStaffId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireStaffWithProjectPermission([
    { project: "slp", level: "manager" },
  ]);
  try {
    await disconnectZoomForStaff({
      staffId: targetStaffId,
      actingStaffId: user.id,
    });
    revalidatePath("/staff/me/integrations");
    revalidatePath("/staff");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "解除に失敗しました" };
  }
}

export async function getZoomIntegrationSummary() {
  const user = await requireStaff();
  const mine = await prisma.staffMeetingIntegration.findUnique({
    where: { staffId_provider: { staffId: user.id, provider: "zoom" } },
  });
  return {
    staffId: user.id,
    mine: mine
      ? {
          connectedAt: mine.connectedAt,
          disconnectedAt: mine.disconnectedAt,
          externalEmail: mine.externalEmail,
          externalDisplayName: mine.externalDisplayName,
          lastRefreshedAt: mine.lastRefreshedAt,
        }
      : null,
  };
}
