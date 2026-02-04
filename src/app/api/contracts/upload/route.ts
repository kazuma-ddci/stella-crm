import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// 許可するファイル形式
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// ファイルサイズ制限（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contractId = formData.get("contractId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは10MB以下にしてください" },
        { status: 400 }
      );
    }

    // ファイル形式チェック
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "許可されていないファイル形式です（PDF, Word, 画像のみ）" },
        { status: 400 }
      );
    }

    // ファイル保存パスを生成
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const timestamp = now.getTime();

    // ファイル名をサニタイズ
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = contractId
      ? `${contractId}_${timestamp}_${originalName}`
      : `${timestamp}_${originalName}`;

    // 保存ディレクトリのパス
    const uploadDir = path.join(process.cwd(), "public", "uploads", "contracts", String(year), month);

    // ディレクトリを作成（存在しない場合）
    await mkdir(uploadDir, { recursive: true });

    // ファイルを保存
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // 公開URLパス（public以下の相対パス）
    const publicPath = `/uploads/contracts/${year}/${month}/${fileName}`;

    return NextResponse.json({
      success: true,
      filePath: publicPath,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
