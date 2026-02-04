import { prisma } from "@/lib/prisma";

/**
 * 提案書番号を自動生成
 * フォーマット: STP-P-YYYYMM-XXX
 * 例: STP-P-202602-001
 */
export async function generateProposalNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `STP-P-${yearMonth}-`;

  const count = await prisma.stpProposal.count({
    where: {
      proposalNumber: { startsWith: prefix },
    },
  });

  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
