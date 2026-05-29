import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { auth } from "@/auth";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
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

function sanitizeFileName(name: string) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["staff", "vendor"].includes(session.user.userType ?? "")) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "空のファイルはアップロードできません" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは20MB以下にしてください" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "許可されていないファイル形式です" }, { status: 400 });
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const storedName = `${randomUUID().slice(0, 8)}-${sanitizeFileName(file.name)}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "hojo", "application-bpo", year, month);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, storedName), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      success: true,
      filePath: `/uploads/hojo/application-bpo/${year}/${month}/${storedName}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (e) {
    console.error("[ApplicationBpoUpload] error:", e);
    return NextResponse.json({ error: "ファイルのアップロードに失敗しました" }, { status: 500 });
  }
}
