import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      );
    }

    if (resetToken.isUsed) {
      return NextResponse.json(
        { error: "このトークンは既に使用されています" },
        { status: 400 }
      );
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: "このトークンの有効期限が切れています" },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Error validating reset token:", error);
    return NextResponse.json(
      { error: "トークンの検証に失敗しました" },
      { status: 500 }
    );
  }
}
