import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSlide } from "@/lib/proposals/slide-generator";
import type { ProposalContent } from "@/lib/proposals/simulation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Googleスライド生成（テンプレートコピー → データ置換）
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const proposal = await prisma.stpProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return NextResponse.json({ error: "提案書が見つかりません" }, { status: 404 });
    }

    const proposalContent = proposal.proposalContent as unknown as ProposalContent | null;
    if (!proposalContent) {
      return NextResponse.json({ error: "提案書のコンテンツがありません" }, { status: 400 });
    }

    const { input, result } = proposalContent;

    // Googleスライド生成
    const slideResult = await generateSlide({
      companyName: input.companyName,
      jobType: input.jobType,
      targetHires: input.targetHires,
      before: result.before,
      scenario10: result.scenario10,
      scenario20: result.scenario20,
    });

    // DB更新（スライドURL保存）
    await prisma.stpProposal.update({
      where: { id: proposalId },
      data: {
        externalUrl: slideResult.slideUrl,
        externalService: "google_slides",
      },
    });

    return NextResponse.json({
      success: true,
      slideUrl: slideResult.slideUrl,
      embedUrl: slideResult.embedUrl,
      fileId: slideResult.fileId,
    });
  } catch (error) {
    console.error("スライド生成エラー:", error);
    return NextResponse.json(
      { error: "スライド生成に失敗しました" },
      { status: 500 },
    );
  }
}
