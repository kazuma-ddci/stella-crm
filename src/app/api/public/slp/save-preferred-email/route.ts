import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public/slp/save-preferred-email
 *
 * 自動送付ロック状態のメンバーが希望メールアドレスを保存する。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, email } = body as { uid?: string; email?: string };

    if (!uid || !email) {
      return NextResponse.json(
        { error: "uid and email are required" },
        { status: 400 }
      );
    }

    const member = await prisma.slpMember.findUnique({
      where: { uid },
      select: { id: true, autoSendLocked: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (!member.autoSendLocked) {
      return NextResponse.json(
        { error: "Member is not in auto-send locked state" },
        { status: 400 }
      );
    }

    await prisma.slpMember.update({
      where: { uid },
      data: { email },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
