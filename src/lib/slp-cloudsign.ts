/**
 * SLP (公的制度) 向け CloudSign 契約書送付ヘルパー
 *
 * GASで実装されていたフォーム→CloudSign送付のロジックをCRM側に移植。
 * 既存の cloudsignClient (src/lib/cloudsign.ts) を利用する。
 *
 * テンプレートIDの解決順序:
 * 1. SLPプロジェクト設定の「入会フォーム用契約種別」に紐付くCloudSignテンプレート
 * 2. 環境変数 SLP_CLOUDSIGN_TEMPLATE_ID
 * 3. フォールバック: GASと同じハードコード値
 */

import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { recordStatusChangeIfNeeded } from "@/lib/contract-status/record-status-change";

// フォールバック: 環境変数 or GASと同じデフォルト値
const FALLBACK_TEMPLATE_ID =
  process.env.SLP_CLOUDSIGN_TEMPLATE_ID || "01mtxrn6zyv4p85xf498m75p3fjvnfnw";

// 契約書の件名
const DOCUMENT_TITLE =
  "一般社団法人 公的制度教育推進協会(組合員契約書及び組合規定)";

/**
 * SLPプロジェクト情報を一括取得（ClientID + テンプレートID + ProjectID）
 */
async function getSlpCloudsignConfig(): Promise<{
  clientId: string;
  templateId: string;
  projectId: number;
}> {
  const project = await prisma.masterProject.findUnique({
    where: { code: "slp" },
    include: {
      operatingCompany: {
        select: { cloudsignClientId: true },
      },
      slpMemberContractType: {
        include: {
          cloudsignTemplates: {
            include: {
              template: {
                select: { cloudsignTemplateId: true, isActive: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error("SLPプロジェクトが見つかりません");
  }

  // ClientID
  const clientId = project.operatingCompany?.cloudsignClientId;
  if (!clientId) {
    throw new Error(
      "SLPプロジェクトの運営法人にCloudSign APIキーが設定されていません"
    );
  }

  // テンプレートID: 契約種別設定 → 環境変数 → フォールバック
  let templateId = FALLBACK_TEMPLATE_ID;

  const contractType = project.slpMemberContractType;
  if (contractType) {
    const activeTemplate = contractType.cloudsignTemplates.find(
      (link) => link.template.isActive
    );
    if (activeTemplate) {
      templateId = activeTemplate.template.cloudsignTemplateId;
    }
  }

  return { clientId, templateId, projectId: project.id };
}

/**
 * CloudSignで契約書を送付し、MasterContractレコードを作成する
 *
 * @returns { documentId, cloudsignUrl, contractId } 送付成功時
 */
export async function sendSlpContract(input: {
  email: string;
  name: string;
  slpMemberId?: number;
}): Promise<{ documentId: string; cloudsignUrl: string; contractId: number }> {
  const { clientId, templateId, projectId } = await getSlpCloudsignConfig();
  const token = await cloudsignClient.getToken(clientId);

  // 1. テンプレートから書類を作成
  const doc = await cloudsignClient.createDocument(
    token,
    templateId,
    DOCUMENT_TITLE
  );

  const documentId = doc.id;
  const participants = doc.participants || [];

  if (participants.length < 2) {
    throw new Error(
      "CloudSignテンプレートの宛先設定を確認してください（参加者が2名未満）"
    );
  }

  // 2. 受信者（participants[1]）のメール・名前を設定
  const recipientParticipant = participants[1];
  await cloudsignClient.updateParticipant(
    token,
    documentId,
    recipientParticipant.id,
    { email: input.email, name: input.name }
  );

  // 3. 書類を送信
  await cloudsignClient.sendDocument(token, documentId);

  const cloudsignUrl = `https://www.cloudsign.jp/documents/${documentId}`;

  // 4. 送付済みステータスを取得
  const sentStatus = await prisma.masterContractStatus.findFirst({
    where: { isActive: true, cloudsignStatusMapping: "sent" },
    select: { id: true },
  });

  // 5. MasterContractレコードを作成
  const contract = await prisma.masterContract.create({
    data: {
      projectId,
      slpMemberId: input.slpMemberId ?? null,
      contractType: "組合員契約書",
      title: `組合員契約書（${input.name}）`,
      signingMethod: "cloudsign",
      cloudsignDocumentId: documentId,
      cloudsignUrl,
      cloudsignStatus: "sent",
      cloudsignAutoSync: true,
      cloudsignSentAt: new Date(),
      currentStatusId: sentStatus?.id ?? null,
    },
  });

  // 6. ステータス履歴を記録
  if (sentStatus) {
    await recordStatusChangeIfNeeded(
      prisma,
      contract.id,
      null,
      sentStatus.id,
      "自動送付（入会フォーム）"
    );
  }

  return { documentId, cloudsignUrl, contractId: contract.id };
}

/**
 * CloudSignでリマインドを送付する（MasterContract経由）
 */
export async function sendSlpRemind(contractId: number): Promise<void> {
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    select: { cloudsignDocumentId: true },
  });
  if (!contract?.cloudsignDocumentId) {
    throw new Error("契約書にCloudSign書類IDがありません");
  }

  const { clientId } = await getSlpCloudsignConfig();
  const token = await cloudsignClient.getToken(clientId);

  await cloudsignClient.remindDocument(token, contract.cloudsignDocumentId);

  await prisma.masterContract.update({
    where: { id: contractId },
    data: { cloudsignLastRemindedAt: new Date() },
  });
}

/**
 * リマインド可能かどうか判定（送付から10日以内）
 */
export function isRemindable(contractSentDate: Date | null): boolean {
  if (!contractSentDate) return false;
  const daysSinceSent =
    (Date.now() - contractSentDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceSent <= 10;
}

/**
 * リマインド期限切れかどうか判定（送付から10日超過）
 */
export function isRemindExpired(contractSentDate: Date | null): boolean {
  if (!contractSentDate) return false;
  const daysSinceSent =
    (Date.now() - contractSentDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceSent > 10;
}
