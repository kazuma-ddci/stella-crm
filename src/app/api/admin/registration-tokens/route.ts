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

    // 登録トークン一覧を取得
    const tokens = await prisma.registrationToken.findMany({
      select: {
        id: true,
        token: true,
        name: true,
        note: true,
        status: true,
        maxUses: true,
        useCount: true,
        expiresAt: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        issuer: {
          select: {
            name: true,
          },
        },
        defaultViews: {
          include: {
            displayView: {
              select: {
                id: true,
                viewKey: true,
                viewName: true,
                project: { select: { code: true } },
                description: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // projectCode フィールドを維持（互換性のため）
    const tokensWithCode = tokens.map((t) => ({
      ...t,
      defaultViews: t.defaultViews.map((dv) => ({
        ...dv,
        displayView: {
          ...dv.displayView,
          projectCode: dv.displayView.project.code,
        },
      })),
    }));

    return NextResponse.json({ tokens: tokensWithCode });
  } catch (error) {
    console.error("Error fetching registration tokens:", error);
    return NextResponse.json(
      { error: "トークン一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
