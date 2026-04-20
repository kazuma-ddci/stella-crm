"use server";

import { revalidatePath } from "next/cache";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  enableDailyApiCostOverride,
  disableDailyApiCostOverride,
} from "@/lib/hojo/api-cost-limit";
import { auth } from "@/auth";

const REVALIDATE_PATH = "/hojo/settings/api-usage";

/** 本日の上限を解除する（管理者操作）。 */
export async function enableTodayOverride(reason?: string): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const session = await auth();
    const staffId = (session?.user?.id as number | undefined) ?? null;
    await enableDailyApiCostOverride(staffId, reason);
    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/hojo/application-support");
    revalidatePath("/hojo/form-submissions");
    return ok();
  } catch (e) {
    console.error("[enableTodayOverride] error:", e);
    return err(e instanceof Error ? e.message : "解除に失敗しました");
  }
}

/** 本日の解除を取り消す。 */
export async function disableTodayOverride(): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    await disableDailyApiCostOverride();
    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/hojo/application-support");
    revalidatePath("/hojo/form-submissions");
    return ok();
  } catch (e) {
    console.error("[disableTodayOverride] error:", e);
    return err(e instanceof Error ? e.message : "取消に失敗しました");
  }
}
