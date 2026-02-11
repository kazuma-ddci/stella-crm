import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasViewAccess } from "@/lib/auth/external-user";
import type { DisplayViewPermission } from "@/types/auth";

/**
 * 認証・権限チェック共通処理
 */
async function authorizePortalClient(): Promise<
  | { user: { companyId: number }; companyId: number }
  | NextResponse
> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any;

  if (user.userType !== "external") {
    return NextResponse.json(
      { error: "このAPIは外部ユーザー専用です" },
      { status: 403 }
    );
  }

  const displayViews: DisplayViewPermission[] = user.displayViews ?? [];
  if (!hasViewAccess(displayViews, "stp_client")) {
    return NextResponse.json(
      { error: "このデータへのアクセス権限がありません" },
      { status: 403 }
    );
  }

  const companyId = user.companyId as number;
  return { user, companyId };
}

// ============================================
// GET: 契約書情報 + 契約履歴
// ============================================
export async function GET() {
  try {
    const authResult = await authorizePortalClient();
    if (authResult instanceof NextResponse) return authResult;
    const { companyId } = authResult;

    // STPプロジェクトのIDを取得
    const stpProject = await prisma.masterProject.findFirst({
      where: { code: "stp" },
      select: { id: true },
    });

    // 契約書情報（MasterContract）
    const contracts = stpProject
      ? await prisma.masterContract.findMany({
          where: {
            companyId,
            projectId: stpProject.id,
          },
          select: {
            id: true,
            signedDate: true,
            startDate: true,
            endDate: true,
            filePath: true,
            fileName: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // 契約履歴（StpContractHistory）
    const contractHistories = await prisma.stpContractHistory.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        industryType: true,
        contractPlan: true,
        jobMedia: true,
        contractStartDate: true,
        contractEndDate: true,
        initialFee: true,
        monthlyFee: true,
        performanceFee: true,
        salesStaffId: true,
        operationStaffId: true,
        status: true,
        operationStatus: true,
        salesStaff: { select: { name: true } },
        operationStaff: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // レスポンス整形
    const formattedContracts = contracts.map((c) => ({
      id: c.id,
      signedDate: c.signedDate ? c.signedDate.toISOString().split("T")[0] : null,
      startDate: c.startDate ? c.startDate.toISOString().split("T")[0] : null,
      endDate: c.endDate ? c.endDate.toISOString().split("T")[0] : null,
      filePath: c.filePath,
      fileName: c.fileName,
    }));

    const formattedHistories = contractHistories.map((h) => ({
      id: h.id,
      industryType: h.industryType,
      contractPlan: h.contractPlan,
      jobMedia: h.jobMedia,
      contractStartDate: h.contractStartDate.toISOString().split("T")[0],
      contractEndDate: h.contractEndDate
        ? h.contractEndDate.toISOString().split("T")[0]
        : null,
      initialFee: h.initialFee,
      monthlyFee: h.monthlyFee,
      performanceFee: h.performanceFee,
      salesStaffName: h.salesStaff?.name ?? null,
      operationStaffName: h.operationStaff?.name ?? null,
      status: h.status,
      operationStatus: h.operationStatus,
    }));

    return NextResponse.json({
      contracts: formattedContracts,
      contractHistories: formattedHistories,
    });
  } catch (error) {
    console.error("Error fetching portal STP client contracts:", error);
    return NextResponse.json(
      { error: "契約情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
