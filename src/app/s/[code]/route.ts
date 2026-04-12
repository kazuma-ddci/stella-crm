import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUrlAllowedForShortening } from "@/lib/short-url-allowlist";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  try {
    const shortUrl = await prisma.shortUrl.findUnique({
      where: { shortCode: code },
    });

    if (!shortUrl) {
      return NextResponse.json(
        { error: "Short URL not found" },
        { status: 404 }
      );
    }

    // セキュリティ: ホワイトリストに含まれないドメインへのリダイレクトを拒否。
    // 過去に登録された URL でも、ホワイトリスト外のものは絶対に飛ばさない
    // (フィッシング防止)。
    if (!isUrlAllowedForShortening(shortUrl.originalUrl)) {
      console.warn(
        `[short-url] Blocked redirect to disallowed domain: ${shortUrl.originalUrl}`
      );
      return NextResponse.json(
        { error: "このリダイレクト先は許可されていません" },
        { status: 403 }
      );
    }

    return NextResponse.redirect(shortUrl.originalUrl, 302);
  } catch (error) {
    console.error("Short URL redirect error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
