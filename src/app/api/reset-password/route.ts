import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    // パスワード強度チェック
    if (password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上で入力してください" },
        { status: 400 }
      );
    }

    // トークン検索（スタッフ・外部ユーザー両方のリレーションを含む）
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        externalUser: true,
        staff: true,
      },
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

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // staffId / externalUserId で分岐してパスワード更新
    if (resetToken.staffId) {
      // 社内スタッフのパスワード更新
      await prisma.$transaction([
        prisma.masterStaff.update({
          where: { id: resetToken.staffId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { isUsed: true },
        }),
      ]);
    } else if (resetToken.externalUserId) {
      // 外部ユーザーのパスワード更新
      await prisma.$transaction([
        prisma.externalUser.update({
          where: { id: resetToken.externalUserId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { isUsed: true },
        }),
      ]);
    } else {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "パスワードを変更しました",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "パスワードのリセットに失敗しました" },
      { status: 500 }
    );
  }
}
