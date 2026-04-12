import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/api-auth";

interface UpdateUserRequest {
  status?: "active" | "suspended";
  viewIds?: number[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "無効なユーザーIDです" },
        { status: 400 }
      );
    }

    // ユーザー取得
    // 注: passwordHash は select で明示的に除外している
    const user = await prisma.externalUser.findUnique({
      where: { id: userId },
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
    });

    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // projectCode フィールドを維持（互換性のため）
    const userWithCode = {
      ...user,
      displayPermissions: user.displayPermissions.map((dp) => ({
        ...dp,
        displayView: {
          ...dp.displayView,
          projectCode: dp.displayView.project.code,
        },
      })),
    };

    return NextResponse.json({ user: userWithCode });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "無効なユーザーIDです" },
        { status: 400 }
      );
    }

    // リクエストボディ取得
    const body: UpdateUserRequest = await request.json();
    const { status, viewIds } = body;

    // ユーザー存在確認
    const user = await prisma.externalUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // ステータス更新
      if (status) {
        await tx.externalUser.update({
          where: { id: userId },
          data: { status },
        });
      }

      // 権限更新
      if (viewIds !== undefined) {
        // 既存の権限を削除
        await tx.externalUserDisplayPermission.deleteMany({
          where: { externalUserId: userId },
        });

        // 新しい権限を追加
        if (viewIds.length > 0) {
          await tx.externalUserDisplayPermission.createMany({
            data: viewIds.map((viewId) => ({
              externalUserId: userId,
              displayViewId: viewId,
            })),
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "ユーザー情報を更新しました",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "ユーザー情報の更新に失敗しました" },
      { status: 500 }
    );
  }
}
