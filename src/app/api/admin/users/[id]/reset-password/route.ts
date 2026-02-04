import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "無効なユーザーIDです" },
        { status: 400 }
      );
    }

    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffId = (session.user as any).id as number;

    // 管理者権限チェック
    const staffPermissions = await prisma.staffPermission.findMany({
      where: { staffId },
    });

    const hasAdminPermission = staffPermissions.some(
      (p) => p.permissionLevel === "admin"
    );

    if (!hasAdminPermission) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
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
