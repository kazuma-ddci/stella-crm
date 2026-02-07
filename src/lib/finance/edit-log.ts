"use server";

import { prisma } from "@/lib/prisma";

type EditLogParams = {
  revenueRecordId?: number;
  expenseRecordId?: number;
  editType: "field_change" | "amount_mismatch";
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  editedBy?: number;
};

export async function createFinanceEditLog(params: EditLogParams) {
  await prisma.stpFinanceEditLog.create({
    data: {
      revenueRecordId: params.revenueRecordId ?? null,
      expenseRecordId: params.expenseRecordId ?? null,
      editType: params.editType,
      fieldName: params.fieldName ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      reason: params.reason ?? null,
      editedBy: params.editedBy ?? null,
    },
  });
}
