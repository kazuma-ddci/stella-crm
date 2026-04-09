import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import path from "path";

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
  const uid = request.nextUrl.searchParams.get("uid")?.trim();
  const snsname = request.nextUrl.searchParams.get("snsname")?.trim();
  const type = request.nextUrl.searchParams.get("type"); // "video" で動画ファイル返却

  // uid と snsname の両方が必須
  if (!uid || !snsname) {
    return NextResponse.json(
      { authorized: false, reason: "missing_params" },
      { status: 400 }
    );
  }

  // 動画ファイル配信（type=video）はログを取らない（info要求時に既に記録済み）
  if (type === "video") {
    const activeVideo = await prisma.slpVideo.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!activeVideo) {
      return NextResponse.json(
        { error: "動画ファイルが見つかりません" },
        { status: 404 }
      );
    }

    const videoPath = path.join(process.cwd(), "public", activeVideo.filePath);

    let stat;
    try {
      stat = statSync(videoPath);
    } catch {
      return NextResponse.json(
        { error: "動画ファイルが見つかりません" },
        { status: 404 }
      );
    }

    const fileSize = stat.size;
    const range = request.headers.get("range");
    const mimeType = activeVideo.mimeType || "video/mp4";

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

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": mimeType,
          "Cache-Control": "no-store",
        },
      });
    }

    // フル配信
    const nodeStream = createReadStream(videoPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
        "Content-Type": mimeType,
        "Cache-Control": "no-store",
      },
    });
  }

  // 認証情報リクエスト（ページ初回ロード時）→ アクセスログを記録
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    await prisma.slpDocumentAccessLog.create({
      data: {
        uid,
        snsname,
        resourceType: "video",
        ipAddress,
        userAgent: userAgent || null,
      },
    });
  } catch (err) {
    console.error("[SLP_VIDEO_ACCESS_LOG_ERROR]", err);
  }

  console.log(
    `[SLP_VIDEO_ACCESS] uid=${uid}, snsname=${snsname}, ip=${ipAddress || "unknown"}, at=${new Date().toISOString()}`
  );

  return NextResponse.json({
    authorized: true,
    uid,
    snsname,
  });
}
