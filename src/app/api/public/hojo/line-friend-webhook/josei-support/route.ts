import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";
import { extractWebhookData } from "@/lib/hojo/webhook-params";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.HOJO_JOSEI_WEBHOOK_SECRET;
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

    await prisma.hojoLineFriendJoseiSupport.upsert({
      where: { uid },
      create: { uid, ...data, friendAddedDate: friendAddedDate ?? new Date() },
      update: data,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Webhook] hojo/josei-support failed:", err);
    await logAutomationError({
      source: "webhook/hojo-line-friend/josei-support",
      message: `LINE友だちWebhook失敗 (uid=${uid})`,
      detail: { uid, error: String(err) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
