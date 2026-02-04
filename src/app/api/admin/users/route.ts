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
                projectCode: true,
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

    // 表示ビュー一覧を取得
    const views = await prisma.displayView.findMany({
      where: { isActive: true },
      orderBy: [{ projectCode: "asc" }, { viewKey: "asc" }],
    });

    // プロジェクト情報を構築
    const uniqueProjectCodes = [...new Set(views.map((v) => v.projectCode))];
    const projects = await prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    const projectsWithViews = uniqueProjectCodes.map((code) => {
      const project = projects.find((p) => {
        const codeMap: Record<string, string> = {
          stp: "採用ブースト",
          stella: "Stella",
        };
        return p.name === codeMap[code] || p.name.toLowerCase().includes(code);
      });

      return {
        code,
        name: project?.name || code.toUpperCase(),
        views: views.filter((v) => v.projectCode === code),
      };
    });

    return NextResponse.json({
      users,
      views,
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
