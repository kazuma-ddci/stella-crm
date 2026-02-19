import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasViewAccess } from "@/lib/auth/external-user";
import { isInvalidJobMedia } from "@/lib/stp/job-media";
import type { DisplayViewPermission } from "@/types/auth";

/**
 * 認証・権限チェック共通処理
 * 成功時は { user, companyId } を返す。失敗時は NextResponse を返す。
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

/**
 * 自社のStpCompany IDリストを取得
 */
async function getStpCompanyIds(companyId: number): Promise<number[]> {
  const stpCompanies = await prisma.stpCompany.findMany({
    where: { companyId },
    select: { id: true },
  });
  return stpCompanies.map((c) => c.id);
}

// ============================================
// GET: 自社の求職者一覧 + 求人媒体オプション
// ============================================
export async function GET() {
  try {
    const authResult = await authorizePortalClient();
    if (authResult instanceof NextResponse) return authResult;
    const { companyId } = authResult;

    // 自社のSTP企業を取得
    const stpCompanies = await prisma.stpCompany.findMany({
      where: { companyId },
      select: { id: true, company: { select: { name: true } } },
    });
    const stpCompanyIds = stpCompanies.map((c) => c.id);

    if (stpCompanyIds.length === 0) {
      return NextResponse.json({
        data: [],
        contractOptions: [],
        stpCompanies: [],
      });
    }

    // 求職者データ取得
    const candidates = await prisma.stpCandidate.findMany({
      where: {
        stpCompanyId: { in: stpCompanyIds },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    // アクティブ契約の業種区分・求人媒体を取得
    const today = new Date();
    const activeContracts = await prisma.stpContractHistory.findMany({
      where: {
        companyId,
        status: "active",
        deletedAt: null,
        OR: [
          { contractEndDate: null },
          { contractEndDate: { gte: today } },
        ],
      },
      select: { industryType: true, jobMedia: true },
    });

    // 業種区分→求人媒体のマッピングを構築
    const contractOptions: { industryType: string; jobMedia: string | null }[] = [];
    const seen = new Set<string>();
    for (const contract of activeContracts) {
      const key = `${contract.industryType}::${contract.jobMedia ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        contractOptions.push({
          industryType: contract.industryType,
          jobMedia: contract.jobMedia,
        });
      }
    }

    // レスポンスデータ整形
    const data = candidates.map((c) => ({
      id: c.id,
      lastName: c.lastName,
      firstName: c.firstName,
      interviewDate: c.interviewDate
        ? c.interviewDate.toISOString().split("T")[0]
        : null,
      interviewAttendance: c.interviewAttendance,
      selectionStatus: c.selectionStatus,
      offerDate: c.offerDate
        ? c.offerDate.toISOString().split("T")[0]
        : null,
      joinDate: c.joinDate
        ? c.joinDate.toISOString().split("T")[0]
        : null,
      joinConfirmed: c.joinDate !== null,
      sendDate: c.sendDate
        ? c.sendDate.toISOString().split("T")[0]
        : null,
      industryType: c.industryType,
      jobMedia: c.jobMedia,
      note: c.note,
      stpCompanyId: c.stpCompanyId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      data,
      contractOptions,
      stpCompanies: stpCompanies.map((c) => ({
        id: c.id,
        name: c.company.name,
      })),
    });
  } catch (error) {
    console.error("Error fetching portal STP client candidates:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 求職者を追加
// ============================================
export async function POST(request: NextRequest) {
  try {
    const authResult = await authorizePortalClient();
    if (authResult instanceof NextResponse) return authResult;
    const { companyId } = authResult;

    const body = await request.json();

    const stpCompanyIds = await getStpCompanyIds(companyId);

    // stpCompanyId の決定: 自動セット（最初の企業を使用）
    let resolvedStpCompanyId: number;
    if (body.stpCompanyId) {
      resolvedStpCompanyId = Number(body.stpCompanyId);
      if (!stpCompanyIds.includes(resolvedStpCompanyId)) {
        return NextResponse.json(
          { error: "指定された企業へのアクセス権限がありません" },
          { status: 403 }
        );
      }
    } else {
      resolvedStpCompanyId = stpCompanyIds[0];
    }

    // jobMediaバリデーション
    if (isInvalidJobMedia(body.jobMedia as string)) {
      return NextResponse.json(
        { error: "無効な求人媒体が指定されています" },
        { status: 400 }
      );
    }

    const candidate = await prisma.stpCandidate.create({
      data: {
        lastName: (body.lastName as string) || "",
        firstName: (body.firstName as string) || "",
        interviewDate: body.interviewDate
          ? new Date(body.interviewDate as string)
          : null,
        interviewAttendance: (body.interviewAttendance as string) || null,
        selectionStatus: (body.selectionStatus as string) || null,
        offerDate: body.offerDate
          ? new Date(body.offerDate as string)
          : null,
        joinDate: body.joinDate
          ? new Date(body.joinDate as string)
          : null,
        sendDate: body.sendDate
          ? new Date(body.sendDate as string)
          : null,
        industryType: (body.industryType as string) || null,
        jobMedia: (body.jobMedia as string) || null,
        note: (body.note as string) || null,
        stpCompanyId: resolvedStpCompanyId,
      },
    });

    return NextResponse.json({ data: candidate }, { status: 201 });
  } catch (error) {
    console.error("Error creating portal STP client candidate:", error);
    return NextResponse.json(
      { error: "求職者の追加に失敗しました" },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 求職者を更新
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authorizePortalClient();
    if (authResult instanceof NextResponse) return authResult;
    const { companyId } = authResult;

    const body = await request.json();

    const candidateId = body.id ? Number(body.id) : null;
    if (!candidateId) {
      return NextResponse.json(
        { error: "求職者IDは必須です" },
        { status: 400 }
      );
    }

    // 対象の求職者が自社のSTP企業に属しているか検証
    const stpCompanyIds = await getStpCompanyIds(companyId);
    const existing = await prisma.stpCandidate.findFirst({
      where: {
        id: candidateId,
        stpCompanyId: { in: stpCompanyIds },
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "対象の求職者が見つかりません" },
        { status: 404 }
      );
    }

    // 部分更新: bodyに含まれるフィールドのみ更新
    const updateData: Record<string, unknown> = {};

    if ("lastName" in body) {
      updateData.lastName = (body.lastName as string) || "";
    }
    if ("firstName" in body) {
      updateData.firstName = (body.firstName as string) || "";
    }
    if ("interviewDate" in body) {
      updateData.interviewDate = body.interviewDate
        ? new Date(body.interviewDate as string)
        : null;
    }
    if ("interviewAttendance" in body) {
      updateData.interviewAttendance =
        (body.interviewAttendance as string) || null;
    }
    if ("selectionStatus" in body) {
      updateData.selectionStatus = (body.selectionStatus as string) || null;
    }
    if ("offerDate" in body) {
      updateData.offerDate = body.offerDate
        ? new Date(body.offerDate as string)
        : null;
    }
    if ("joinDate" in body) {
      updateData.joinDate = body.joinDate
        ? new Date(body.joinDate as string)
        : null;
    }
    if ("sendDate" in body) {
      updateData.sendDate = body.sendDate
        ? new Date(body.sendDate as string)
        : null;
    }
    if ("industryType" in body) {
      updateData.industryType = (body.industryType as string) || null;
    }
    if ("jobMedia" in body) {
      if (isInvalidJobMedia(body.jobMedia as string)) {
        return NextResponse.json(
          { error: "無効な求人媒体が指定されています" },
          { status: 400 }
        );
      }
      updateData.jobMedia = (body.jobMedia as string) || null;
    }
    if ("note" in body) {
      updateData.note = (body.note as string) || null;
    }
    if ("stpCompanyId" in body) {
      // 新しいstpCompanyIdも自社所属か検証
      const newStpCompanyId = Number(body.stpCompanyId);
      if (!stpCompanyIds.includes(newStpCompanyId)) {
        return NextResponse.json(
          { error: "指定された企業へのアクセス権限がありません" },
          { status: 403 }
        );
      }
      updateData.stpCompanyId = newStpCompanyId;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.stpCandidate.update({
        where: { id: candidateId },
        data: updateData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating portal STP client candidate:", error);
    return NextResponse.json(
      { error: "求職者の更新に失敗しました" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 求職者を論理削除
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authorizePortalClient();
    if (authResult instanceof NextResponse) return authResult;
    const { companyId } = authResult;

    const body = await request.json();

    const candidateId = body.id ? Number(body.id) : null;
    if (!candidateId) {
      return NextResponse.json(
        { error: "求職者IDは必須です" },
        { status: 400 }
      );
    }

    // 対象の求職者が自社のSTP企業に属しているか検証
    const stpCompanyIds = await getStpCompanyIds(companyId);
    const existing = await prisma.stpCandidate.findFirst({
      where: {
        id: candidateId,
        stpCompanyId: { in: stpCompanyIds },
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "対象の求職者が見つかりません" },
        { status: 404 }
      );
    }

    await prisma.stpCandidate.update({
      where: { id: candidateId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting portal STP client candidate:", error);
    return NextResponse.json(
      { error: "求職者の削除に失敗しました" },
      { status: 500 }
    );
  }
}
