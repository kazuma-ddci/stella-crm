import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // トークン検索
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: {
        externalUser: true,
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      );
    }

    // 使用済みチェック
    if (verificationToken.isUsed) {
      return NextResponse.json(
        { error: "このトークンは既に使用されています" },
        { status: 400 }
      );
    }

    // 有効期限チェック
    if (new Date() > verificationToken.expiresAt) {
      return NextResponse.json(
        { error: "このトークンの有効期限が切れています" },
        { status: 400 }
      );
    }

    // 外部ユーザーのステータスを更新
    await prisma.$transaction([
      // トークンを使用済みに更新
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { isUsed: true },
      }),
      // 外部ユーザーのステータスを更新
      prisma.externalUser.update({
        where: { id: verificationToken.externalUserId },
        data: {
          status: "pending_approval",
          emailVerifiedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message:
        "メールアドレスの認証が完了しました。管理者の承認をお待ちください。",
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json(
      { error: "メール認証に失敗しました" },
      { status: 500 }
    );
  }
}
