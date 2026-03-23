import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { submitForm4FriendNotification } from "@/lib/proline-form";

/**
 * ProLineからの友だち追加Webhook（GET形式）
 *
 * 「友だち追加された時に外部プログラムを実行する」で設定するURL:
 *   /api/public/slp/line-friend-webhook?uid=[[uid]]&snsname=%%snsname%%&e=[[e]]&free1=[[free1]]&free2=[[free2]]&free3=[[free3]]&free4=[[free4]]&free5=[[free5]]&free6=[[free6]]&secret=SECRET
 *
 * GETで取得できる項目: uid, snsname, email(=e), free1〜free6
 * sei, mei, phone, address等はGETでは取得不可 → 毎時同期（sync-line-friends）で補完
 */

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

function toNullIfEmpty(val: string | null): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
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

  const snsname = toNullIfEmpty(searchParams.get("snsname"));
  const email = toNullIfEmpty(searchParams.get("e"));
  const free1 = toNullIfEmpty(searchParams.get("free1"));
  const free2 = toNullIfEmpty(searchParams.get("free2"));
  const free3 = toNullIfEmpty(searchParams.get("free3"));
  const free4 = toNullIfEmpty(searchParams.get("free4"));
  const free5 = toNullIfEmpty(searchParams.get("free5"));
  const free6 = toNullIfEmpty(searchParams.get("free6"));

  try {
    const data = {
      snsname,
      email,
      free1,
      free2,
      free3,
      free4,
      free5,
      free6,
    };

    await prisma.slpLineFriend.upsert({
      where: { uid },
      create: {
        uid,
        ...data,
        friendAddedDate: new Date(),
      },
      update: data,
    });

    // Form4: 紹介者に友だち追加通知を送信（fire-and-forget）
    if (free1) {
      try {
        await submitForm4FriendNotification(free1, snsname || "");
        await prisma.slpLineFriend.update({
          where: { uid },
          data: { form4NotifyCount: { increment: 1 } },
        });
        console.log(`[Webhook] Form4 notification sent for uid=${uid}, referrer=${free1}`);
      } catch (form4Err) {
        console.error(`[Webhook] Form4 notification failed for uid=${uid}:`, form4Err);
        await logAutomationError({
          source: "webhook/line-friend/form4",
          message: `Form4友だち追加通知失敗 (uid=${uid}, referrer=${free1})`,
          detail: { uid, referrerUid: free1, error: String(form4Err) },
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
