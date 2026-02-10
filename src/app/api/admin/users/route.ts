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

    // 外部ユーザー一覧を取得（アクティブ・停止含む）
    const users = await prisma.externalUser.findMany({
      where: {
        status: {
          in: ["active", "suspended"],
        },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        displayPermissions: {
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
        approver: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // projectCode フィールドを維持（互換性のため）
    const usersWithCode = users.map((u) => ({
      ...u,
      displayPermissions: u.displayPermissions.map((dp) => ({
        ...dp,
        displayView: {
          ...dp.displayView,
          projectCode: dp.displayView.project.code,
        },
      })),
    }));

    // 表示ビュー一覧を取得
    const views = await prisma.displayView.findMany({
      where: { isActive: true },
      include: { project: { select: { id: true, code: true, name: true } } },
      orderBy: { id: "asc" },
    });

    const viewsWithCode = views.map((v) => ({
      ...v,
      projectCode: v.project.code,
    }));

    // プロジェクトごとにビューをグループ化
    const uniqueProjectIds = [...new Set(views.map((v) => v.projectId))];
    const projectsWithViews = uniqueProjectIds.map((projectId) => {
      const projectViews = views.filter((v) => v.projectId === projectId);
      const project = projectViews[0].project;
      return {
        code: project.code,
        name: project.name,
        views: projectViews.map((v) => ({
          ...v,
          projectCode: v.project.code,
        })),
      };
    });

    return NextResponse.json({
      users: usersWithCode,
      views: viewsWithCode,
      projects: projectsWithViews,
    });
  } catch (error) {
    console.error("Error fetching external users:", error);
    return NextResponse.json(
      { error: "ユーザー一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
