import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasViewAccess } from "@/lib/auth/external-user";
import type { DisplayViewPermission } from "@/types/auth";

// ポータルユーザーの企業に紐づくKPIシートを取得
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

    // この企業のSTP企業を取得
    const stpCompanies = await prisma.stpCompany.findMany({
      where: { companyId },
      include: {
        kpiSheets: {
          include: {
            weeklyData: {
              orderBy: { weekStartDate: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // KPIシートを整形
    const kpiSheets = stpCompanies.flatMap((stpCompany) =>
      stpCompany.kpiSheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        stpCompanyId: stpCompany.id,
        weeklyData: sheet.weeklyData.map((w) => ({
          id: w.id,
          weekStartDate: w.weekStartDate.toISOString().split("T")[0],
          weekEndDate: w.weekEndDate.toISOString().split("T")[0],
          targetImpressions: w.targetImpressions,
          targetCpm: w.targetCpm ? Number(w.targetCpm) : null,
          targetClicks: w.targetClicks,
          targetCtr: w.targetCtr ? Number(w.targetCtr) : null,
          targetCpc: w.targetCpc ? Number(w.targetCpc) : null,
          targetApplications: w.targetApplications,
          targetCvr: w.targetCvr ? Number(w.targetCvr) : null,
          targetCpa: w.targetCpa ? Number(w.targetCpa) : null,
          targetCost: w.targetCost,
          actualImpressions: w.actualImpressions,
          actualCpm: w.actualCpm ? Number(w.actualCpm) : null,
          actualClicks: w.actualClicks,
          actualCtr: w.actualCtr ? Number(w.actualCtr) : null,
          actualCpc: w.actualCpc ? Number(w.actualCpc) : null,
          actualApplications: w.actualApplications,
          actualCvr: w.actualCvr ? Number(w.actualCvr) : null,
          actualCpa: w.actualCpa ? Number(w.actualCpa) : null,
          actualCost: w.actualCost,
        })),
        createdAt: sheet.createdAt.toISOString(),
        updatedAt: sheet.updatedAt.toISOString(),
      }))
    );

    return NextResponse.json({ data: kpiSheets });
  } catch (error) {
    console.error("Failed to fetch KPI sheets:", error);
    return NextResponse.json(
      { error: "KPIシートの取得に失敗しました" },
      { status: 500 }
    );
  }
}
