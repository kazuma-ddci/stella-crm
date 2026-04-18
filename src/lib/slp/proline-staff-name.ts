import { prisma } from "@/lib/prisma";

/**
 * 担当者の「お客様向け表示名」を解決する。
 * Zoom案内メッセージや商談通知などで {{staffName}} に入れる値。
 *
 * 優先順位:
 *   1. プロラインWebhookで受信した生テキスト（SlpMeetingSession.prolineStaffName 等）
 *      ※ 顧客視点で実際にプロライン側に表示されていた担当者名そのまま
 *   2. CRMスタッフ名（MasterStaff.name）
 *   3. null（呼び出し側で「未登録」等のフォールバック文字列を当てる）
 */
export async function resolveProlineStaffName(params: {
  staffId: number | null;
  webhookFallback: string | null;
}): Promise<string | null> {
  // 1. webhookで受信した生テキスト最優先
  const fallback = params.webhookFallback?.trim();
  if (fallback) return fallback;

  // 2. CRMスタッフ名
  if (params.staffId !== null) {
    const s = await prisma.masterStaff.findUnique({
      where: { id: params.staffId },
      select: { name: true },
    });
    if (s?.name?.trim()) return s.name.trim();
  }

  // 3. 解決不能
  return null;
}
