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

    // 表示ビュー一覧を取得
    const views = await prisma.displayView.findMany({
      where: { isActive: true },
      orderBy: [{ projectCode: "asc" }, { viewKey: "asc" }],
    });

    // プロジェクト一覧を取得
    const projects = await prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    // プロジェクトコードとプロジェクト名のマッピングを作成
    // 注: projectCodeとMasterProject.nameは直接紐づいていないため、
    // ここでは表示ビューのprojectCodeからユニークなプロジェクトを抽出
    const uniqueProjectCodes = [...new Set(views.map((v) => v.projectCode))];

    // プロジェクト情報を構築
    const projectsWithViews = uniqueProjectCodes.map((code) => {
      const project = projects.find((p) => {
        // プロジェクト名とコードの対応（手動マッピング）
        const codeMap: Record<string, string> = {
          "stp": "採用ブースト",
          "stella": "Stella",
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
      projects: projectsWithViews,
      views,
    });
  } catch (error) {
    console.error("Error fetching display views:", error);
    return NextResponse.json(
      { error: "表示ビュー一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
