import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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

    // 却下処理（ユーザーを削除）
    await prisma.externalUser.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: "ユーザーの登録申請を却下しました",
    });
  } catch (error) {
    console.error("Error rejecting user:", error);
    return NextResponse.json({ error: "却下に失敗しました" }, { status: 500 });
  }
}
