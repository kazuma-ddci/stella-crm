import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

function verifySecret(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const webhookSecret = process.env.HOJO_ALKES_WEBHOOK_SECRET;
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
    const data = { snsname, email, free1, free2, free3, free4, free5, free6 };

    await prisma.hojoLineFriendAlkes.upsert({
      where: { uid },
      create: { uid, ...data, friendAddedDate: new Date() },
      update: data,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Webhook] hojo/alkes failed:", err);
    await logAutomationError({
      source: "webhook/hojo-line-friend/alkes",
      message: `LINE友だちWebhook失敗 (uid=${uid})`,
      detail: { uid, error: String(err) },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
