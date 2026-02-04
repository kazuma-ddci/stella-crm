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

    // stp_client ビューへのアクセス権限チェック
    const displayViews: DisplayViewPermission[] = user.displayViews ?? [];
    if (!hasViewAccess(displayViews, "stp_client")) {
      return NextResponse.json(
        { error: "このデータへのアクセス権限がありません" },
        { status: 403 }
      );
    }

    const companyId = user.companyId as number;

    // 自社のSTP企業データを取得
    const stpCompanies = await prisma.stpCompany.findMany({
      where: { companyId },
      include: {
        currentStage: {
          select: { name: true },
        },
        salesStaff: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // クライアント向けに必要なデータのみ返す
    const data = stpCompanies.map((company) => ({
      id: company.id,
      currentStage: company.currentStage?.name ?? null,
      forecast: company.forecast,
      meetingDate: company.meetingDate?.toISOString() ?? null,
      contractStartDate: company.contractStartDate?.toISOString() ?? null,
      contractEndDate: company.contractEndDate?.toISOString() ?? null,
      progressDetail: company.progressDetail,
      salesStaff: company.salesStaff?.name ?? null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching portal STP client data:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
