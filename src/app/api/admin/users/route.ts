import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/api-auth";

export async function GET() {
  try {
    // 社内スタッフ + いずれかのプロジェクトで edit 以上(staff の中で実質全員)
    const authz = await authorizeApi([
      { project: "stp", level: "edit" },
      { project: "slp", level: "edit" },
      { project: "accounting", level: "edit" },
      { project: "hojo", level: "edit" },
      { project: "stella", level: "edit" },
    ]);
    if (!authz.ok) return authz.response;

    // 外部ユーザー一覧を取得（アクティブ・停止含む）
    // 注: passwordHash は select で明示的に除外している(漏洩防止)
    const users = await prisma.externalUser.findMany({
      where: {
        status: {
          in: ["active", "suspended"],
        },
      },
      select: {
        id: true,
        companyId: true,
        registrationTokenId: true,
        contactId: true,
        name: true,
        position: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        approvedAt: true,
        approvedBy: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        // passwordHash は意図的に含めない
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
