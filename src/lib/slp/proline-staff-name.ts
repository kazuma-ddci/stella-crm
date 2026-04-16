import { prisma } from "@/lib/prisma";

/**
 * 担当者の「お客様向け表示名」を解決する。
 * Zoom案内メッセージなど、お客様LINEへ送る文面の {{担当者}} に入れる値。
 *
 * 優先順位:
 *   1. SlpProlineStaffMapping.prolineStaffName （最も信頼できる・お客様視点の名前）
 *   2. webhookで受信した生のproline名（briefingStaff/consultationStaff の生テキスト）
 *      ※ 商談タブで担当者を手動変更した場合に古い名前のまま残るため2番手
 *   3. CRMスタッフ名（最終フォールバック）
 */
export async function resolveProlineStaffName(params: {
  staffId: number;
  webhookFallback: string | null;
}): Promise<string | null> {
  // 1. SlpProlineStaffMapping から逆引き
  const mapping = await prisma.slpProlineStaffMapping.findFirst({
    where: { staffId: params.staffId },
    select: { prolineStaffName: true },
    orderBy: { id: "asc" }, // 複数マッピングある場合は最初に登録されたもの
  });
  if (mapping?.prolineStaffName?.trim()) {
    return mapping.prolineStaffName.trim();
  }

  // 2. webhookで受信したproline名（生テキスト）
  const fallback = params.webhookFallback?.trim();
  if (fallback) return fallback;

  // 3. 最終フォールバック: CRMスタッフ名
  const s = await prisma.masterStaff.findUnique({
    where: { id: params.staffId },
    select: { name: true },
  });
  return s?.name ?? null;
}
