// 資料PDF生成の排他ロック（資料種別ごと独立）。
// HojoApplicationSupport の {trainingReport|supportApplication|businessPlan}RunningAt を
// アトミックに set/clear することで、同じ申請者の同じ資料の重複実行を防ぐ。

import { prisma } from "@/lib/prisma";
import type { RpaDocKey } from "@/lib/hojo/rpa-document-config";

export const RPA_STALE_MS = 10 * 60 * 1000; // 10分以上前のフラグは stale として無視

const FIELD_BY_DOC: Record<RpaDocKey, "trainingReportRunningAt" | "supportApplicationRunningAt" | "businessPlanRunningAt"> = {
  trainingReport: "trainingReportRunningAt",
  supportApplication: "supportApplicationRunningAt",
  businessPlan: "businessPlanRunningAt",
};

/**
 * 資料種別ごとのロックを試みる。成功したら true、既に誰かが走っているなら false。
 * null または 10分より古い値なら上書きしてセットできる（アトミック）。
 */
export async function acquirePdfGenerationLock(
  applicationSupportId: number,
  docType: RpaDocKey,
): Promise<boolean> {
  const field = FIELD_BY_DOC[docType];
  const staleBefore = new Date(Date.now() - RPA_STALE_MS);
  const result = await prisma.hojoApplicationSupport.updateMany({
    where: {
      id: applicationSupportId,
      OR: [{ [field]: null }, { [field]: { lt: staleBefore } }],
    },
    data: { [field]: new Date() },
  });
  return result.count > 0;
}

/** 資料種別ごとのロックを解放（セットされていなくても安全）。 */
export async function releasePdfGenerationLock(
  applicationSupportId: number,
  docType: RpaDocKey,
): Promise<void> {
  const field = FIELD_BY_DOC[docType];
  await prisma.hojoApplicationSupport
    .update({ where: { id: applicationSupportId }, data: { [field]: null } })
    .catch((e) => console.error(`[releasePdfGenerationLock:${docType}] error:`, e));
}
