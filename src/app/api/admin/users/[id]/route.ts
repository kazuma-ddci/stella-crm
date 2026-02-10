import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface UpdateUserRequest {
  status?: "active" | "suspended";
  viewIds?: number[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "無効なユーザーIDです" },
        { status: 400 }
      );
    }

    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffId = (session.user as any).id as number;

    // 管理者権限チェック
    const staffPermissions = await prisma.staffPermission.findMany({
      where: { staffId },
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

    // ユーザー取得
    const user = await prisma.externalUser.findUnique({
      where: { id: userId },
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
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "無効なユーザーIDです" },
        { status: 400 }
      );
    }

    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffId = (session.user as any).id as number;

    // 管理者権限チェック
    const staffPermissions = await prisma.staffPermission.findMany({
      where: { staffId },
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
