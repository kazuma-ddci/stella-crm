import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendApprovalNotificationEmail } from "@/lib/email";
import { authorizeApi } from "@/lib/api-auth";

interface ApproveRequest {
  viewIds: number[];
}

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
    const staffId = authz.user.id;

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "無効なユーザーIDです" },
        { status: 400 }
      );
    }

    // リクエストボディ取得
    const body: ApproveRequest = await request.json();
    const { viewIds } = body;

    if (!viewIds || viewIds.length === 0) {
      return NextResponse.json(
        { error: "表示権限を1つ以上選択してください" },
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

    if (user.status !== "pending_approval") {
      return NextResponse.json(
        { error: "このユーザーは承認待ち状態ではありません" },
        { status: 400 }
      );
    }

    // トランザクションで承認処理
    await prisma.$transaction(async (tx) => {
      // ユーザーステータス更新
      await tx.externalUser.update({
        where: { id: userId },
        data: {
          status: "active",
          approvedAt: new Date(),
          approvedBy: staffId,
        },
      });

      // 表示権限を付与
      await tx.externalUserDisplayPermission.createMany({
        data: viewIds.map((viewId) => ({
          externalUserId: userId,
          displayViewId: viewId,
        })),
      });
    });

    // 承認通知メール送信
    const emailResult = await sendApprovalNotificationEmail(
      user.email,
      user.name
    );

    if (!emailResult.success) {
      console.error("Failed to send approval notification:", emailResult.error);
      return NextResponse.json({
        success: true,
        warning: "承認は完了しましたが、通知メールの送信に失敗しました",
      });
    }

    return NextResponse.json({
      success: true,
      message: "ユーザーを承認しました",
    });
  } catch (error) {
    console.error("Error approving user:", error);
    return NextResponse.json({ error: "承認に失敗しました" }, { status: 500 });
  }
}
