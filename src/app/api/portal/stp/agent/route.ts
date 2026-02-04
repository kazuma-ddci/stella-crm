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
    });

    if (!agent) {
      // 代理店として登録されていない場合は空データを返す
      return NextResponse.json({ data: [] });
    }

    // 紹介先企業のSTP企業データを取得
    const stpCompanies = await prisma.stpCompany.findMany({
      where: { agentId: agent.id },
      include: {
        company: {
          select: { name: true },
        },
        currentStage: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 紹介者向けに必要なデータのみ返す
    const data = stpCompanies.map((company) => ({
      id: company.id,
      companyName: company.company.name,
      currentStage: company.currentStage?.name ?? null,
      forecast: company.forecast,
      leadAcquiredDate: company.leadAcquiredDate?.toISOString() ?? null,
      meetingDate: company.meetingDate?.toISOString() ?? null,
      progressDetail: company.progressDetail,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching portal STP agent data:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
