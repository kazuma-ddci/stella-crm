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

    // 承認待ちユーザーを取得（メール未認証も含む）
    const users = await prisma.externalUser.findMany({
      where: {
        status: {
          in: ["pending_email", "pending_approval"],
        },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        registrationToken: {
          include: {
            defaultViews: {
              include: {
                displayView: {
                  select: {
                    id: true,
                    viewKey: true,
                    viewName: true,
                    project: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // projectCode フィールドを維持（互換性のため）
    const usersWithCode = users.map((u) => ({
      ...u,
      registrationToken: u.registrationToken ? {
        ...u.registrationToken,
        defaultViews: u.registrationToken.defaultViews.map((dv) => ({
          ...dv,
          displayView: {
            ...dv.displayView,
            projectCode: dv.displayView.project.code,
          },
        })),
      } : null,
    }));

    // 表示ビュー一覧を取得
    const views = await prisma.displayView.findMany({
      where: { isActive: true },
      include: { project: { select: { code: true } } },
      orderBy: { viewKey: "asc" },
    });

    const viewsWithCode = views.map((v) => ({
      ...v,
      projectCode: v.project.code,
    }));

    return NextResponse.json({ users: usersWithCode, views: viewsWithCode });
  } catch (error) {
    console.error("Error fetching pending users:", error);
    return NextResponse.json(
      { error: "ユーザー一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
