import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import path from "path";
import {
  SLP_DOCUMENT_COOKIE_NAME,
  setAccessCookie,
  verifyAccessCookie,
  buildSetCookieHeader,
} from "@/lib/slp/document-access-token";

// IPアドレスを取得（プロキシ・CDN経由対応）
function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export async function GET(request: NextRequest) {
  const uidQuery = request.nextUrl.searchParams.get("uid")?.trim();
  const snsnameQuery = request.nextUrl.searchParams.get("snsname")?.trim();
  const type = request.nextUrl.searchParams.get("type"); // "pdf" でPDFファイル返却

  // =====================================================================
  // 認証: URL クエリ（初回）or Cookie（リロード・2回目以降）から uid/snsname 取得
  // =====================================================================
  let uid: string | null = null;
  let snsname: string | null = null;
  let isFirstAccess = false; // 初回（Cookie 発行が必要か）

  if (uidQuery && snsnameQuery) {
    // 初回アクセス: URL クエリから取得
    uid = uidQuery;
    snsname = snsnameQuery;
    isFirstAccess = true;
  } else {
    // 2回目以降（リロード等）: Cookie から検証
    const payload = verifyAccessCookie(
      request.cookies,
      SLP_DOCUMENT_COOKIE_NAME,
    );
    if (payload) {
      uid = payload.uid;
      snsname = payload.snsname;
    }
  }

  if (!uid || !snsname) {
    return NextResponse.json(
      { authorized: false, reason: "missing_params" },
      { status: 400 },
    );
  }

  // =====================================================================
  // type=pdf: ストリーミング配信 + ブラウザキャッシュ有効化
  // =====================================================================
  if (type === "pdf") {
    const activeDoc = await prisma.slpDocument.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    // DB登録あり → そのファイルを配信
    // DB登録なし → レガシーの固定ファイルにフォールバック
    const pdfPath = activeDoc
      ? path.join(process.cwd(), "public", activeDoc.filePath)
      : path.join(
          process.cwd(),
          "public",
          "uploads",
          "documents",
          "slp-document.pdf",
        );

    try {
      // ファイルサイズを取得（Content-Length ヘッダー用）
      const stat = statSync(pdfPath);

      // ストリーミング配信（メモリに全部読み込まず順次送信）
      const nodeStream = createReadStream(pdfPath);
      const webStream = Readable.toWeb(
        nodeStream,
      ) as unknown as ReadableStream<Uint8Array>;

      // NextResponse ではなく標準 Response を使用
      // → Next.js が Cache-Control を上書きするのを回避
      const headers = new Headers({
        "Content-Type": "application/pdf",
        "Content-Length": String(stat.size),
        // ブラウザキャッシュを1時間有効化（2回目以降のリロードを高速化）
        "Cache-Control": "private, max-age=3600, immutable",
        // ダウンロードではなくインライン表示
        "Content-Disposition": "inline",
        // ETag（ファイルサイズ+mtime ベース）
        ETag: `"${stat.size}-${stat.mtimeMs}"`,
      });

      // 初回アクセス時は Cookie を手動で Set-Cookie ヘッダーに追加
      if (isFirstAccess) {
        headers.append(
          "Set-Cookie",
          buildSetCookieHeader(SLP_DOCUMENT_COOKIE_NAME, uid, snsname),
        );
      }

      return new Response(webStream, {
        status: 200,
        headers,
      });
    } catch {
      return NextResponse.json(
        { error: "PDFファイルが見つかりません" },
        { status: 404 },
      );
    }
  }

  // =====================================================================
  // 認証情報リクエスト（ページ初回ロード時）→ アクセスログ記録 + Cookie 発行
  // =====================================================================
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    // アクセスログは「初回アクセス時のみ」記録（リロード時は記録しない）
    if (isFirstAccess) {
      await prisma.slpDocumentAccessLog.create({
        data: {
          uid,
          snsname,
          ipAddress,
          userAgent: userAgent || null,
        },
      });
    }
  } catch (err) {
    // ログ書き込み失敗はユーザー体験に影響させない
    console.error("[SLP_DOC_ACCESS_LOG_ERROR]", err);
  }

  console.log(
    `[SLP_DOC_ACCESS] ${isFirstAccess ? "FIRST" : "CONTINUE"} uid=${uid}, snsname=${snsname}, ip=${ipAddress || "unknown"}, at=${new Date().toISOString()}`,
  );

  const res = NextResponse.json({
    authorized: true,
    uid,
    snsname,
  });

  // 初回アクセス時は Cookie を発行
  if (isFirstAccess) {
    setAccessCookie(res.cookies, SLP_DOCUMENT_COOKIE_NAME, uid, snsname);
  }

  return res;
}
