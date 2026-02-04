import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const registrationToken = await prisma.registrationToken.findUnique({
      where: { token },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!registrationToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      );
    }

    // ステータスチェック
    if (registrationToken.status === "revoked") {
      return NextResponse.json(
        { error: "このトークンは無効化されています" },
        { status: 400 }
      );
    }

    if (registrationToken.status === "exhausted") {
      return NextResponse.json(
        { error: "このトークンは使用回数の上限に達しています" },
        { status: 400 }
      );
    }

    // 有効期限チェック
    if (new Date() > registrationToken.expiresAt) {
      // ステータスを更新
      await prisma.registrationToken.update({
        where: { id: registrationToken.id },
        data: { status: "expired" },
      });

      return NextResponse.json(
        { error: "このトークンの有効期限が切れています" },
        { status: 400 }
      );
    }

    // 使用回数チェック
    if (registrationToken.useCount >= registrationToken.maxUses) {
      // ステータスを更新
      await prisma.registrationToken.update({
        where: { id: registrationToken.id },
        data: { status: "exhausted" },
      });

      return NextResponse.json(
        { error: "このトークンは使用回数の上限に達しています" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      companyId: registrationToken.company.id,
      companyName: registrationToken.company.name,
      expiresAt: registrationToken.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error validating registration token:", error);
    return NextResponse.json(
      { error: "トークンの検証に失敗しました" },
      { status: 500 }
    );
  }
}
