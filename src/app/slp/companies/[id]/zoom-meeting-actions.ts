"use server";

import { revalidatePath } from "next/cache";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { regenerateZoomForReservation } from "@/lib/slp/zoom-reservation-handler";

export async function regenerateZoomMeeting(
  companyRecordId: number,
  category: "briefing" | "consultation"
): Promise<{ ok: true; url: string | null } | { ok: false; message: string }> {
  await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);
  try {
    const result = await regenerateZoomForReservation({
      companyRecordId,
      category,
    });
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
