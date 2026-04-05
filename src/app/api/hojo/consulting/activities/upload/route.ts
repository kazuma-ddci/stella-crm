import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userType = session?.user?.userType;

    // 認証チェック（スタッフ or ベンダー）
    if (userType !== "staff" && userType !== "vendor") {
      return NextResponse.json({ error: "権限がありません" }, { status: 401 });
    }

    if (userType === "staff") {
      const permissions = (session?.user?.permissions ?? []) as UserPermission[];
      if (!canEditProject(permissions, "hojo")) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "ファイルが指定されていません" }, { status: 400 });
    }

    // ファイルサイズ制限: 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "ファイルサイズは50MB以下にしてください" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "consulting-activities");
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${randomSuffix}_${sanitizedName}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/uploads/consulting-activities/${fileName}`;
    return NextResponse.json({ success: true, url, filename: file.name });
  } catch (err) {
    console.error("[ConsultingActivity] upload error:", err);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}
