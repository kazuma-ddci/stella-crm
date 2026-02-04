import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendRegistrationInviteEmail } from "@/lib/email";

interface GenerateTokenRequest {
  companyId: number;
  name?: string;
  note?: string;
  maxUses?: number;
  expiresInDays?: number;
  sendEmail?: boolean;
  email?: string;
  defaultViewIds?: number[];
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session.user as any).id as number;

    // 管理者権限チェック
    const staffPermissions = await prisma.staffPermission.findMany({
      where: { staffId: userId },
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

    const body: GenerateTokenRequest = await request.json();
    const {
      companyId,
      name,
      note,
      maxUses = 1,
      expiresInDays = 7,
      sendEmail = false,
      email,
      defaultViewIds = [],
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "企業IDは必須です" },
        { status: 400 }
      );
    }

    // 企業の存在確認
    const company = await prisma.masterStellaCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "指定された企業が見つかりません" },
        { status: 404 }
      );
    }

    // トークン生成
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // トークン保存（トランザクション内でデフォルトビューも保存）
    const registrationToken = await prisma.$transaction(async (tx) => {
      // トークン作成
      const newToken = await tx.registrationToken.create({
        data: {
          token,
          companyId,
          name,
          note,
          expiresAt,
          maxUses,
          issuedBy: userId,
        },
        include: {
          company: {
            select: {
              name: true,
            },
          },
        },
      });

      // デフォルトビューの保存
      if (defaultViewIds.length > 0) {
        await tx.registrationTokenDefaultView.createMany({
          data: defaultViewIds.map((viewId) => ({
            registrationTokenId: newToken.id,
            displayViewId: viewId,
          })),
        });
      }

      return newToken;
    });

    // メール送信（オプション）
    if (sendEmail && email) {
      const emailResult = await sendRegistrationInviteEmail(
        email,
        company.name,
        token
      );

      if (!emailResult.success) {
        // メール送信失敗時はトークンは作成済みだが警告を返す
        return NextResponse.json({
          success: true,
          token: registrationToken,
          warning: `トークンは作成されましたが、メール送信に失敗しました: ${emailResult.error}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      token: {
        id: registrationToken.id,
        token: registrationToken.token,
        companyId: registrationToken.companyId,
        companyName: registrationToken.company.name,
        expiresAt: registrationToken.expiresAt,
        maxUses: registrationToken.maxUses,
        registerUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register/${registrationToken.token}`,
      },
    });
  } catch (error) {
    console.error("Error generating registration token:", error);
    return NextResponse.json(
      { error: "トークンの生成に失敗しました" },
      { status: 500 }
    );
  }
}
