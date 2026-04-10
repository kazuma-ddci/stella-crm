"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ok, err, type ActionResult } from "@/lib/action-result";

export async function getSidebarPreference(): Promise<string[]> {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as number | undefined;
  if (!userId) return [];

  const pref = await prisma.staffSidebarPreference.findUnique({
    where: { staffId: userId },
    select: { hiddenItems: true },
  });
  return pref?.hiddenItems ?? [];
}

export async function updateSidebarPreference(
  hiddenItems: string[]
): Promise<ActionResult> {
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session?.user as any)?.id as number | undefined;
    if (!userId) return err("認証が必要です");

    await prisma.staffSidebarPreference.upsert({
      where: { staffId: userId },
      update: { hiddenItems },
      create: { staffId: userId, hiddenItems },
    });

    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    console.error("[updateSidebarPreference] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
