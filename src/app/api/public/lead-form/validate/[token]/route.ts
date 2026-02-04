import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const tokenRecord = await prisma.stpLeadFormToken.findUnique({
      where: { token },
      include: {
        agent: {
          include: {
            company: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { valid: false, error: "トークンが見つかりません" },
        { status: 404 }
      );
    }

    if (tokenRecord.status !== "active") {
      return NextResponse.json(
        { valid: false, error: "このフォームは現在利用できません" },
        { status: 403 }
      );
    }

    if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { valid: false, error: "このフォームの有効期限が切れています" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      agentName: tokenRecord.agent.company.name,
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
