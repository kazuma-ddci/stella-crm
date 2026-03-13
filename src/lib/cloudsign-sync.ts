/**
 * CloudSign同期ヘルパー
 *
 * Webhook・ポーリング両方から呼べる共通関数群。
 * - saveSignedPdf: 締結済みPDFをダウンロードして保存
 * - syncContractStatus: ステータス同期・PDF保存・タイトル同期を一括実行
 */

import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { recordStatusChangeIfNeeded } from "@/lib/contract-status/record-status-change";
import * as fs from "fs/promises";
import * as path from "path";

type ContractForSync = {
  id: number;
  currentStatusId: number | null;
  cloudsignStatus: string | null;
  cloudsignTitle: string | null;
  cloudsignDocumentId: string | null;
  cloudsignSelfSigningEmailId?: number | null;
  cloudsignSelfSignedAt?: Date | null;
};

/**
 * 締結済みPDFをCloudSign APIからダウンロードしてローカルに保存
 *
 * CloudSign APIでは /documents/{id}/files/{fileId} で個別ファイルを取得する。
 * ドキュメントに含まれる全ファイルをダウンロードし、最初のファイルのパスを返す。
 */
export async function saveSignedPdf(
  token: string,
  documentId: string,
  contractId: number,
  files: { id: string; name: string }[]
): Promise<{ filePath: string; fileName: string }> {
  if (files.length === 0) {
    throw new Error("ドキュメントにファイルが含まれていません");
  }

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = now.getTime();

  const dirPath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "contracts",
    year,
    month
  );
  await fs.mkdir(dirPath, { recursive: true });

  let firstFilePath = "";
  let firstFileName = "";

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pdfBuffer = await cloudsignClient.getDocumentFile(
      token,
      documentId,
      file.id
    );

    const suffix = files.length > 1 ? `_${i + 1}` : "";
    const fileName = `signed_${contractId}${suffix}_${timestamp}.pdf`;
    const fullPath = path.join(dirPath, fileName);
    await fs.writeFile(fullPath, pdfBuffer);

    if (i === 0) {
      firstFilePath = `/uploads/contracts/${year}/${month}/${fileName}`;
      firstFileName = fileName;
    }
  }

  return { filePath: firstFilePath, fileName: firstFileName };
}

/**
 * CloudSignステータスをCRMに同期する共通関数
 *
 * - ステータスマッピング → DB更新（トランザクション）
 * - completed時: saveSignedPdf + signedDate設定
 * - タイトル差分があれば cloudsignTitle 更新
 * - 履歴記録（recordStatusChangeIfNeeded）
 */
export async function syncContractStatus(
  contract: ContractForSync,
  clientId: string | null,
  newCloudsignStatus: string,
  changedBy?: string
): Promise<{ updated: boolean; pdfSaved: boolean }> {
  // 既に同じステータスなら何もしない
  if (contract.cloudsignStatus === newCloudsignStatus) {
    return { updated: false, pdfSaved: false };
  }

  // 対応するCRMステータスを検索
  const targetStatus = await prisma.masterContractStatus.findFirst({
    where: {
      isActive: true,
      cloudsignStatusMapping: newCloudsignStatus,
    },
    select: { id: true },
  });

  // CloudSign APIからタイトルを取得（clientIdがある場合）
  let cloudTitle: string | null = null;
  let pdfResult: { filePath: string; fileName: string } | null = null;

  if (clientId && contract.cloudsignDocumentId) {
    try {
      const token = await cloudsignClient.getToken(clientId);
      const doc = await cloudsignClient.getDocument(
        token,
        contract.cloudsignDocumentId
      );
      if (doc.title && doc.title !== contract.cloudsignTitle) {
        cloudTitle = doc.title;
      }

      // 自社署名完了チェック: participantのステータスが8(捺印/入力完了)以上
      if (
        contract.cloudsignSelfSigningEmailId &&
        !contract.cloudsignSelfSignedAt &&
        doc.participants
      ) {
        // 自社署名用メールアドレスを取得
        const selfEmail = await prisma.operatingCompanyEmail.findUnique({
          where: { id: contract.cloudsignSelfSigningEmailId },
          select: { email: true },
        });
        if (selfEmail) {
          const selfParticipant = doc.participants.find(
            (p) => p.email.toLowerCase() === selfEmail.email.toLowerCase()
          );
          // status 7=確認済み, 8=捺印/入力完了 → 署名完了とみなす
          if (selfParticipant && selfParticipant.status >= 7) {
            await prisma.masterContract.update({
              where: { id: contract.id },
              data: { cloudsignSelfSignedAt: new Date() },
            });
          }
        }
      }

      // completed時にPDFをダウンロード（ファイルID指定）
      if (newCloudsignStatus === "completed" && doc.files && doc.files.length > 0) {
        try {
          pdfResult = await saveSignedPdf(
            token,
            contract.cloudsignDocumentId,
            contract.id,
            doc.files.map((f) => ({ id: f.id, name: f.name }))
          );
        } catch (pdfErr) {
          // PDF保存失敗してもステータス更新は続行する。
          // 手動同期ボタンで後からPDF再取得可能
          console.error(
            `[CloudSign Sync] PDF保存失敗 (contract #${contract.id}). 手動同期で再取得してください:`,
            pdfErr
          );
        }
      }
    } catch (apiErr) {
      console.error(
        `[CloudSign Sync] API呼び出し失敗 (contract #${contract.id}):`,
        apiErr
      );
    }
  }

  // DB更新（トランザクション）
  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      cloudsignStatus: newCloudsignStatus,
    };

    if (targetStatus) {
      updateData.currentStatusId = targetStatus.id;
    }

    if (newCloudsignStatus === "completed") {
      updateData.cloudsignCompletedAt = new Date();
      updateData.signedDate = new Date();
    }

    if (cloudTitle) {
      updateData.cloudsignTitle = cloudTitle;
    }

    if (pdfResult) {
      updateData.filePath = pdfResult.filePath;
      updateData.fileName = pdfResult.fileName;
    }

    await tx.masterContract.update({
      where: { id: contract.id },
      data: updateData,
    });

    // ステータス履歴を記録
    if (targetStatus) {
      await recordStatusChangeIfNeeded(
        tx,
        contract.id,
        contract.currentStatusId,
        targetStatus.id,
        changedBy ?? "CloudSign同期"
      );
    }
  });

  return { updated: true, pdfSaved: !!pdfResult };
}
