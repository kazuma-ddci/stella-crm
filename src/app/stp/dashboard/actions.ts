"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const SETTING_KEY = "annual_revenue_target";
const DEFAULT_TARGET = 30_000_000; // 3,000万円

export async function getAnnualRevenueTarget(): Promise<number> {
  const setting = await prisma.stpSetting.findUnique({
    where: { key: SETTING_KEY },
  });
  return setting ? parseInt(setting.value, 10) : DEFAULT_TARGET;
}

export async function updateAnnualRevenueTarget(value: number): Promise<void> {
  await prisma.stpSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: String(value) },
    create: { key: SETTING_KEY, value: String(value) },
  });
  revalidatePath("/stp/dashboard");
}
