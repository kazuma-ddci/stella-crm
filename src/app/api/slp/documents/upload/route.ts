import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "PDFファイルのみアップロード可能です" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは50MB以下にしてください" },
        { status: 400 }
      );
    }

    // ファイル保存
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${sanitizedName}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents", "slp");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/documents/slp/${fileName}`;

    // 既存のアクティブな資料を全て非アクティブにして、新しい資料をアクティブに
    await prisma.$transaction([
      prisma.slpDocument.updateMany({
        where: { isActive: true, deletedAt: null },
        data: { isActive: false },
      }),
      prisma.slpDocument.create({
        data: {
          fileName: file.name,
          filePath: publicPath,
          fileSize: file.size,
          isActive: true,
          uploadedById: session.user.id,
          note: note?.trim() || null,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SLP document upload error:", error);
    return NextResponse.json(
      { error: "アップロードに失敗しました" },
      { status: 500 }
    );
  }
}
