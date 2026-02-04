import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasViewAccess } from "@/lib/auth/external-user";
import type { DisplayViewPermission } from "@/types/auth";

export async function GET() {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session.user as any;

    // 外部ユーザーチェック
    if (user.userType !== "external") {
      return NextResponse.json(
        { error: "このAPIは外部ユーザー専用です" },
        { status: 403 }
      );
    }

    // stp_agent ビューへのアクセス権限チェック
    const displayViews: DisplayViewPermission[] = user.displayViews ?? [];
    if (!hasViewAccess(displayViews, "stp_agent")) {
      return NextResponse.json(
        { error: "このデータへのアクセス権限がありません" },
        { status: 403 }
      );
    }

    const companyId = user.companyId as number;

    // 自社が代理店として登録されているか確認
    const agent = await prisma.stpAgent.findUnique({
      where: { companyId },
      include: {
        leadFormToken: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "代理店として登録されていません" },
        { status: 404 }
      );
    }

    if (!agent.leadFormToken) {
      return NextResponse.json(
        { error: "リード獲得フォームが設定されていません" },
        { status: 404 }
      );
    }

    // トークンステータスを確認
    if (agent.leadFormToken.status !== "active") {
      return NextResponse.json({
        token: null,
        status: agent.leadFormToken.status,
        message: "リード獲得フォームは現在無効になっています",
      });
    }

    // 有効期限チェック
    if (agent.leadFormToken.expiresAt && agent.leadFormToken.expiresAt < new Date()) {
      return NextResponse.json({
        token: null,
        status: "expired",
        message: "リード獲得フォームの有効期限が切れています",
      });
    }

    return NextResponse.json({
      token: agent.leadFormToken.token,
      status: agent.leadFormToken.status,
    });
  } catch (error) {
    console.error("Error fetching lead form token:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
