import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cloudsign/webhook
 *
 * CloudSignからのWebhook通知を受信し、契約書ステータスを自動更新する。
 *
 * CloudSign Webhook イベント:
 * - status=2 (completed): 全員署名完了 → ステータスを「締結済み」に
 * - status=3 (canceled): 送信取消・拒否 → ステータスを「破棄」に
 *
 * クラウドサイン側の設定:
 *   管理画面 > 設定 > Web API > Webhook URL に以下を登録
 *   本番: https://<本番ドメイン>/api/cloudsign/webhook
 *   ステージング: https://<ステージングドメイン>/api/cloudsign/webhook
 */

// CloudSign webhook status codes
const CS_STATUS_COMPLETED = 2;
const CS_STATUS_CANCELED = 3;

type WebhookPayload = {
  documentID: string;
  status: number;
  userID?: string;
  email?: string;
  text?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Webhook認証: CLOUDSIGN_WEBHOOK_SECRET が設定されている場合はトークン検証
    const webhookSecret = process.env.CLOUDSIGN_WEBHOOK_SECRET;
    if (webhookSecret) {
      const url = new URL(request.url);
      const token = url.searchParams.get("token");
      if (token !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body: WebhookPayload = await request.json();
    const { documentID, status, email } = body;

    console.log(`[CloudSign Webhook] documentID=${documentID}, status=${status}, email=${email}`);

    if (!documentID) {
      return NextResponse.json({ error: "documentID is required" }, { status: 400 });
    }

    // CloudSign Document ID からCRM内の契約書を検索
    const contract = await prisma.masterContract.findFirst({
      where: { cloudsignDocumentId: documentID },
      select: {
        id: true,
        currentStatusId: true,
        cloudsignStatus: true,
        cloudsignTitle: true,
        projectId: true,
      },
    });

    if (!contract) {
      console.log(`[CloudSign Webhook] Contract not found for documentID=${documentID}`);
      return NextResponse.json({ ok: true, message: "contract not found, skipped" });
    }

    // ステータスマッピング
    let newCloudsignStatus: string | null = null;

    if (status === CS_STATUS_COMPLETED) {
      newCloudsignStatus = "completed";
    } else if (status === CS_STATUS_CANCELED) {
      // 破棄者の判定: 運営会社のメールアドレスと一致するか
      const project = contract.projectId
        ? await prisma.masterProject.findUnique({
            where: { id: contract.projectId },
            include: {
              operatingCompany: {
                select: { cloudsignRegisteredEmail: true, cloudsignClientId: true },
              },
            },
          })
        : null;

      const registeredEmail = project?.operatingCompany?.cloudsignRegisteredEmail;
      if (registeredEmail && email && registeredEmail.toLowerCase() === email.toLowerCase()) {
        newCloudsignStatus = "canceled_by_sender";
      } else {
        newCloudsignStatus = "canceled_by_recipient";
      }
    }

    if (!newCloudsignStatus) {
      console.log(`[CloudSign Webhook] Unhandled status=${status}, skipped`);
      return NextResponse.json({ ok: true, message: "unhandled status, skipped" });
    }

    // 既に同じステータスなら更新しない
    if (contract.cloudsignStatus === newCloudsignStatus) {
      console.log(`[CloudSign Webhook] Status unchanged (${newCloudsignStatus}), skipped`);
      return NextResponse.json({ ok: true, message: "status unchanged, skipped" });
    }

    // 運営法人のcloudsignClientIdを取得（PDF保存用）
    const project = contract.projectId
      ? await prisma.masterProject.findUnique({
          where: { id: contract.projectId },
          include: {
            operatingCompany: {
              select: { cloudsignClientId: true },
            },
          },
        })
      : null;
    const clientId = project?.operatingCompany?.cloudsignClientId;

    // 共通ヘルパーでステータス同期
    const { syncContractStatus } = await import("@/lib/cloudsign-sync");
    await syncContractStatus(
      {
        id: contract.id,
        currentStatusId: contract.currentStatusId,
        cloudsignStatus: contract.cloudsignStatus,
        cloudsignTitle: contract.cloudsignTitle,
        cloudsignDocumentId: documentID,
      },
      clientId || null,
      newCloudsignStatus,
      "CloudSign Webhook"
    );

    console.log(
      `[CloudSign Webhook] Updated contract #${contract.id}: ${contract.cloudsignStatus} → ${newCloudsignStatus}`
    );

    return NextResponse.json({ ok: true, message: "status updated" });
  } catch (error) {
    console.error("[CloudSign Webhook] Error:", error);
    // CloudSign側にリトライさせないため200を返す（内部エラーはログで追跡）
    return NextResponse.json({ ok: false, message: "internal error" });
  }
}

// GET: ヘルスチェック（Webhook URL疎通確認用）
export async function GET() {
  return NextResponse.json({ ok: true, service: "cloudsign-webhook" });
}
