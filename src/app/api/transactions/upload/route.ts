import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// 許可するファイル形式
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

// ファイルサイズ制限（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

    // 全ファイルのバリデーション
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

    // 保存ディレクトリのパスを生成
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "transactions",
      String(year),
      month
    );

    // ディレクトリを作成（存在しない場合）
    await mkdir(uploadDir, { recursive: true });

    // 各ファイルを保存
    const savedFiles = [];
    for (const file of files) {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${timestamp}_${sanitizedName}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, buffer);

      const publicPath = `/uploads/transactions/${year}/${month}/${fileName}`;

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
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
