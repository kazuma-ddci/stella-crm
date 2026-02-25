import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 5;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILE_COUNT) {
      return NextResponse.json(
        { error: `一度にアップロードできるファイルは${MAX_FILE_COUNT}件までです` },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `ファイルサイズは10MB以下にしてください: ${file.name}` },
          { status: 400 }
        );
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `許可されていないファイル形式です（PDF, Word, Excel, 画像, テキスト, CSVのみ）: ${file.name}` },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "invoice-groups",
      String(year),
      month
    );

    await mkdir(uploadDir, { recursive: true });

    const savedFiles = [];
    for (const file of files) {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${timestamp}_${sanitizedName}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, buffer);

      const publicPath = `/uploads/invoice-groups/${year}/${month}/${fileName}`;

      savedFiles.push({
        filePath: publicPath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    }

    return NextResponse.json({
      success: true,
      files: savedFiles,
    });
  } catch (error) {
    console.error("Invoice group upload error:", error);
    return NextResponse.json(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
