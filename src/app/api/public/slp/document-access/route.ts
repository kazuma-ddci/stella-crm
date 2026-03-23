import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

async function verifyMember(uid: string) {
  const member = await prisma.slpMember.findUnique({
    where: { uid },
    select: {
      id: true,
      uid: true,
      name: true,
      email: true,
      status: true,
      watermarkCode: true,
      deletedAt: true,
    },
  });

  if (!member || member.deletedAt) {
    return { authorized: false as const, reason: "not_found" };
  }

  if (member.status !== "組合員契約書締結") {
    return { authorized: false as const, reason: "not_authorized", status: member.status };
  }

  return { authorized: true as const, member };
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  const type = request.nextUrl.searchParams.get("type"); // "pdf" でPDFファイル返却

  if (!uid) {
    return NextResponse.json(
      { error: "UIDが必要です" },
      { status: 400 }
    );
  }

  const result = await verifyMember(uid);

  if (!result.authorized) {
    return NextResponse.json(
      { authorized: false, reason: result.reason },
      { status: 403 }
    );
  }

  const { member } = result;

  console.log(
    `[DOCUMENT_VIEW] uid=${member.uid}, name=${member.name}, email=${member.email}, code=${member.watermarkCode}, type=${type || "info"}, at=${new Date().toISOString()}`
  );

  // PDFファイル配信
  if (type === "pdf") {
    const pdfPath = path.join(process.cwd(), "public", "uploads", "documents", "slp-document.pdf");
    try {
      const pdfBuffer = await readFile(pdfPath);
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "PDFファイルが見つかりません" },
        { status: 404 }
      );
    }
  }

  // 認証情報返却
  return NextResponse.json({
    authorized: true,
    name: member.name,
    email: member.email,
    watermarkCode: member.watermarkCode,
  });
}
