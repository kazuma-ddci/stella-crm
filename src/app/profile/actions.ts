"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

export async function updateSidebarPreference(hiddenItems: string[]): Promise<void> {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as number | undefined;
  if (!userId) throw new Error("認証が必要です");

  await prisma.staffSidebarPreference.upsert({
    where: { staffId: userId },
    update: { hiddenItems },
    create: { staffId: userId, hiddenItems },
  });

  revalidatePath("/", "layout");
}
