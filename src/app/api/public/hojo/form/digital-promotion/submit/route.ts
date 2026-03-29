import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const answersJson = formData.get("answers") as string;

    if (!answersJson) {
      return NextResponse.json({ error: "回答データが必要です" }, { status: 400 });
    }

    const answers = JSON.parse(answersJson);

    // ファイルアップロード処理
    const fileUrls: Record<string, string> = {};
    const uploadDir = path.join(process.cwd(), "public", "uploads", "hojo-forms");
    await mkdir(uploadDir, { recursive: true });

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File && value.size > 0) {
        const timestamp = Date.now();
        const sanitizedName = value.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${timestamp}_${sanitizedName}`;
        const filePath = path.join(uploadDir, fileName);

        const buffer = Buffer.from(await value.arrayBuffer());
        await writeFile(filePath, buffer);

        fileUrls[key] = `/uploads/hojo-forms/${fileName}`;
      }
    }

    // DB保存
    const submission = await prisma.hojoFormSubmission.create({
      data: {
        formType: "digital-promotion",
        companyName: answers["会社名／屋号"] || null,
        representName: answers["代表者氏名"] || null,
        email: answers["連絡先（メールアドレス）"] || null,
        phone: answers["連絡先（電話番号）"] || null,
        answers,
        fileUrls: Object.keys(fileUrls).length > 0 ? fileUrls : undefined,
      },
    });

    return NextResponse.json({ success: true, id: submission.id });
  } catch (err) {
    console.error("[HojoForm] submit error:", err);
    return NextResponse.json(
      { error: "送信に失敗しました" },
      { status: 500 }
    );
  }
}
