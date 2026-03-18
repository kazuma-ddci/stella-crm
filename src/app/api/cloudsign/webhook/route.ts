import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncContractStatus } from "@/lib/cloudsign-sync";
import { logAutomationError } from "@/lib/automation-error";

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
    // Webhook認証: CLOUDSIGN_WEBHOOK_SECRET が設定されている場合のみトークン検証
    // CloudSignのWebhookには独自の署名機構がないため、シークレット未設定でも受け付ける
    const webhookSecret = process.env.CLOUDSIGN_WEBHOOK_SECRET;
    if (webhookSecret) {
      const url = new URL(request.url);
      const token = url.searchParams.get("token");
      if (token !== webhookSecret) {
        console.warn("[CloudSign Webhook] トークン不一致。不正なリクエストの可能性があります。");
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
        cloudsignDocumentId: true,
        cloudsignAutoSync: true,
        projectId: true,
      },
    });

    if (!contract) {
      // MasterContractに見つからない場合、SLPメンバーを検索
      const slpHandled = await handleSlpMemberWebhook(documentID, status);
      if (slpHandled) {
        return NextResponse.json({ ok: true, message: "slp member status updated" });
      }

      console.log(`[CloudSign Webhook] Contract not found for documentID=${documentID}`);
      return NextResponse.json({ ok: true, message: "contract not found, skipped" });
    }

    // 運営法人情報を1回で取得（破棄者判定 + PDF保存の両方で使用）
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

    // ステータスマッピング
    let newCloudsignStatus: string | null = null;

    if (status === CS_STATUS_COMPLETED) {
      newCloudsignStatus = "completed";
    } else if (status === CS_STATUS_CANCELED) {
      // 破棄者の判定: 運営会社のメールアドレスと一致するか
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

    // 自動同期OFFの場合: cloudsignStatusのみ更新してCRMステータスは変更しない
    if (!contract.cloudsignAutoSync) {
      await prisma.masterContract.update({
        where: { id: contract.id },
        data: { cloudsignStatus: newCloudsignStatus },
      });
      console.log(
        `[CloudSign Webhook] AutoSync OFF: cloudsignStatus only updated for contract #${contract.id}: ${contract.cloudsignStatus} → ${newCloudsignStatus}`
      );
      return NextResponse.json({ ok: true, message: "cloudsign status updated (auto-sync off)" });
    }

    const clientId = project?.operatingCompany?.cloudsignClientId;

    // 共通ヘルパーでステータス同期
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
    await logAutomationError({
      source: "cloudsign-webhook",
      message: error instanceof Error ? error.message : "不明なエラー",
      detail: { error: String(error) },
    });
    // CloudSign側にリトライさせないため200を返す（内部エラーはログで追跡）
    return NextResponse.json({ ok: false, message: "internal error" });
  }
}

/**
 * SLPメンバーの契約書ステータスをWebhookで自動更新
 */
async function handleSlpMemberWebhook(
  documentID: string,
  status: number
): Promise<boolean> {
  const member = await prisma.slpMember.findFirst({
    where: { documentId: documentID, deletedAt: null },
  });

  if (!member) return false;

  const now = new Date();

  if (status === CS_STATUS_COMPLETED) {
    // 締結完了
    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        status: "組合員契約書締結",
        contractSignedDate: now,
      },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 組合員契約書締結`
    );

    // プロラインのビーコンURLを呼び出し（友だち追加カウント等の外部連携）
    try {
      const beaconUrl = `https://autosns.jp/api/call-beacon/xZugEszbhx/${member.uid}`;
      const res = await fetch(beaconUrl);
      console.log(
        `[CloudSign Webhook] ProLine beacon called for uid=${member.uid}, status=${res.status}`
      );
    } catch (beaconErr) {
      // ビーコン呼び出し失敗は契約締結処理をブロックしない
      console.error(
        `[CloudSign Webhook] ProLine beacon failed for uid=${member.uid}:`,
        beaconErr
      );
      await logAutomationError({
        source: "cloudsign-webhook",
        message: `ProLineビーコン呼び出し失敗 (uid=${member.uid})`,
        detail: { uid: member.uid, memberId: member.id, error: String(beaconErr) },
      });
    }

    return true;
  }

  if (status === CS_STATUS_CANCELED) {
    // 破棄
    await prisma.slpMember.update({
      where: { id: member.id },
      data: { status: "契約破棄" },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 契約破棄`
    );
    return true;
  }

  return false;
}

// GET: ヘルスチェック（Webhook URL疎通確認用）
export async function GET() {
  return NextResponse.json({ ok: true, service: "cloudsign-webhook" });
}
