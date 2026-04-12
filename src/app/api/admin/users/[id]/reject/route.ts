import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/api-auth";

export async function POST(
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
