import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateSlide, getOrCreateCompanyFolder } from "@/lib/proposals/slide-generator";
import { calculateSimulation, type ProposalContent, type SlideVersion } from "@/lib/proposals/simulation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Googleスライド生成（テンプレートコピー → データ置換）
 * 新しいバージョンとしてslides[]配列に追加
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    const { input } = proposalContent;

    // 最新の入力値で再計算
    const result = calculateSimulation(input);

    // 既存スライドの最大バージョン番号を取得
    const existingSlides = proposalContent.slides || [];
    const maxVersion = existingSlides.reduce((max, s) => Math.max(max, s.version), 0);
    const newVersion = maxVersion + 1;

    // 企業紐付け済みの場合は企業フォルダに作成
    let folderId: string | undefined;
    if (proposal.stpCompanyId) {
      try {
        const stpCompany = await prisma.stpCompany.findUnique({
          where: { id: proposal.stpCompanyId },
          include: { company: { select: { companyCode: true, name: true } } },
        });
        if (stpCompany?.company) {
          folderId = await getOrCreateCompanyFolder(
            stpCompany.company.companyCode,
            stpCompany.company.name,
          );
        }
      } catch (e) {
        console.error("企業フォルダ取得エラー（UNLINKED_FOLDERにフォールバック）:", e);
      }
    }

    // Googleスライド生成
    const slideResult = await generateSlide({
      companyName: input.companyName,
      jobType: input.jobType,
      targetHires: input.targetHires,
      before: result.before,
      scenario10: result.scenario10,
      scenario20: result.scenario20,
    }, folderId);

    // 新しいSlideVersionを作成
    const newSlide: SlideVersion = {
      version: newVersion,
      slideFileId: slideResult.fileId,
      slideUrl: slideResult.slideUrl,
      embedUrl: slideResult.embedUrl,
      createdAt: new Date().toISOString(),
      inputSnapshot: { ...input },
      resultSnapshot: result,
      confirmedProposalId: null,
      deletedAt: null,
      editUnlockedAt: null,
    };

    // proposalContentを更新（slides[]に追加 + 最新の計算結果を反映）
    const updatedContent: ProposalContent = {
      ...proposalContent,
      result,
      generatedAt: new Date().toISOString(),
      slides: [...existingSlides, newSlide],
    };

    // DB更新
    await prisma.stpProposal.update({
      where: { id: proposalId },
      data: {
        externalUrl: slideResult.slideUrl,
        externalService: "google_slides",
        proposalContent: JSON.parse(JSON.stringify(updatedContent)) as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      version: newVersion,
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
