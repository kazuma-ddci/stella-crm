import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200);
}

/**
 * 補助金事業計画フォーム ファイルアップロードAPI（公開・認証不要）
 *
 * FormData:
 *   - file: File
 *   - fieldKey: string (フォーム上のフィールドキー: "bankAccountScreenshot")
 *
 * 戻り値:
 *   { success: true, filePath, fileName, fileSize, mimeType }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fieldKey = (formData.get("fieldKey") as string | null)?.trim();

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }
    if (!fieldKey) {
      return NextResponse.json({ error: "fieldKeyが指定されていません" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "空のファイルはアップロードできません" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `ファイルサイズは${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB以下にしてください` },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "許可されていないファイル形式です（PDF, Word, Excel, 画像のみ）" },
        { status: 400 },
      );
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = randomUUID().slice(0, 8);
    const safeName = sanitizeFileName(file.name);

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "hojo",
      "business-plan",
      String(year),
      month,
    );
    await mkdir(uploadDir, { recursive: true });

    const storedName = `${uuid}-${safeName}`;
    const filePath = path.join(uploadDir, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/hojo/business-plan/${year}/${month}/${storedName}`;

    return NextResponse.json({
      success: true,
      filePath: publicPath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error("[HojoBusinessPlan] upload error:", error);
    return NextResponse.json({ error: "ファイルのアップロードに失敗しました" }, { status: 500 });
  }
}
