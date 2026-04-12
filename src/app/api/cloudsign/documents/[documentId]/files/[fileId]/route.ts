import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { authorizeApi } from "@/lib/api-auth";

/**
 * GET /api/cloudsign/documents/[documentId]/files/[fileId]
 * ドラフト書類のPDFファイルをプロキシで返す
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; fileId: string }> }
) {
  try {
    // STP編集 or 経理編集 のスタッフのみ
    const authz = await authorizeApi([
      { project: "stp", level: "edit" },
      { project: "accounting", level: "edit" },
    ]);
    if (!authz.ok) return authz.response;

    const { documentId, fileId } = await params;
    const { searchParams } = new URL(request.url);
    const operatingCompanyId = searchParams.get("operatingCompanyId");

    if (!operatingCompanyId) {
      return NextResponse.json(
        { error: "operatingCompanyId は必須です" },
        { status: 400 }
      );
    }

    const operatingCompany = await prisma.operatingCompany.findUnique({
      where: { id: Number(operatingCompanyId) },
      select: { cloudsignClientId: true },
    });

    if (!operatingCompany?.cloudsignClientId) {
      return NextResponse.json(
        { error: "クライアントIDが設定されていません" },
        { status: 400 }
      );
    }

    const token = await cloudsignClient.getToken(
      operatingCompany.cloudsignClientId
    );

    // CloudSign APIからPDFを取得
    const pdfRes = await fetch(
      `https://api.cloudsign.jp/documents/${documentId}/files/${fileId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: "PDFの取得に失敗しました" },
        { status: pdfRes.status }
      );
    }

    const pdfBuffer = await pdfRes.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("CloudSign PDF fetch error:", error);
    return NextResponse.json(
      { error: "PDFの取得に失敗しました" },
      { status: 500 }
    );
  }
}
