import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスを入力してください" },
        { status: 400 }
      );
    }

    // ユーザー検索
    const user = await prisma.externalUser.findUnique({
      where: { email },
    });

    // ユーザーが存在しなくても同じレスポンスを返す（セキュリティ対策）
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "メールを送信しました",
      });
    }

    // アクティブでないユーザーの場合もエラーを返さない
    if (user.status !== "active") {
      return NextResponse.json({
        success: true,
        message: "メールを送信しました",
      });
    }

    // 既存の未使用トークンを無効化
    await prisma.passwordResetToken.updateMany({
      where: {
        externalUserId: user.id,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    // 新しいリセットトークン作成
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1時間有効

    await prisma.passwordResetToken.create({
      data: {
        token,
        externalUserId: user.id,
        expiresAt,
      },
    });

    // メール送信
    await sendPasswordResetEmail(user.email, user.name, token);

    return NextResponse.json({
      success: true,
      message: "メールを送信しました",
    });
  } catch (error) {
    console.error("Error processing forgot password request:", error);
    return NextResponse.json(
      { error: "リクエストの処理に失敗しました" },
      { status: 500 }
    );
  }
}
