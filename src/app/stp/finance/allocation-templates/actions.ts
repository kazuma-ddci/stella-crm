"use server";

import { getSystemProjectContext } from "@/lib/project-context";
import {
  createAllocationTemplate,
  updateAllocationTemplate,
} from "@/app/accounting/masters/allocation-templates/actions";

type LineInput = {
  costCenterId: number | null;
  allocationRate: number;
  label: string | null;
};

/** STP按分テンプレート作成（STP CostCenter含有を強制） */
export async function stpCreateAllocationTemplate(data: Record<string, unknown>) {
  const stpCtx = await getSystemProjectContext("stp");
  const lines = data.lines as LineInput[] | undefined;

  if (!lines?.some(l => l.costCenterId != null && stpCtx.costCenterIds.includes(l.costCenterId))) {
    throw new Error("STP按分テンプレートには、STPプロジェクトのコストセンターを1つ以上含める必要があります");
  }

  return createAllocationTemplate(data);
}

/** STP按分テンプレート更新（STP CostCenter含有を強制） */
export async function stpUpdateAllocationTemplate(id: number, data: Record<string, unknown>) {
  const stpCtx = await getSystemProjectContext("stp");
  const lines = data.lines as LineInput[] | undefined;

  if (lines && !lines.some(l => l.costCenterId != null && stpCtx.costCenterIds.includes(l.costCenterId))) {
    throw new Error("STP按分テンプレートには、STPプロジェクトのコストセンターを1つ以上含める必要があります");
  }

  return updateAllocationTemplate(id, data);
}
