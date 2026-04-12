import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    if (!canEditMasterDataSync(session.user)) {
      return NextResponse.json(
        { error: "マスタデータの編集権限がありません" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const companyId = formData.get("companyId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは5MB以下にしてください" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "許可されていないファイル形式です（JPEG, PNG, GIF, WebP, SVGのみ）" },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "許可されていないファイル拡張子です（.jpg, .jpeg, .png, .gif, .webp, .svgのみ）" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    // セキュリティ: companyId は数値以外を弾いてパストラバーサル防止
    const safeCompanyId = companyId && Number.isInteger(Number(companyId))
      ? String(Number(companyId))
      : "new";
    const fileName = `logo_${safeCompanyId}_${timestamp}${ext}`;

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "logos"
    );

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/logos/${fileName}`;

    return NextResponse.json({
      success: true,
      filePath: publicPath,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "ロゴのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
