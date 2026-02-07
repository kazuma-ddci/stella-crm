"use server";

import { generateMonthlyRecordsForAllContracts } from "@/lib/finance/auto-generate";

export async function generateMonthlyAction() {
  return await generateMonthlyRecordsForAllContracts();
}
