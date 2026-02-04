import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";

interface SubmitRegistrationRequest {
  token: string;
  name: string;
  position?: string;
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitRegistrationRequest = await request.json();
    const { token, name, position, email, password } = body;

    // 必須フィールドチェック
    if (!token || !name || !email || !password) {
      return NextResponse.json(
        { error: "必須項目を入力してください" },
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

    // トークン検証
    const registrationToken = await prisma.registrationToken.findUnique({
      where: { token },
    });

    if (!registrationToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      );
    }

    // トークン有効性チェック
    if (
      registrationToken.status !== "active" ||
      new Date() > registrationToken.expiresAt ||
      registrationToken.useCount >= registrationToken.maxUses
    ) {
      return NextResponse.json(
        { error: "このトークンは無効です" },
        { status: 400 }
      );
    }

    // メールアドレス重複チェック
    const existingUser = await prisma.externalUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 400 }
      );
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // トランザクションで外部ユーザー作成とトークン更新
    const result = await prisma.$transaction(async (tx) => {
      // 外部ユーザー作成
      // 開発環境ではメール認証をスキップして直接「承認待ち」状態にする
      const skipEmailVerification = !process.env.RESEND_API_KEY;
      const externalUser = await tx.externalUser.create({
        data: {
          companyId: registrationToken.companyId,
          registrationTokenId: registrationToken.id,
          name,
          position,
          email,
          passwordHash,
          status: skipEmailVerification ? "pending_approval" : "pending_email",
          emailVerifiedAt: skipEmailVerification ? new Date() : null,
        },
      });

      // メール認証トークン作成
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpiresAt = new Date();
      verificationExpiresAt.setHours(verificationExpiresAt.getHours() + 24);

      await tx.emailVerificationToken.create({
        data: {
          token: verificationToken,
          externalUserId: externalUser.id,
          expiresAt: verificationExpiresAt,
        },
      });

      // 登録トークンの使用回数を更新
      const updatedToken = await tx.registrationToken.update({
        where: { id: registrationToken.id },
        data: {
          useCount: { increment: 1 },
          status:
            registrationToken.useCount + 1 >= registrationToken.maxUses
              ? "exhausted"
              : "active",
        },
      });

      return { externalUser, verificationToken, updatedToken };
    });

    // メール認証がスキップされた場合
    const skipEmailVerification = !process.env.RESEND_API_KEY;
    if (skipEmailVerification) {
      return NextResponse.json({
        success: true,
        message:
          "登録が完了しました。管理者の承認後、ログインできるようになります。",
      });
    }

    // 確認メール送信
    const emailResult = await sendVerificationEmail(
      email,
      name,
      result.verificationToken
    );

    if (!emailResult.success) {
      // メール送信失敗時も登録は完了させる
      console.error("Failed to send verification email:", emailResult.error);
      return NextResponse.json({
        success: true,
        warning:
          "登録は完了しましたが、確認メールの送信に失敗しました。管理者にお問い合わせください。",
      });
    }

    return NextResponse.json({
      success: true,
      message:
        "登録が完了しました。確認メールを送信しましたので、メール内のリンクをクリックして認証を完了してください。",
    });
  } catch (error) {
    console.error("Error submitting registration:", error);
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
}
