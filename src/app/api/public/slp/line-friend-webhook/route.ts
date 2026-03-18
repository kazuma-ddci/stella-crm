import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

/**
 * ProLineからの友だち追加Webhook（GETリクエスト）
 * URL例: /api/public/slp/line-friend-webhook?uid=[[uid]]&snsname=%%%%snsname%%%%&secret=SECRET
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const snsname = searchParams.get("snsname") || null;
  const secret = searchParams.get("secret");

  // 認証チェック
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  if (!webhookSecret || secret !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // uidは必須
  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  try {
    await prisma.slpLineFriend.upsert({
      where: { uid },
      create: {
        uid,
        snsname,
        friendAddedDate: new Date(),
      },
      update: {
        snsname,
      },
    });

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
