import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncContractStatus } from "@/lib/cloudsign-sync";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm5ContractNotification } from "@/lib/proline-form";

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
        slpMemberId: true,
      },
    });

    if (!contract) {
      // MasterContractに見つからない場合、レガシーSLPメンバーを検索（移行前データ対応）
      const slpHandled = await handleSlpMemberWebhookLegacy(documentID, status);
      if (slpHandled) {
        return NextResponse.json({ ok: true, message: "slp member status updated (legacy)" });
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

    // SLPメンバーに紐づく契約書の場合、SlpMemberの旧カラムも同期 + SLP固有処理
    if (contract.slpMemberId) {
      await syncSlpMemberFromContract(contract.slpMemberId, newCloudsignStatus);
    }

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
 * MasterContract更新後、紐づくSlpMemberの旧カラムを同期し、SLP固有処理を実行
 */
async function syncSlpMemberFromContract(
  slpMemberId: number,
  newCloudsignStatus: string
): Promise<void> {
  const member = await prisma.slpMember.findUnique({
    where: { id: slpMemberId },
  });
  if (!member || member.deletedAt) return;

  if (newCloudsignStatus === "completed") {
    // 後方互換: SlpMemberのステータスも更新
    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        status: "組合員契約書締結",
        contractSignedDate: new Date(),
      },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 組合員契約書締結`
    );

    // Form5: 紹介者に契約締結通知を送信
    // 判定: 現在のfree1（紹介者UID）が form5NotifiedReferrerUid と異なる場合のみ送信
    // - 初回: form5NotifiedReferrerUid が null → 送信
    // - free1 が後から変わった: 別の紹介者 → 送信
    // - free1 が null（LINE未紐付け）: 送信しない（手動ボタンで対応）
    try {
      const lineFriend = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { free1: true },
      });
      const referrerUid = lineFriend?.free1;

      if (referrerUid && member.form5NotifiedReferrerUid !== referrerUid) {
        await submitForm5ContractNotification(
          referrerUid,
          member.lineName || "",
          member.name
        );
        await prisma.slpMember.update({
          where: { id: member.id },
          data: {
            form5NotifyCount: { increment: 1 },
            form5NotifiedReferrerUid: referrerUid,
          },
        });
        console.log(
          `[CloudSign Webhook] Form5 notification sent for member #${member.id}, referrer=${referrerUid}`
        );
      }
    } catch (form5Err) {
      console.error(
        `[CloudSign Webhook] Form5 notification failed for member #${member.id}:`,
        form5Err
      );
      await logAutomationError({
        source: "cloudsign-webhook/form5",
        message: `Form5契約締結通知失敗 (memberId=${member.id})`,
        detail: { memberId: member.id, uid: member.uid, error: String(form5Err) },
      });
    }

    // プロラインのビーコンURLを呼び出し（リッチメニュー切り替え）
    // 成功時に richmenuBeaconCalled=true を立てる
    // LINE未紐付けで失敗した場合は line-friend-webhook で後紐付け時に再実行される
    try {
      const lineFriendExists = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { id: true },
      });
      if (lineFriendExists) {
        const beaconUrl = `https://autosns.jp/api/call-beacon/xZugEszbhx/${member.uid}`;
        const res = await fetch(beaconUrl);
        console.log(
          `[CloudSign Webhook] ProLine beacon called for uid=${member.uid}, status=${res.status}`
        );
        if (res.ok) {
          await prisma.slpMember.update({
            where: { id: member.id },
            data: { richmenuBeaconCalled: true },
          });
        }
      } else {
        console.log(
          `[CloudSign Webhook] LINE friend not found for uid=${member.uid}, beacon will be called on line-friend-webhook`
        );
      }
    } catch (beaconErr) {
      console.error(
        `[CloudSign Webhook] ProLine beacon failed for uid=${member.uid}:`,
        beaconErr
      );
      await logAutomationError({
        source: "cloudsign-webhook",
        message: `プロラインビーコン呼び出し失敗 (uid=${member.uid})`,
        detail: {
          uid: member.uid,
          memberId: member.id,
          error: String(beaconErr),
          retryAction: "slp-richmenu-beacon",
        },
      });
    }
  } else if (newCloudsignStatus === "canceled_by_sender" || newCloudsignStatus === "canceled_by_recipient") {
    // 後方互換: 破棄
    await prisma.slpMember.update({
      where: { id: member.id },
      data: { status: "契約破棄" },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 契約破棄`
    );
  }
}

/**
 * レガシー: MasterContractに移行前のSlpMemberデータ用フォールバック
 * SlpMember.documentIdで直接検索して更新
 */
async function handleSlpMemberWebhookLegacy(
  documentID: string,
  status: number
): Promise<boolean> {
  const member = await prisma.slpMember.findFirst({
    where: { documentId: documentID, deletedAt: null },
  });

  if (!member) return false;

  const now = new Date();

  if (status === CS_STATUS_COMPLETED) {
    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        status: "組合員契約書締結",
        contractSignedDate: now,
      },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 組合員契約書締結 (legacy)`
    );

    // Form5・ビーコン処理
    try {
      const lineFriend = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { free1: true },
      });
      const referrerUid = lineFriend?.free1;

      if (referrerUid && member.form5NotifiedReferrerUid !== referrerUid) {
        await submitForm5ContractNotification(
          referrerUid,
          member.lineName || "",
          member.name
        );
        await prisma.slpMember.update({
          where: { id: member.id },
          data: {
            form5NotifyCount: { increment: 1 },
            form5NotifiedReferrerUid: referrerUid,
          },
        });
      }
    } catch (form5Err) {
      await logAutomationError({
        source: "cloudsign-webhook/form5",
        message: `Form5契約締結通知失敗 (memberId=${member.id})`,
        detail: { memberId: member.id, uid: member.uid, error: String(form5Err) },
      });
    }

    try {
      const lineFriendExists = await prisma.slpLineFriend.findUnique({
        where: { uid: member.uid },
        select: { id: true },
      });
      if (lineFriendExists) {
        const res = await fetch(`https://autosns.jp/api/call-beacon/xZugEszbhx/${member.uid}`);
        if (res.ok) {
          await prisma.slpMember.update({
            where: { id: member.id },
            data: { richmenuBeaconCalled: true },
          });
        }
      }
    } catch (beaconErr) {
      await logAutomationError({
        source: "cloudsign-webhook",
        message: `プロラインビーコン呼び出し失敗 (uid=${member.uid})`,
        detail: {
          uid: member.uid,
          memberId: member.id,
          error: String(beaconErr),
          retryAction: "slp-richmenu-beacon",
        },
      });
    }

    return true;
  }

  if (status === CS_STATUS_CANCELED) {
    await prisma.slpMember.update({
      where: { id: member.id },
      data: { status: "契約破棄" },
    });
    console.log(
      `[CloudSign Webhook] SLP member #${member.id} (${member.name}) → 契約破棄 (legacy)`
    );
    return true;
  }

  return false;
}

// GET: ヘルスチェック（Webhook URL疎通確認用）
export async function GET() {
  return NextResponse.json({ ok: true, service: "cloudsign-webhook" });
}
