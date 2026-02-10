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

    // 表示ビュー一覧を取得（projectリレーションを含む）
    const views = await prisma.displayView.findMany({
      where: { isActive: true },
      include: { project: { select: { id: true, code: true, name: true } } },
      orderBy: { id: "asc" },
    });

    // projectCode フィールドを維持（互換性のため）
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
      projects: projectsWithViews,
      views: viewsWithCode,
    });
  } catch (error) {
    console.error("Error fetching display views:", error);
    return NextResponse.json(
      { error: "表示ビュー一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
