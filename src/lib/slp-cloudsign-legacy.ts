/**
 * SLP レガシー CloudSign ヘルパー
 *
 * MasterContract移行前のデータ（SlpMember.documentIdのみ持つケース）用のフォールバック関数。
 * 新規契約書はすべてMasterContract経由で管理される。
 */

import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";

/**
 * レガシー: documentIdで直接リマインドを送付する
 */
export async function sendSlpRemindLegacy(documentId: string): Promise<void> {
  const project = await prisma.masterProject.findUnique({
    where: { code: "slp" },
    include: {
      operatingCompany: {
        select: { cloudsignClientId: true },
      },
    },
  });

  const clientId = project?.operatingCompany?.cloudsignClientId;
  if (!clientId) {
    throw new Error("SLPプロジェクトの運営法人にCloudSign APIキーが設定されていません");
  }

  const token = await cloudsignClient.getToken(clientId);
  await cloudsignClient.remindDocument(token, documentId);
}
