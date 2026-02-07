"use server";

import { revalidatePath } from "next/cache";
import { closeMonth, reopenMonth } from "@/lib/finance/monthly-close";

export async function closeMonthAction(
  targetMonth: string,
  closedBy: number
) {
  await closeMonth(new Date(targetMonth), closedBy);
  revalidatePath("/stp/finance/monthly-close");
  revalidatePath("/stp/finance");
}

export async function reopenMonthAction(
  targetMonth: string,
  reopenedBy: number,
  reason: string
) {
  await reopenMonth(new Date(targetMonth), reopenedBy, reason);
  revalidatePath("/stp/finance/monthly-close");
  revalidatePath("/stp/finance");
}
