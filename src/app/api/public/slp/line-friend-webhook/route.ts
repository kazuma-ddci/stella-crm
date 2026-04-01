import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm4FriendNotification } from "@/lib/proline-form";
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
      create: { uid, ...data, friendAddedDate: friendAddedDate ?? new Date() },
      update: data,
    });

    // Form4: 紹介者に友だち追加通知を送信（fire-and-forget）
    if (data.free1) {
      try {
        await submitForm4FriendNotification(data.free1, data.snsname || "");
        await prisma.slpLineFriend.update({
          where: { uid },
          data: { form4NotifyCount: { increment: 1 } },
        });
        console.log(`[Webhook] Form4 notification sent for uid=${uid}, referrer=${data.free1}`);
      } catch (form4Err) {
        console.error(`[Webhook] Form4 notification failed for uid=${uid}:`, form4Err);
        await logAutomationError({
          source: "webhook/line-friend/form4",
          message: `Form4友だち追加通知失敗 (uid=${uid}, referrer=${data.free1})`,
          detail: { uid, referrerUid: data.free1, error: String(form4Err) },
        });
      }
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
