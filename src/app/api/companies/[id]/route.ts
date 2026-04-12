import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 社内スタッフ限定。閲覧目的なので project 制限なし
    const authz = await authorizeApi();
    if (!authz.ok) return authz.response;

    const { id } = await params;
    const companyId = parseInt(id, 10);

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: "無効な企業IDです" },
        { status: 400 }
      );
    }

    const company = await prisma.masterStellaCompany.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyCode: true,
        name: true,
        industry: true,
        websiteUrl: true,
        revenueScale: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "企業が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: "企業情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
