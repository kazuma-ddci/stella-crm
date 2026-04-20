import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { sendReferralNotification } from "@/lib/slp/slp-referral-notification";
import { extractWebhookData } from "@/lib/hojo/webhook-params";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    const { data, friendAddedDate } = extractWebhookData(searchParams);

    await prisma.slpLineFriend.upsert({
      where: { uid },
      create: {
        uid,
        ...data,
        friendAddedDate: friendAddedDate ?? new Date(),
        isManuallyAdded: false, // Webhook経由はプロライン由来扱い
      },
      // 既存レコードを更新時、手動追加フラグは明示的に false に戻す
      // （手動追加されていたuidがWebhookで来た=プロラインにも載った状態）
      update: { ...data, isManuallyAdded: false },
    });

    // 友達追加通知（Form18統合・テンプレベース）を紹介者に送信（fire-and-forget）
    if (data.free1) {
      try {
        const r = await sendReferralNotification({
          trigger: "friend_added",
          referrerUid: data.free1,
          context: { addedFriendLineName: data.snsname || "" },
        });
        if (r.ok && !r.skipped) {
          await prisma.slpLineFriend.update({
            where: { uid },
            data: { form4NotifyCount: { increment: 1 } },
          });
          console.log(`[Webhook] friend_added notification sent for uid=${uid}, referrer=${data.free1}`);
        } else if (!r.ok) {
          throw new Error(r.errorMessage ?? "友達追加通知失敗");
        }
      } catch (form4Err) {
        console.error(`[Webhook] friend_added notification failed for uid=${uid}:`, form4Err);
        await logAutomationError({
          source: "webhook/line-friend/friend_added",
          message: `友達追加通知失敗 (uid=${uid}, referrer=${data.free1})`,
          detail: { uid, referrerUid: data.free1, error: String(form4Err) },
        });
      }
    }

    // ============================================
    // 締結後LINE紐付けの遅延処理
    // 同uidのSlpMemberが既に「組合員契約書締結」かつ
    // - リッチメニュー切り替え未実行 → 必ず実行
    // - Form5紹介者通知が未送信 + プロジェクト設定が自動送信ON → 実行
    // ============================================
    try {
      const member = await prisma.slpMember.findUnique({
        where: { uid },
        select: {
          id: true,
          name: true,
          lineName: true,
          status: true,
          richmenuBeaconCalled: true,
          form5NotifiedReferrerUid: true,
        },
      });

      if (member && member.status === "組合員契約書締結") {
        // (1) リッチメニュー切り替えビーコン（必須・常に実行）
        if (!member.richmenuBeaconCalled) {
          try {
            const res = await fetch(
              `https://autosns.jp/api/call-beacon/xZugEszbhx/${uid}`
            );
            if (res.ok) {
              await prisma.slpMember.update({
                where: { id: member.id },
                data: { richmenuBeaconCalled: true },
              });
              console.log(
                `[Webhook] ProLine richmenu beacon called for uid=${uid} (delayed)`
              );
            } else {
              throw new Error(`HTTP ${res.status}`);
            }
          } catch (beaconErr) {
            await logAutomationError({
              source: "webhook/line-friend/richmenu-beacon",
              message: `LINE後紐付け時のリッチメニュー切り替え失敗 (uid=${uid})`,
              detail: {
                uid,
                memberId: member.id,
                error: String(beaconErr),
                retryAction: "slp-richmenu-beacon",
              },
            });
          }
        }

        // (2) Form5紹介者通知（プロジェクト設定が自動送信ONかつ未送信の場合のみ）
        const referrerUid = data.free1;
        if (
          referrerUid &&
          member.form5NotifiedReferrerUid !== referrerUid
        ) {
          const slpProject = await prisma.masterProject.findFirst({
            where: { code: "slp" },
            select: { slpForm5AutoSendOnLink: true },
          });
          if (slpProject?.slpForm5AutoSendOnLink) {
            try {
              const r = await sendReferralNotification({
                trigger: "contract_signed",
                referrerUid,
                context: {
                  memberName: member.name,
                  memberLineName: member.lineName ?? undefined,
                },
              });
              if (r.ok && !r.skipped) {
                await prisma.slpMember.update({
                  where: { id: member.id },
                  data: {
                    form5NotifyCount: { increment: 1 },
                    form5NotifiedReferrerUid: referrerUid,
                  },
                });
                console.log(
                  `[Webhook] contract_signed notification sent (delayed) for memberId=${member.id}, referrer=${referrerUid}`
                );
              } else if (!r.ok) {
                throw new Error(r.errorMessage ?? "契約締結通知失敗");
              }
            } catch (form5Err) {
              await logAutomationError({
                source: "webhook/line-friend/contract_signed",
                message: `LINE後紐付け時の契約締結通知失敗 (memberId=${member.id})`,
                detail: {
                  memberId: member.id,
                  uid,
                  referrerUid,
                  error: String(form5Err),
                  retryAction: "contract-signed-notification",
                },
              });
            }
          }
        }
      }
    } catch (delayErr) {
      console.error(
        `[Webhook] Delayed action failed for uid=${uid}:`,
        delayErr
      );
      await logAutomationError({
        source: "webhook/line-friend/delayed",
        message: `LINE後紐付け遅延処理失敗 (uid=${uid})`,
        detail: { uid, error: String(delayErr) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Webhook] line-friend-webhook failed:", err);
    await logAutomationError({
      source: "webhook/line-friend",
      message: `LINE友だちWebhook失敗 (uid=${uid})`,
      detail: { uid, error: String(err) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
