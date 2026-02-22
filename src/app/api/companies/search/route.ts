import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // 検索条件（統合済み企業を除外）
    const where = query
      ? {
          mergedIntoId: null,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { companyCode: { contains: query, mode: "insensitive" as const } },
            { industry: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : { mergedIntoId: null, deletedAt: null };

    // 企業検索
    const companies = await prisma.masterStellaCompany.findMany({
      where,
      select: {
        id: true,
        companyCode: true,
        name: true,
        industry: true,
      },
      orderBy: [{ name: "asc" }],
      take: limit,
    });

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Error searching companies:", error);
    return NextResponse.json(
      { error: "企業の検索に失敗しました" },
      { status: 500 }
    );
  }
}
