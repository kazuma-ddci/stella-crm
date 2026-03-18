import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

/**
 * ProLineからの友だち追加Webhook
 *
 * POST JSON形式（外部システム連携）:
 *   URL: /api/public/slp/line-friend-webhook?secret=SECRET
 *   Body: { uid, user_data: { snsname, email, phone, ... }, ... }
 *
 * GET形式（友だち追加時URL、後方互換）:
 *   URL: /api/public/slp/line-friend-webhook?uid=[[uid]]&snsname=%%snsname%%&secret=SECRET
 */

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.LINE_FRIEND_WEBHOOK_SECRET;
  return !!(webhookSecret && secret === webhookSecret);
}

// POST: ProLine外部システム連携（JSON形式）
export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const uid = body.uid as string | undefined;

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const userData = body.user_data || {};
    const snsname = (userData.snsname as string) || null;

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
    console.error("[Webhook] line-friend-webhook POST failed:", err);
    await logAutomationError({
      source: "webhook/line-friend",
      message: `LINE友だちWebhook失敗 (POST)`,
      detail: { error: String(err) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: 後方互換（クエリパラメータ形式）
export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const snsname = searchParams.get("snsname") || null;

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
    console.error("[Webhook] line-friend-webhook GET failed:", err);
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
