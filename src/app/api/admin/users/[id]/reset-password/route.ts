import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { authorizeApi } from "@/lib/api-auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 社内スタッフ + いずれかのプロジェクトで edit 以上
    const authz = await authorizeApi([
      { project: "stp", level: "edit" },
      { project: "slp", level: "edit" },
      { project: "accounting", level: "edit" },
      { project: "hojo", level: "edit" },
      { project: "stella", level: "edit" },
    ]);
    if (!authz.ok) return authz.response;

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "無効なユーザーIDです" },
        { status: 400 }
      );
    }

    // ユーザー存在確認
    const user = await prisma.externalUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // パスワードリセットトークン生成
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 既存のトークンを無効化
    await prisma.passwordResetToken.updateMany({
      where: {
        externalUserId: userId,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    // 新しいトークンを作成
    await prisma.passwordResetToken.create({
      data: {
        token,
        externalUserId: userId,
        expiresAt,
      },
    });

    // パスワードリセットメールを送信
    const emailResult = await sendPasswordResetEmail(
      user.email,
      user.name,
      token
    );

    if (!emailResult.success) {
      return NextResponse.json({
        success: true,
        warning: `リセットトークンを作成しましたが、メール送信に失敗しました: ${emailResult.error}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "パスワードリセットメールを送信しました",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "パスワードリセットに失敗しました" },
      { status: 500 }
    );
  }
}
