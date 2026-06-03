import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";

const VALID_LINE_TYPES = new Set(["josei-support", "shinsei-support", "alkes", "security-cloud"]);

function truncateMessage(message: string): string {
  return message.length > 2000 ? message.slice(0, 2000) : message;
}

export async function POST(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const lineType = typeof body.lineType === "string" ? body.lineType : "";
    const status = typeof body.status === "string" ? body.status : "";
    const attemptCount = Number.isInteger(body.attemptCount) ? body.attemptCount : 0;

    if (!VALID_LINE_TYPES.has(lineType)) {
      return NextResponse.json({ error: "invalid lineType" }, { status: 400 });
    }
    if (status !== "success" && status !== "failed") {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    if (attemptCount < 1 || attemptCount > 3) {
      return NextResponse.json({ error: "invalid attemptCount" }, { status: 400 });
    }

    if (status === "success") {
      await prisma.hojoProlineAccount.update({
        where: { lineType },
        data: {
          lastSyncSucceededAt: new Date(),
          lastSyncFailedAt: null,
          lastSyncErrorMessage: null,
          lastSyncAttemptCount: attemptCount,
        },
      });
    } else {
      const message =
        typeof body.errorMessage === "string" && body.errorMessage.trim()
          ? body.errorMessage.trim()
          : "ProLine同期に失敗しました";

      await prisma.hojoProlineAccount.update({
        where: { lineType },
        data: {
          lastSyncFailedAt: new Date(),
          lastSyncErrorMessage: truncateMessage(message),
          lastSyncAttemptCount: attemptCount,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Cron] hojo-proline-sync-status failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

