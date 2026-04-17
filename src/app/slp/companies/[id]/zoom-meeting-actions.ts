"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { regenerateZoomForSession } from "@/lib/slp/zoom-reservation-handler";

/**
 * セッションIDに対して Zoom URL を再発行する（旧「手動で発行する」ボタン相当）
 * - 既存の primary Zoom を削除して新規発行
 * - お客様への自動送信はしない（スタッフが手動で送付する）
 */
export async function regenerateZoomMeetingBySession(
  sessionId: number
): Promise<{ ok: true; url: string | null } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const session = await prisma.slpMeetingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, companyRecordId: true, deletedAt: true },
    });
    if (!session || session.deletedAt) {
      return { ok: false, message: "打ち合わせが見つかりません" };
    }

    const result = await regenerateZoomForSession({ sessionId: session.id });
    if (!result.ok) {
      return { ok: false, message: result.errorMessage ?? "再発行に失敗しました" };
    }
    revalidatePath(`/slp/companies/${session.companyRecordId}`);
    return { ok: true, url: result.url };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "予期しないエラー",
    };
  }
}

/**
 * @deprecated 旧UI互換。新UIは regenerateZoomMeetingBySession を使う。
 * companyRecordId + category で現在アクティブなセッションを探して再発行する。
 */
export async function regenerateZoomMeeting(
  companyRecordId: number,
  category: "briefing" | "consultation"
): Promise<{ ok: true; url: string | null } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);
  try {
    const session = await prisma.slpMeetingSession.findFirst({
      where: {
        companyRecordId,
        category,
        status: "予約中",
        deletedAt: null,
      },
      orderBy: [{ roundNumber: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    if (!session) {
      return {
        ok: false,
        message: "予約中の打ち合わせが見つからないため再発行できません",
      };
    }

    const result = await regenerateZoomForSession({ sessionId: session.id });
    if (!result.ok) {
      return { ok: false, message: result.errorMessage ?? "再発行に失敗しました" };
    }
    revalidatePath(`/slp/companies/${companyRecordId}`);
    return { ok: true, url: result.url };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "予期しないエラー",
    };
  }
}
