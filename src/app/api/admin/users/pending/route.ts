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

    // 承認待ちユーザーを取得（メール未認証も含む）
    // 注: passwordHash は select で明示的に除外している
    const users = await prisma.externalUser.findMany({
      where: {
        status: {
          in: ["pending_email", "pending_approval"],
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
