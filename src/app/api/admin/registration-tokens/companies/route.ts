import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/api-auth";

export async function GET() {
  try {
    // 社内スタッフ + いずれかのプロジェクトで edit 以上
    const authz = await authorizeApi([
      { project: "stp", level: "edit" },
      { project: "slp", level: "edit" },
      { project: "accounting", level: "edit" },
      { project: "hojo", level: "edit" },
      { project: "stella", level: "edit" },
    ]);
    if (!authz.ok) return authz.response;

    // 企業一覧を取得
    const companies = await prisma.masterStellaCompany.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "企業一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
