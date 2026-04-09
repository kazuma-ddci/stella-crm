import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
const ALLOWED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

// 大容量ファイルアップロード対応のため、最大ボディサイズと処理時間を拡大
export const maxDuration = 300; // 5分
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const note = formData.get("note") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "対応していない動画形式です（mp4 / webm / mov のみ）" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは1GB以下にしてください" },
        { status: 400 }
      );
    }

    // ファイル保存
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${sanitizedName}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "videos", "slp");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/videos/slp/${fileName}`;

    // 既存のアクティブな動画を全て非アクティブにして、新しい動画をアクティブに
    await prisma.$transaction([
      prisma.slpVideo.updateMany({
        where: { isActive: true, deletedAt: null },
        data: { isActive: false },
      }),
      prisma.slpVideo.create({
        data: {
          fileName: file.name,
          filePath: publicPath,
          fileSize: file.size,
          mimeType: file.type,
          isActive: true,
          uploadedById: session.user.id,
          note: note?.trim() || null,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SLP video upload error:", error);
    return NextResponse.json(
      { error: "アップロードに失敗しました" },
      { status: 500 }
    );
  }
}
