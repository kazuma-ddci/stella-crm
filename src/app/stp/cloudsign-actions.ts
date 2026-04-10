"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateContractNumber } from "@/lib/contracts/generate-number";
import { recordContractCreationInTx } from "@/lib/contract-status/record-status-change";
import { cloudsignClient } from "@/lib/cloudsign";
import { syncContractStatus, saveSignedPdf } from "@/lib/cloudsign-sync";
import { ok, err, type ActionResult } from "@/lib/action-result";

// ============================================
// Types
// ============================================

const STP_PROJECT_ID = 1;

type WidgetUpdate = {
  fileId: string;
  widgetId: string;
  widgetType: number; // 0=署名, 1=テキスト, 2=チェックボックス
  value: string;
};

type SendContractInput = {
  companyId: number;
  projectId: number;
  contractType: string;
  title: string;
  cloudsignTitle?: string;
  /** 既にAPI側で作成済みのドラフト書類ID */
  cloudsignDocumentId: string;
  /** テンプレート由来の送信先participantの設定 */
  recipients: { participantId: string; email: string; name?: string }[];
  /** 追加された受信者（テンプレートに含まれない、同意のみ） */
  newParticipants?: { email: string; name: string }[];
  /** 送信元が入力するwidgetの値 */
  widgetUpdates: WidgetUpdate[];
  assignedTo?: string;
  note?: string;
  sendImmediately: boolean;
  /** 既存の下書きMasterContractレコードID（再開時） */
  existingContractId?: number;
};

// ============================================
// 1. プロジェクトの運営法人取得
// ============================================

export async function getOperatingCompanyForProject(projectId: number) {
  const project = await prisma.masterProject.findUnique({
    where: { id: projectId },
    include: {
      operatingCompany: {
        select: {
          id: true,
          companyName: true,
          cloudsignClientId: true,
          cloudsignRegisteredEmail: true,
        },
      },
    },
  });
  return project?.operatingCompany ?? null;
}

// ============================================
// 2. 契約種別に紐づくテンプレート一覧取得
// ============================================

export async function getTemplatesForContractType(contractTypeId: number) {
  const links = await prisma.cloudSignTemplateContractType.findMany({
    where: { contractTypeId },
    include: {
      template: {
        select: {
          id: true,
          cloudsignTemplateId: true,
          name: true,
          description: true,
          isActive: true,
          operatingCompanyId: true,
        },
      },
    },
  });

  return links
    .map((l) => l.template)
    .filter((t) => t.isActive);
}

// ============================================
// 3. クラウドサイン経由で契約書を送付
// ============================================

/**
 * 既に作成済みのドラフト書類に対して:
 * 1. 送信先participant設定
 * 2. widget値設定
 * 3. 送信（即時の場合）
 * 4. DB契約書レコード作成
 */
export async function sendContractViaCloudsign(input: SendContractInput): Promise<ActionResult<{
  id: number;
  contractNumber: string | null;
  cloudsignDocumentId: string;
  cloudsignUrl: string;
  cloudsignStatus: string;
  selfSigningRequired: boolean;
}>> {
 try {
  const session = await getSession();
  const changedBy = session.name ?? null;

  // 運営法人を取得
  const operatingCompany = await getOperatingCompanyForProject(input.projectId);
  if (!operatingCompany?.cloudsignClientId) {
    return err(
      "運営法人にクラウドサインのクライアントIDが設定されていません"
    );
  }

  const token = await cloudsignClient.getToken(
    operatingCompany.cloudsignClientId
  );

  const documentId = input.cloudsignDocumentId;
  const cloudsignUrl = `https://www.cloudsign.jp/documents/${documentId}`;

  // Step 1a: テンプレート由来の送信先participantにメール・名前を設定
  // CloudSign APIは送信時に全participantのnameが必須
  // 送信元(order=0)のnameはクラウドサインのアカウント設定から自動で入るため更新不要
  for (const recipient of input.recipients) {
    await cloudsignClient.updateParticipant(
      token,
      documentId,
      recipient.participantId,
      { email: recipient.email, name: recipient.name }
    );
  }

  // Step 1b: 新規participantの追加（同意のみ、widget無し）
  if (input.newParticipants && input.newParticipants.length > 0) {
    for (const np of input.newParticipants) {
      await cloudsignClient.addParticipant(token, documentId, {
        email: np.email,
        name: np.name,
      });
    }
  }

  // Step 2: widgetの値を設定
  for (const wu of input.widgetUpdates) {
    if (wu.widgetType === 2) {
      // チェックボックス
      await cloudsignClient.updateWidgetCheckbox(
        token,
        documentId,
        wu.fileId,
        wu.widgetId,
        wu.value === "1" || wu.value === "true"
      );
    } else if (wu.widgetType === 1) {
      // フリーテキスト
      await cloudsignClient.updateWidgetText(
        token,
        documentId,
        wu.fileId,
        wu.widgetId,
        wu.value
      );
    }
    // widget_type === 0（署名）はAPI経由では設定しない
  }

  // Step 3: 即時送信の場合
  let cloudsignStatus: string;
  let cloudsignSentAt: Date | null = null;
  let selfSigningRequired = false;
  const registeredEmail = operatingCompany.cloudsignRegisteredEmail;

  if (input.sendImmediately) {
    await cloudsignClient.sendDocument(token, documentId);
    cloudsignStatus = "sent";
    cloudsignSentAt = new Date();

    // cloudsignRegisteredEmail が受信者に含まれているか自動判定
    if (registeredEmail) {
      const allRecipientEmails = [
        ...input.recipients.map((r) => r.email.trim().toLowerCase()),
        ...(input.newParticipants || []).map((p) => p.email.trim().toLowerCase()),
      ];
      selfSigningRequired = allRecipientEmails.includes(
        registeredEmail.trim().toLowerCase()
      );
    }
  } else {
    cloudsignStatus = "draft";
  }

  // 自社署名が必要な場合、対応するOperatingCompanyEmailを自動検索
  let selfSigningEmailId: number | null = null;
  if (selfSigningRequired && registeredEmail) {
    const matchingEmail = await prisma.operatingCompanyEmail.findFirst({
      where: {
        operatingCompanyId: operatingCompany.id,
        email: { equals: registeredEmail, mode: "insensitive" },
        deletedAt: null,
        imapHost: { not: null },
      },
      select: { id: true },
    });
    selfSigningEmailId = matchingEmail?.id ?? null;
  }

  // ステータスIDを取得
  const targetStatus = await prisma.masterContractStatus.findFirst({
    where: {
      isActive: true,
      cloudsignStatusMapping: cloudsignStatus,
    },
    select: { id: true },
  });

  // トランザクションで契約書作成or更新＋ステータス履歴記録
  const contract = await prisma.$transaction(async (tx) => {
    if (input.existingContractId) {
      // 既存の下書きレコードを更新
      const updated = await tx.masterContract.update({
        where: { id: input.existingContractId },
        data: {
          contractType: input.contractType,
          title: input.title,
          currentStatusId: targetStatus?.id ?? null,
          cloudsignStatus,
          cloudsignSentAt,
          cloudsignTitle: input.cloudsignTitle || input.title,
          cloudsignSelfSigningEmailId: selfSigningRequired ? selfSigningEmailId : null,
          assignedTo: input.assignedTo || null,
          note: input.note || null,
        },
      });

      if (targetStatus?.id) {
        await recordContractCreationInTx(
          tx,
          updated.id,
          targetStatus.id,
          changedBy ?? undefined
        );
      }

      return updated;
    }

    // 新規作成
    const contractNumber = await generateContractNumber();
    const created = await tx.masterContract.create({
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        contractNumber,
        contractType: input.contractType,
        title: input.title,
        currentStatusId: targetStatus?.id ?? null,
        signingMethod: "cloudsign",
        cloudsignDocumentId: documentId,
        cloudsignUrl,
        cloudsignStatus,
        cloudsignSentAt,
        cloudsignTitle: input.cloudsignTitle || input.title,
        cloudsignAutoSync: true,
        cloudsignSelfSigningEmailId: selfSigningRequired ? selfSigningEmailId : null,
        assignedTo: input.assignedTo || null,
        note: input.note || null,
      },
    });

    if (targetStatus?.id) {
      await recordContractCreationInTx(
        tx,
        created.id,
        targetStatus.id,
        changedBy ?? undefined
      );
    }

    return created;
  });

  revalidatePath("/stp/companies");
  revalidatePath("/stp/agents");
  revalidatePath("/stp/contracts");

  return ok({
    id: contract.id,
    contractNumber: contract.contractNumber,
    cloudsignDocumentId: documentId,
    cloudsignUrl,
    cloudsignStatus,
    selfSigningRequired,
  });
 } catch (e) {
  console.error("[sendContractViaCloudsign] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

// ============================================
// 4. ドラフト作成時にDBに保存
// ============================================

export async function saveDraftContract(input: {
  companyId: number;
  projectId: number;
  contractType: string;
  title: string;
  cloudsignTitle?: string;
  cloudsignDocumentId: string;
  assignedTo?: string;
  note?: string;
}): Promise<ActionResult<{ id: number; contractNumber: string }>> {
 try {
  const session = await getSession();
  const changedBy = session.name ?? null;

  const contractNumber = await generateContractNumber();
  const cloudsignUrl = `https://www.cloudsign.jp/documents/${input.cloudsignDocumentId}`;

  const targetStatus = await prisma.masterContractStatus.findFirst({
    where: { isActive: true, cloudsignStatusMapping: "draft" },
    select: { id: true },
  });

  const contract = await prisma.$transaction(async (tx) => {
    const created = await tx.masterContract.create({
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        contractNumber,
        contractType: input.contractType,
        title: input.title,
        currentStatusId: targetStatus?.id ?? null,
        signingMethod: "cloudsign",
        cloudsignDocumentId: input.cloudsignDocumentId,
        cloudsignUrl,
        cloudsignStatus: "draft",
        cloudsignTitle: input.cloudsignTitle || input.title,
        cloudsignAutoSync: true,
        assignedTo: input.assignedTo || null,
        note: input.note || null,
      },
    });

    if (targetStatus?.id) {
      await recordContractCreationInTx(
        tx,
        created.id,
        targetStatus.id,
        changedBy ?? undefined
      );
    }

    return created;
  });

  revalidatePath("/stp/companies");
  revalidatePath("/stp/contracts");

  return ok({ id: contract.id, contractNumber: contract.contractNumber || "" });
 } catch (e) {
  console.error("[saveDraftContract] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

// ============================================
// 5. 下書き削除
// ============================================

export async function deleteDraftContract(contractId: number): Promise<ActionResult> {
 try {
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      cloudsignDocumentId: true,
      cloudsignStatus: true,
      projectId: true,
    },
  });

  if (!contract) return err("契約書が見つかりません");
  if (contract.cloudsignStatus !== "draft") {
    return err("下書き以外の契約書は削除できません");
  }

  // CloudSign API から削除（失敗してもDB削除は続行）
  if (contract.cloudsignDocumentId) {
    try {
      const operatingCompany = await getOperatingCompanyForProject(contract.projectId);
      if (operatingCompany?.cloudsignClientId) {
        const token = await cloudsignClient.getToken(operatingCompany.cloudsignClientId);
        await cloudsignClient.deleteDocument(token, contract.cloudsignDocumentId);
      }
    } catch (err) {
      console.error("CloudSign側の削除に失敗（DB削除は続行）:", err);
    }
  }

  // ステータス履歴も削除
  await prisma.masterContractStatusHistory.deleteMany({
    where: { contractId },
  });

  // 物理削除（下書きは監査証跡不要）
  await prisma.masterContract.delete({ where: { id: contractId } });

  revalidatePath("/stp/companies");
  revalidatePath("/stp/contracts");
  return ok();
 } catch (e) {
  console.error("[deleteDraftContract] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

// ============================================
// 6. 企業の下書き一覧取得
// ============================================

export async function getDraftsForCompany(companyId: number) {
  const drafts = await prisma.masterContract.findMany({
    where: {
      companyId,
      cloudsignStatus: "draft",
    },
    select: {
      id: true,
      contractNumber: true,
      title: true,
      contractType: true,
      cloudsignDocumentId: true,
      cloudsignTitle: true,
      assignedTo: true,
      note: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return drafts.map((d) => ({
    id: d.id,
    contractNumber: d.contractNumber || "",
    title: d.title,
    contractType: d.contractType,
    cloudsignDocumentId: d.cloudsignDocumentId,
    cloudsignTitle: d.cloudsignTitle,
    assignedTo: d.assignedTo,
    note: d.note,
    createdAt: d.createdAt.toISOString(),
  }));
}

// ============================================
// 7. 手動ステータス同期
// ============================================

/**
 * 単一契約のCloudSignステータスを手動で同期
 */
export async function syncContractCloudsignStatus(contractId: number): Promise<ActionResult<{ previousStatus: string | null; newStatus: string }>> {
 try {
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      currentStatusId: true,
      cloudsignStatus: true,
      cloudsignTitle: true,
      cloudsignDocumentId: true,
      cloudsignSelfSigningEmailId: true,
      cloudsignSelfSignedAt: true,
      filePath: true,
      projectId: true,
    },
  });

  if (!contract || !contract.cloudsignDocumentId) {
    return err("CloudSign連携契約が見つかりません");
  }

  const operatingCompany = contract.projectId
    ? await getOperatingCompanyForProject(contract.projectId)
    : null;

  if (!operatingCompany?.cloudsignClientId) {
    return err("運営法人のクラウドサインClientIDが未設定です");
  }

  const token = await cloudsignClient.getToken(operatingCompany.cloudsignClientId);
  const doc = await cloudsignClient.getDocument(token, contract.cloudsignDocumentId);

  // CloudSign APIステータス → CRMステータス名
  const mappedStatus = mapCloudsignApiStatus(doc.status, doc);
  if (!mappedStatus) {
    return err(`未知のCloudSignステータス: ${doc.status}`);
  }

  const session = await getSession();
  const changedBy = session.name ?? "手動同期";

  // 既にcompletedでPDFが未取得の場合、PDF再取得を試みる
  if (
    mappedStatus === "completed" &&
    contract.cloudsignStatus === "completed" &&
    !contract.filePath
  ) {
    try {
      const pdfResult = await saveSignedPdf(
        token,
        contract.cloudsignDocumentId,
        contract.id,
        doc.files.map((f) => ({ id: f.id, name: f.name }))
      );
      await prisma.masterContract.update({
        where: { id: contract.id },
        data: { filePath: pdfResult.filePath, fileName: pdfResult.fileName },
      });
    } catch (pdfErr) {
      console.error(
        `[CloudSign Sync] PDF再取得失敗 (contract #${contract.id}):`,
        pdfErr
      );
    }

    revalidatePath("/stp/companies");
    revalidatePath("/stp/agents");
    revalidatePath("/stp/contracts");
    return ok({ previousStatus: contract.cloudsignStatus, newStatus: mappedStatus });
  }

  await syncContractStatus(
    {
      id: contract.id,
      currentStatusId: contract.currentStatusId,
      cloudsignStatus: contract.cloudsignStatus,
      cloudsignTitle: contract.cloudsignTitle,
      cloudsignDocumentId: contract.cloudsignDocumentId,
    },
    operatingCompany.cloudsignClientId,
    mappedStatus,
    changedBy
  );

  revalidatePath("/stp/companies");
  revalidatePath("/stp/agents");
  revalidatePath("/stp/contracts");

  return ok({ previousStatus: contract.cloudsignStatus, newStatus: mappedStatus });
 } catch (e) {
  console.error("[syncContractCloudsignStatus] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

// ============================================
// 8. 自動同期トグル
// ============================================

/**
 * CloudSign自動同期のON/OFF切替
 * ONに戻す場合は最新ステータスを即時同期
 */
export async function toggleCloudsignAutoSync(
  contractId: number,
  enabled: boolean
): Promise<ActionResult> {
 try {
  if (enabled) {
    // ONに戻す場合: 最新ステータスを同期してからフラグを更新
    // 同期失敗時はフラグを更新せずエラーを返す
    const syncResult = await syncContractCloudsignStatus(contractId);
    if (!syncResult.ok) return syncResult;
  }

  await prisma.masterContract.update({
    where: { id: contractId },
    data: { cloudsignAutoSync: enabled },
  });

  revalidatePath("/stp/companies");
  revalidatePath("/stp/agents");
  revalidatePath("/stp/contracts");
  return ok();
 } catch (e) {
  console.error("[toggleCloudsignAutoSync] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

// ============================================
// 9. ドキュメントID手動紐付け＆同期
// ============================================

/**
 * CloudSignドキュメントIDを手動で紐付けて同期する
 * 先にCloudSign APIでドキュメントの存在を検証してからDB保存する
 */
export async function linkCloudsignDocument(
  contractId: number,
  documentId: string
): Promise<ActionResult<{ previousStatus: string | null; newStatus: string }>> {
 try {
  const trimmedId = documentId.trim();

  // 契約のプロジェクトIDを取得
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    select: { projectId: true },
  });
  if (!contract) {
    return err("契約が見つかりません");
  }

  const operatingCompany = contract.projectId
    ? await getOperatingCompanyForProject(contract.projectId)
    : null;
  if (!operatingCompany?.cloudsignClientId) {
    return err("運営法人のクラウドサインClientIDが未設定です");
  }

  // 先にCloudSign APIでドキュメントの存在を検証
  const token = await cloudsignClient.getToken(operatingCompany.cloudsignClientId);
  let doc;
  try {
    doc = await cloudsignClient.getDocument(token, trimmedId);
  } catch {
    return err("CloudSignにこのドキュメントIDの書類が見つかりません。IDを確認してください。");
  }

  // 検証OK → DB保存
  const mappedStatus = mapCloudsignApiStatus(doc.status, doc);

  // 自社署名判定: participantに自社のregisteredEmailが含まれているかチェック
  let selfSigningEmailId: number | null = null;
  const registeredEmail = operatingCompany.cloudsignRegisteredEmail;
  if (registeredEmail) {
    const recipientEmails = doc.participants
      .filter((p) => p.order >= 1)
      .map((p) => p.email.trim().toLowerCase());
    const isSelfSigning = recipientEmails.includes(
      registeredEmail.trim().toLowerCase()
    );
    if (isSelfSigning) {
      const matchingEmail = await prisma.operatingCompanyEmail.findFirst({
        where: {
          operatingCompanyId: operatingCompany.id,
          email: { equals: registeredEmail, mode: "insensitive" },
          deletedAt: null,
          imapHost: { not: null },
        },
        select: { id: true },
      });
      selfSigningEmailId = matchingEmail?.id ?? null;
    }
  }

  await prisma.masterContract.update({
    where: { id: contractId },
    data: {
      cloudsignDocumentId: trimmedId,
      cloudsignUrl: `https://www.cloudsign.jp/documents/${trimmedId}`,
      cloudsignAutoSync: true,
      signingMethod: "cloudsign",
      cloudsignStatus: mappedStatus,
      cloudsignSelfSigningEmailId: selfSigningEmailId,
    },
  });

  // ステータス同期
  const result = await syncContractCloudsignStatus(contractId);

  revalidatePath("/stp/companies");
  revalidatePath("/stp/agents");
  revalidatePath("/stp/contracts");

  return result;
 } catch (e) {
  console.error("[linkCloudsignDocument] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

/**
 * CloudSign APIステータスマッピング (Cronと共有)
 * CloudSign API v0.33.2 公式ステータス:
 *   0=下書き, 1=先方確認中, 2=締結完了, 3=取消/却下, 4=テンプレート, 13=インポート書類
 */
function mapCloudsignApiStatus(
  apiStatus: number,
  doc?: { participants?: { status?: number; order?: number }[] }
): string | null {
  switch (apiStatus) {
    case 0:
      return "draft";
    case 1:
      return "sent";
    case 2:
      return "completed";
    case 3: {
      // 破棄者の判定: participant個別ステータスから推定
      // participant status 9=却下(受信者), 10=取消(送信者)
      if (doc?.participants) {
        const hasRejected = doc.participants.some(
          (p) => p.order !== undefined && p.order >= 1 && p.status === 9
        );
        if (hasRejected) {
          return "canceled_by_recipient";
        }
      }
      // 受信者の却下が見つからなければ送信者による取消
      return "canceled_by_sender";
    }
    // status=4(テンプレート), status=13(インポート書類) は通常取得されないが、
    // 手動でdocumentIDを入力した場合等に到達しうる。同期対象外としてスキップ
    case 4:
    case 13:
      return null;
    default:
      console.warn(`[CloudSign] 未知のAPIステータス: ${apiStatus}`);
      return null;
  }
}

// ============================================
// 9. 送付モーダル用データ一括取得
// ============================================

export async function getCloudsignModalData(companyId: number) {
  const project = await prisma.masterProject.findUnique({
    where: { id: STP_PROJECT_ID },
    include: {
      operatingCompany: {
        select: {
          id: true,
          companyName: true,
          cloudsignClientId: true,
        },
      },
    },
  });

  const contractTypes = await prisma.contractType.findMany({
    where: { projectId: STP_PROJECT_ID, isActive: true },
    select: {
      id: true,
      name: true,
      cloudsignTemplates: {
        include: {
          template: {
            select: {
              id: true,
              cloudsignTemplateId: true,
              name: true,
              description: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  const contacts = await prisma.stellaCompanyContact.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { id: "asc" },
  });

  return {
    projectId: STP_PROJECT_ID,
    operatingCompany: project?.operatingCompany ?? null,
    contractTypes: contractTypes.map((ct) => ({
      id: ct.id,
      name: ct.name,
      templates: ct.cloudsignTemplates
        .map((link) => link.template)
        .filter((t) => t.isActive)
        .map((t) => ({
          id: t.id,
          cloudsignTemplateId: t.cloudsignTemplateId,
          name: t.name,
          description: t.description,
        })),
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      position: c.department,
    })),
  };
}

// ============================================
// 10-b. CloudSign自社署名URL取得（アクティブIMAPチェック）
// ============================================

/**
 * 契約書の自社署名URLを取得する。
 * DBにURLがなければIMAPを直接チェックして取得を試みる。
 */
export async function getCloudsignSelfSigningUrl(
  contractId: number
): Promise<{ url: string | null; status: "ready" | "pending" | "not_required" }> {
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    select: {
      cloudsignSelfSigningUrl: true,
      cloudsignSelfSigningEmailId: true,
      cloudsignDocumentId: true,
      cloudsignStatus: true,
    },
  });

  if (!contract || !contract.cloudsignSelfSigningEmailId) {
    return { url: null, status: "not_required" };
  }

  // 既に取得済み
  if (contract.cloudsignSelfSigningUrl) {
    return { url: contract.cloudsignSelfSigningUrl, status: "ready" };
  }

  // IMAPを直接チェック
  if (!contract.cloudsignDocumentId) {
    return { url: null, status: "pending" };
  }

  try {
    const emailAccount = await prisma.operatingCompanyEmail.findUnique({
      where: { id: contract.cloudsignSelfSigningEmailId },
      select: {
        id: true,
        imapHost: true,
        imapPort: true,
        imapUser: true,
        imapPass: true,
        lastCheckedCloudsignUid: true,
      },
    });

    if (!emailAccount?.imapHost || !emailAccount.imapUser || !emailAccount.imapPass) {
      return { url: null, status: "pending" };
    }

    const { fetchCloudSignSigningEmails } = await import("@/lib/email/imap-client");

    // アクティブ検索モード: ドキュメントIDを指定して直近7日分のCloudSignメールから検索
    // メール本文にドキュメントIDが含まれているかで照合する
    const emails = await fetchCloudSignSigningEmails(
      {
        host: emailAccount.imapHost,
        port: emailAccount.imapPort || 993,
        user: emailAccount.imapUser,
        pass: emailAccount.imapPass,
        tls: true,
      },
      0,
      contract.cloudsignDocumentId
    );

    // メール本文にドキュメントIDが含まれるものを探す
    const matchedEmail = emails.find(
      (e) => e.rawContent.includes(contract.cloudsignDocumentId!)
    );

    if (matchedEmail) {
      await prisma.masterContract.update({
        where: { id: contractId },
        data: { cloudsignSelfSigningUrl: matchedEmail.signingUrl },
      });

      console.log(
        `[CloudSign] 署名URL取得成功 (contract #${contractId}): ${matchedEmail.signingUrl}`
      );
      return { url: matchedEmail.signingUrl, status: "ready" };
    }

    // デバッグログ
    if (emails.length > 0) {
      console.log(
        `[CloudSign] メール${emails.length}件取得したがドキュメントID「${contract.cloudsignDocumentId}」がメール本文に含まれず (contract #${contractId})`
      );
      // 最初のメールの件名とURLをログ出力
      for (const e of emails.slice(0, 3)) {
        console.log(
          `  - 件名: ${e.subject}, URL: ${e.signingUrl}`
        );
      }
    } else {
      console.log(
        `[CloudSign] CloudSignメールが見つかりません (contract #${contractId})`
      );
    }
  } catch (err) {
    console.error(`[CloudSign] IMAP check failed for contract ${contractId}:`, err);
  }

  return { url: null, status: "pending" };
}

// ============================================
// 10. CloudSignリマインド送信
// ============================================

/**
 * 送付済み書類のリマインドを送信する
 * CloudSign APIでは送信済み書類に対するPOST /documents/{id} がリマインドとして機能し、
 * 現在確認作業を行っている相手にリマインドメールが送られる
 */
export async function remindCloudsignDocument(
  contractId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const contract = await prisma.masterContract.findUnique({
      where: { id: contractId },
      select: {
        cloudsignDocumentId: true,
        cloudsignStatus: true,
        projectId: true,
        title: true,
      },
    });

    if (!contract) {
      return { success: false, error: "契約書が見つかりません" };
    }

    if (!contract.cloudsignDocumentId) {
      return { success: false, error: "CloudSign未連携の契約書です" };
    }

    if (contract.cloudsignStatus !== "sent") {
      return { success: false, error: "送付済みの契約書のみリマインドできます" };
    }

    const operatingCompany = await getOperatingCompanyForProject(contract.projectId);
    if (!operatingCompany?.cloudsignClientId) {
      return { success: false, error: "運営法人のクラウドサインClientIDが未設定です" };
    }

    const token = await cloudsignClient.getToken(operatingCompany.cloudsignClientId);
    await cloudsignClient.remindDocument(token, contract.cloudsignDocumentId);

    // リマインド送信日時をDBに記録
    await prisma.masterContract.update({
      where: { id: contractId },
      data: { cloudsignLastRemindedAt: new Date() },
    });

    revalidatePath("/stp/contracts");
    return { success: true };
  } catch (error) {
    console.error("Failed to send CloudSign reminder:", error);
    return { success: false, error: "リマインドの送信に失敗しました" };
  }
}
