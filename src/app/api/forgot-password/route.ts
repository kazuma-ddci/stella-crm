import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { identifier, email: emailLegacy } = await request.json();

    // identifier(新)またはemail(旧互換)を使用
    const input = (identifier || emailLegacy || "").trim();

    if (!input) {
      return NextResponse.json(
        { error: "メールアドレスを入力してください" },
        { status: 400 }
      );
    }

    const successResponse = NextResponse.json({
      success: true,
      message: "メールを送信しました",
    });

    const isEmail = input.includes("@");

    // 1. まず社内スタッフを検索（メールアドレスまたはログインID）
    const staff = isEmail
      ? await prisma.masterStaff.findUnique({
          where: { email: input },
        })
      : await prisma.masterStaff.findFirst({
          where: { loginId: input, isActive: true },
        });

    if (staff && staff.isActive && staff.passwordHash && staff.email) {
      // スタッフ用トークン発行
      await prisma.passwordResetToken.updateMany({
        where: {
          staffId: staff.id,
          isUsed: false,
        },
        data: { isUsed: true },
      });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await prisma.passwordResetToken.create({
        data: {
          token,
          staffId: staff.id,
          expiresAt,
        },
      });

      await sendPasswordResetEmail(staff.email, staff.name, token);

      return successResponse;
    }

    // 2. スタッフで見つからなければ外部ユーザーを検索（メールアドレスの場合のみ）
    if (!isEmail) {
      return successResponse;
    }

    const user = await prisma.externalUser.findUnique({
      where: { email: input },
    });

    // ユーザーが存在しなくても同じレスポンスを返す（セキュリティ対策）
    if (!user) {
      return successResponse;
    }

    // アクティブでないユーザーの場合もエラーを返さない
    if (user.status !== "active") {
      return successResponse;
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

    return successResponse;
  } catch (error) {
    console.error("Error processing forgot password request:", error);
    return NextResponse.json(
      { error: "リクエストの処理に失敗しました" },
      { status: 500 }
    );
  }
}
