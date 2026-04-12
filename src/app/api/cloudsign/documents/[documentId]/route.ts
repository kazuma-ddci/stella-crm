import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { authorizeApi } from "@/lib/api-auth";

/**
 * GET /api/cloudsign/documents/[documentId]
 * CloudSignからドキュメント詳細を取得（下書き再開時に使用）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    // STP編集 or 経理編集 のスタッフのみ
    const authz = await authorizeApi([
      { project: "stp", level: "edit" },
      { project: "accounting", level: "edit" },
    ]);
    if (!authz.ok) return authz.response;

    const { documentId } = await params;
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

    const doc = await cloudsignClient.getDocument(token, documentId);

    return NextResponse.json(doc);
  } catch (error) {
    console.error("CloudSign document fetch error:", error);
    return NextResponse.json(
      { error: "ドキュメントの取得に失敗しました" },
      { status: 500 }
    );
  }
}
