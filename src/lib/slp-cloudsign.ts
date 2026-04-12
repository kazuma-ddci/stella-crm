/**
 * SLP (公的制度) 向け CloudSign 契約書送付ヘルパー
 *
 * GASで実装されていたフォーム→CloudSign送付のロジックをCRM側に移植。
 * 既存の cloudsignClient (src/lib/cloudsign.ts) を利用する。
 *
 * テンプレートIDの解決順序:
 * 1. SLPプロジェクト設定の「入会フォーム回答後の自動送付契約書」で選択されたCloudSignテンプレート
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
 * SLPプロジェクト情報を一括取得（ClientID + テンプレートID + テンプレート名 + 契約種別名 + ProjectID）
 */
async function getSlpCloudsignConfig(): Promise<{
  clientId: string;
  templateId: string;
  templateName: string | null;
  contractTypeName: string | null;
  projectId: number;
}> {
  const project = await prisma.masterProject.findUnique({
    where: { code: "slp" },
    include: {
      operatingCompany: {
        select: { cloudsignClientId: true },
      },
      slpMemberCloudSignTemplate: {
        include: {
          contractTypes: {
            include: {
              contractType: { select: { name: true } },
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

  // テンプレートID/名・契約種別名: 選択済みテンプレート → 環境変数 → フォールバック
  let templateId = FALLBACK_TEMPLATE_ID;
  let templateName: string | null = null;
  let contractTypeName: string | null = null;

  const selectedTemplate = project.slpMemberCloudSignTemplate;
  if (selectedTemplate && selectedTemplate.isActive) {
    templateId = selectedTemplate.cloudsignTemplateId;
    templateName = selectedTemplate.name;
    // 契約種別名は紐付いた最初の契約種別の名前を使用
    const firstLink = selectedTemplate.contractTypes[0];
    if (firstLink) {
      contractTypeName = firstLink.contractType.name;
    }
  }

  return {
    clientId,
    templateId,
    templateName,
    contractTypeName,
    projectId: project.id,
  };
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
  const { clientId, templateId, templateName, contractTypeName, projectId } =
    await getSlpCloudsignConfig();
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
  // 契約種別: SLPプロジェクト設定「入会フォーム用契約種別」の名前
  // タイトル: 自動送付で使ったCloudSignテンプレートの名前
  // いずれも未設定の場合は従来のフォールバック文字列を使う
  const contract = await prisma.masterContract.create({
    data: {
      projectId,
      slpMemberId: input.slpMemberId ?? null,
      contractType: contractTypeName ?? "組合員契約書",
      title: templateName ?? `組合員契約書（${input.name}）`,
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

/**
 * CloudSignの送信済み書類を取り消し（破棄）する
 * PUT /documents/{documentId}/decline
 */
export async function declineSlpContract(documentId: string): Promise<void> {
  const { clientId } = await getSlpCloudsignConfig();
  const token = await cloudsignClient.getToken(clientId);
  await cloudsignClient.declineDocument(token, documentId);
}

/**
 * 指定した組合員に対する送信エラー系の自動化エラーを解決済みにする
 * 新しい契約書が正常に送付された時に呼び出す
 */
export async function resolveRelatedAutomationErrors(
  memberUid: string,
  memberName: string
): Promise<void> {
  try {
    // detail JSON内にuidが含まれるcloudsign-bounce系 / slp-member-registration系の未解決エラーを解決
    const unresolvedErrors = await prisma.automationError.findMany({
      where: {
        resolved: false,
        source: {
          in: [
            "cloudsign-bounce",
            "slp-member-registration",
            "cloudsign-webhook-bounced-notify",
          ],
        },
      },
      select: { id: true, detail: true },
    });

    const idsToResolve: number[] = [];
    for (const err of unresolvedErrors) {
      if (!err.detail) continue;
      try {
        const detail = JSON.parse(err.detail);
        if (detail.uid === memberUid || detail.memberName === memberName) {
          idsToResolve.push(err.id);
        }
      } catch {
        // JSON parse failure, skip
      }
    }

    if (idsToResolve.length > 0) {
      await prisma.automationError.updateMany({
        where: { id: { in: idsToResolve } },
        data: { resolved: true },
      });
      console.log(
        `[resolveRelatedAutomationErrors] Resolved ${idsToResolve.length} errors for uid=${memberUid}`
      );
    }
  } catch (err) {
    console.error("[resolveRelatedAutomationErrors] Error:", err);
  }
}

/**
 * SlpContractAttempt（送付履歴）テーブルにレコードを作成する
 * sequence は同じ組合員の既存レコードの最大値 + 1 を自動計算
 */
export async function recordContractAttempt(data: {
  slpMemberId: number;
  email: string;
  documentId?: string | null;
  cloudsignUrl?: string | null;
  sendResult: "delivered" | "bounced" | "api_error";
  cloudsignStatus?: string | null;
  triggerType: "initial" | "bounce_fix" | "email_change" | "staff_manual";
}) {
  // sequence を自動計算（同じ組合員の max(sequence) + 1）
  // 並行性対応: 一意制約(slpMemberId, sequence)違反時は最大3回リトライ
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const maxResult = await prisma.slpContractAttempt.aggregate({
      where: { slpMemberId: data.slpMemberId },
      _max: { sequence: true },
    });
    const sequence = (maxResult._max.sequence ?? 0) + 1 + attempt;

    try {
      return await prisma.slpContractAttempt.create({
        data: {
          slpMemberId: data.slpMemberId,
          email: data.email,
          documentId: data.documentId ?? null,
          cloudsignUrl: data.cloudsignUrl ?? null,
          sendResult: data.sendResult,
          cloudsignStatus: data.cloudsignStatus ?? null,
          triggerType: data.triggerType,
          sequence,
        },
      });
    } catch (err) {
      // P2002 = Unique constraint violation
      const isUniqueErr =
        err && typeof err === "object" && "code" in err && err.code === "P2002";
      if (isUniqueErr && attempt < MAX_RETRIES - 1) {
        // 次のsequenceで再試行
        continue;
      }
      throw err;
    }
  }
  throw new Error("送付履歴の記録に失敗しました（sequence競合）");
}
