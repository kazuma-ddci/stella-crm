import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session.user as any).id as number;

    // 管理者権限チェック
    const staffPermissions = await prisma.staffPermission.findMany({
      where: { staffId: userId },
    });

    const hasAdminPermission = staffPermissions.some(
      (p) => p.permissionLevel === "admin"
    );

    if (!hasAdminPermission) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

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
