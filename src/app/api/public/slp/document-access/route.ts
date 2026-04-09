import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

// IPアドレスを取得（プロキシ・CDN経由対応）
function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for は "client, proxy1, proxy2" 形式。先頭が実クライアント
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid")?.trim();
  const snsname = request.nextUrl.searchParams.get("snsname")?.trim();
  const type = request.nextUrl.searchParams.get("type"); // "pdf" でPDFファイル返却

  // uid と snsname の両方が必須
  if (!uid || !snsname) {
    return NextResponse.json(
      { authorized: false, reason: "missing_params" },
      { status: 400 }
    );
  }

  // PDFファイル配信（type=pdf）はログを取らない（info要求時に既に記録済み）
  if (type === "pdf") {
    const activeDoc = await prisma.slpDocument.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    // DB登録あり → そのファイルを配信
    // DB登録なし → レガシーの固定ファイルにフォールバック
    const pdfPath = activeDoc
      ? path.join(process.cwd(), "public", activeDoc.filePath)
      : path.join(process.cwd(), "public", "uploads", "documents", "slp-document.pdf");

    try {
      const pdfBuffer = await readFile(pdfPath);
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "PDFファイルが見つかりません" },
        { status: 404 }
      );
    }
  }

  // 認証情報リクエスト（ページ初回ロード時）→ アクセスログを記録
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    await prisma.slpDocumentAccessLog.create({
      data: {
        uid,
        snsname,
        ipAddress,
        userAgent: userAgent || null,
      },
    });
  } catch (err) {
    // ログ書き込み失敗はユーザー体験に影響させない
    console.error("[SLP_DOC_ACCESS_LOG_ERROR]", err);
  }

  console.log(
    `[SLP_DOC_ACCESS] uid=${uid}, snsname=${snsname}, ip=${ipAddress || "unknown"}, at=${new Date().toISOString()}`
  );

  return NextResponse.json({
    authorized: true,
    uid,
    snsname,
  });
}
