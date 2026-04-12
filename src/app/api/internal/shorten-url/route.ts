import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/api-auth";
import { isUrlAllowedForShortening } from "@/lib/short-url-allowlist";

// ランダムな6文字の短縮コードを生成
function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: Request) {
  try {
    // 社内スタッフのみ作成可能(誰でも作れると phishing に悪用される)
    const authz = await authorizeApi();
    if (!authz.ok) return authz.response;

    const body = await request.json();
    const { originalUrl } = body;

    if (!originalUrl) {
      return NextResponse.json(
        { error: "originalUrl is required" },
        { status: 400 }
      );
    }

    // ドメインホワイトリストチェック(自社ドメイン以外は弾く)
    if (!isUrlAllowedForShortening(originalUrl)) {
      return NextResponse.json(
        {
          error:
            "短縮できるのは自社ドメインのURLのみです。自社外のURLは短縮できません。",
        },
        { status: 400 }
      );
    }

    // 既存の短縮URLを検索
    const existing = await prisma.shortUrl.findFirst({
      where: { originalUrl },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        shortCode: existing.shortCode,
      });
    }

    // 新しい短縮コードを生成（重複チェック付き）
    let shortCode = generateShortCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existingCode = await prisma.shortUrl.findUnique({
        where: { shortCode },
      });
      if (!existingCode) break;
      shortCode = generateShortCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Failed to generate unique short code" },
        { status: 500 }
      );
    }

    // 短縮URLを保存
    await prisma.shortUrl.create({
      data: {
        shortCode,
        originalUrl,
      },
    });

    return NextResponse.json({
      success: true,
      shortCode,
    });
  } catch (error) {
    console.error("Shorten URL error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
