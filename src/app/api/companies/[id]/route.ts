import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

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
