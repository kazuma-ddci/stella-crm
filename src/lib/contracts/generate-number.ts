import { prisma } from "@/lib/prisma";

const STP_PROJECT_ID = 1; // 採用ブースト

/**
 * 契約番号を自動生成
 * フォーマット: STP-YYYYMM-XXX（XXXは月ごとの連番）
 * @returns 生成された契約番号
 */
export async function generateContractNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `STP-${yearMonth}-`;

  // 今月の契約書の数を取得
  const count = await prisma.masterContract.count({
    where: {
      projectId: STP_PROJECT_ID,
      contractNumber: {
        startsWith: prefix,
      },
    },
  });

  const sequenceNumber = String(count + 1).padStart(3, "0");
  return `${prefix}${sequenceNumber}`;
}

/**
 * 次の契約番号をプレビュー取得（保存前に表示用）
 * @returns 次の契約番号
 */
export async function getNextContractNumber(): Promise<string> {
  return generateContractNumber();
}
