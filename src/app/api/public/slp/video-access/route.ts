import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import path from "path";
import {
  SLP_VIDEO_COOKIE_NAME,
  setAccessCookie,
  verifyAccessCookie,
  buildSetCookieHeader,
} from "@/lib/slp/document-access-token";

export const dynamic = "force-dynamic";

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
  const type = request.nextUrl.searchParams.get("type"); // "video" で動画ファイル返却

  // =====================================================================
  // 認証: URL クエリ（初回）or Cookie（リロード・2回目以降）から uid/snsname 取得
  // =====================================================================
  let uid: string | null = null;
  let snsname: string | null = null;
  let isFirstAccess = false;

  if (uidQuery && snsnameQuery) {
    uid = uidQuery;
    snsname = snsnameQuery;
    isFirstAccess = true;
  } else {
    const payload = verifyAccessCookie(request.cookies, SLP_VIDEO_COOKIE_NAME);
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
  // type=video: Range 対応ストリーミング配信 + ブラウザキャッシュ有効化
  // =====================================================================
  if (type === "video") {
    const activeVideo = await prisma.slpVideo.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!activeVideo) {
      return NextResponse.json(
        { error: "動画ファイルが見つかりません" },
        { status: 404 },
      );
    }

    const videoPath = path.join(process.cwd(), "public", activeVideo.filePath);

    let stat;
    try {
      stat = statSync(videoPath);
    } catch {
      return NextResponse.json(
        { error: "動画ファイルが見つかりません" },
        { status: 404 },
      );
    }

    const fileSize = stat.size;
    const range = request.headers.get("range");
    const mimeType = activeVideo.mimeType || "video/mp4";
    const etag = `"${stat.size}-${stat.mtimeMs}"`;

    // Range リクエスト対応（シーク可能ストリーミング）
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        return new NextResponse(null, { status: 416 });
      }
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = createReadStream(videoPath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      // 標準 Response を使用（Next.js の Cache-Control 上書き回避）
      const rangeHeaders = new Headers({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": mimeType,
        // ブラウザキャッシュ有効化（リロード高速化）
        "Cache-Control": "private, max-age=3600, immutable",
        ETag: etag,
      });
      if (isFirstAccess) {
        rangeHeaders.append(
          "Set-Cookie",
          buildSetCookieHeader(SLP_VIDEO_COOKIE_NAME, uid, snsname),
        );
      }
      return new Response(webStream, { status: 206, headers: rangeHeaders });
    }

    // フル配信
    const nodeStream = createReadStream(videoPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const fullHeaders = new Headers({
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600, immutable",
      ETag: etag,
    });
    if (isFirstAccess) {
      fullHeaders.append(
        "Set-Cookie",
        buildSetCookieHeader(SLP_VIDEO_COOKIE_NAME, uid, snsname),
      );
    }
    return new Response(webStream, { status: 200, headers: fullHeaders });
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
          resourceType: "video",
          ipAddress,
          userAgent: userAgent || null,
        },
      });
    }
  } catch (err) {
    console.error("[SLP_VIDEO_ACCESS_LOG_ERROR]", err);
  }

  console.log(
    `[SLP_VIDEO_ACCESS] ${isFirstAccess ? "FIRST" : "CONTINUE"} uid=${uid}, snsname=${snsname}, ip=${ipAddress || "unknown"}, at=${new Date().toISOString()}`,
  );

  const res = NextResponse.json({
    authorized: true,
    uid,
    snsname,
  });

  if (isFirstAccess) {
    setAccessCookie(res.cookies, SLP_VIDEO_COOKIE_NAME, uid, snsname);
  }

  return res;
}
