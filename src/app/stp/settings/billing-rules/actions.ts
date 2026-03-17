"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";

type BillingRuleData = {
  feeType: string;
  invoiceBusinessDays: number | null;
  paymentBusinessDays: number | null;
  closingDay: number | null;
  paymentMonthOffset: number | null;
  paymentDay: number | null;
};

const DEFAULT_RULES: Record<string, BillingRuleData> = {
  initial: {
    feeType: "initial",
    invoiceBusinessDays: 3,
    paymentBusinessDays: 5,
    closingDay: null,
    paymentMonthOffset: null,
    paymentDay: null,
  },
  monthly: {
    feeType: "monthly",
    invoiceBusinessDays: null,
    paymentBusinessDays: null,
    closingDay: 0,
    paymentMonthOffset: 1,
    paymentDay: 15,
  },
  performance: {
    feeType: "performance",
    invoiceBusinessDays: null,
    paymentBusinessDays: null,
    closingDay: 0,
    paymentMonthOffset: 1,
    paymentDay: 15,
  },
};

async function getStpProjectId(): Promise<number> {
  const project = await prisma.masterProject.findUnique({
    where: { code: "stp" },
  });
  if (!project) throw new Error("STPプロジェクトが見つかりません");
  return project.id;
}

export async function getBillingRules(): Promise<BillingRuleData[]> {
  const projectId = await getStpProjectId();

  const rules = await prisma.stpBillingRule.findMany({
    where: { projectId },
    orderBy: { feeType: "asc" },
  });

  // 3つのfeeType分のルールを返す。DBになければデフォルト値
  return ["initial", "monthly", "performance"].map((feeType) => {
    const existing = rules.find((r) => r.feeType === feeType);
    if (existing) {
      return {
        feeType: existing.feeType,
        invoiceBusinessDays: existing.invoiceBusinessDays,
        paymentBusinessDays: existing.paymentBusinessDays,
        closingDay: existing.closingDay,
        paymentMonthOffset: existing.paymentMonthOffset,
        paymentDay: existing.paymentDay,
      };
    }
    return DEFAULT_RULES[feeType];
  });
}

export async function saveBillingRules(
  rules: BillingRuleData[]
): Promise<{ success: boolean; error?: string }> {
  await requireEdit("stp");
  try {
    const projectId = await getStpProjectId();

    await prisma.$transaction(
      rules.map((rule) =>
        prisma.stpBillingRule.upsert({
          where: {
            projectId_feeType: {
              projectId,
              feeType: rule.feeType,
            },
          },
          create: {
            projectId,
            feeType: rule.feeType,
            invoiceBusinessDays: rule.invoiceBusinessDays,
            paymentBusinessDays: rule.paymentBusinessDays,
            closingDay: rule.closingDay,
            paymentMonthOffset: rule.paymentMonthOffset,
            paymentDay: rule.paymentDay,
          },
          update: {
            invoiceBusinessDays: rule.invoiceBusinessDays,
            paymentBusinessDays: rule.paymentBusinessDays,
            closingDay: rule.closingDay,
            paymentMonthOffset: rule.paymentMonthOffset,
            paymentDay: rule.paymentDay,
          },
        })
      )
    );

    revalidatePath("/stp/settings/billing-rules");
    return { success: true };
  } catch (error) {
    console.error("請求ルール保存エラー:", error);
    const errorMessage =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}
