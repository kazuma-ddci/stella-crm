import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public/slp/bounce-confirm
 *
 * 不達画面で「間違いない」ボタン押下時に bounceConfirmedAt をセットする。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid } = body as { uid?: string };

    if (!uid) {
      return NextResponse.json(
        { success: false, error: "uid is required" },
        { status: 400 }
      );
    }

    const member = await prisma.slpMember.findUnique({
      where: { uid },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member not found" },
        { status: 404 }
      );
    }

    await prisma.slpMember.update({
      where: { uid },
      data: { bounceConfirmedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[bounce-confirm] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
