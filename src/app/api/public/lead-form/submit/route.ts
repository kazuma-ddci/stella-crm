import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateProposalNumber } from "@/lib/proposals/generate-number";
import { submissionToSimulationInput } from "@/lib/proposals/submission-to-input";
import {
  calculateSimulation,
  type ProposalContent,
  type SlideVersion,
  type SimulationInput,
  type SimulationResult,
} from "@/lib/proposals/simulation";
import { generateSlide } from "@/lib/proposals/slide-generator";

/**
 * Googleスライドをバックグラウンドで生成
 * フォーム送信のレスポンスをブロックしないように非同期実行
 */
function generateSlideInBackground(
  proposalId: number,
  simulationInput: SimulationInput,
  simulationResult: SimulationResult,
) {
  // awaitせずに実行（fire-and-forget）
  (async () => {
    try {
      const slideResult = await generateSlide({
        companyName: simulationInput.companyName,
        jobType: simulationInput.jobType,
        targetHires: simulationInput.targetHires,
        before: simulationResult.before,
        scenario10: simulationResult.scenario10,
        scenario20: simulationResult.scenario20,
      });

      const slideVersion: SlideVersion = {
        version: 1,
        slideFileId: slideResult.fileId,
        slideUrl: slideResult.slideUrl,
        embedUrl: slideResult.embedUrl,
        createdAt: new Date().toISOString(),
        inputSnapshot: { ...simulationInput },
        resultSnapshot: simulationResult,
        confirmedProposalId: null,
        deletedAt: null,
        editUnlockedAt: null,
      };

      // 提案書を更新（スライド情報を追加）
      const existing = await prisma.stpProposal.findUnique({ where: { id: proposalId } });
      if (existing) {
        const existingContent = existing.proposalContent as unknown as ProposalContent;
        const updatedContent: ProposalContent = {
          ...existingContent,
          slides: [slideVersion],
        };

        await prisma.stpProposal.update({
          where: { id: proposalId },
          data: {
            externalUrl: slideResult.slideUrl,
            externalService: "google_slides",
            proposalContent: JSON.parse(JSON.stringify(updatedContent)) as Prisma.InputJsonValue,
          },
        });
      }

      console.log(`バックグラウンドスライド生成完了: proposalId=${proposalId}`);
    } catch (error) {
      console.error(`バックグラウンドスライド生成エラー (proposalId=${proposalId}):`, error);
    }
  })();
}

interface SubmissionData {
  token: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  pastHiringJobTypes?: string[];
  pastRecruitingCostAgency?: number;
  pastRecruitingCostAds?: number;
  pastRecruitingCostReferral?: number;
  pastRecruitingCostOther?: number;
  pastHiringCount?: number;
  desiredJobTypes?: string[];
  annualBudget?: number;
  annualHiringTarget?: number;
  hiringAreas?: string[];
  hiringTimeline?: string;
  ageRangeMin?: number;
  ageRangeMax?: number;
  ageRange?: string;  // 新フィールド: 不問, 〜30, 〜35, etc.
  requiredConditions?: string;
  preferredConditions?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: SubmissionData = await request.json();

    // 必須項目のバリデーション
    if (!data.token || !data.companyName || !data.contactName || !data.contactEmail) {
      return NextResponse.json(
        { success: false, error: "必須項目が入力されていません" },
        { status: 400 }
      );
    }

    // トークン検証
    const tokenRecord = await prisma.stpLeadFormToken.findUnique({
      where: { token: data.token },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: "無効なトークンです" },
        { status: 404 }
      );
    }

    if (tokenRecord.status !== "active") {
      return NextResponse.json(
        { success: false, error: "このフォームは現在利用できません" },
        { status: 403 }
      );
    }

    if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "このフォームの有効期限が切れています" },
        { status: 403 }
      );
    }

    // フォーム回答を保存
    const submission = await prisma.stpLeadFormSubmission.create({
      data: {
        tokenId: tokenRecord.id,
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone || null,
        pastHiringJobTypes: data.pastHiringJobTypes ? JSON.stringify(data.pastHiringJobTypes) : null,
        pastRecruitingCostAgency: data.pastRecruitingCostAgency || null,
        pastRecruitingCostAds: data.pastRecruitingCostAds || null,
        pastRecruitingCostReferral: data.pastRecruitingCostReferral || null,
        pastRecruitingCostOther: data.pastRecruitingCostOther || null,
        pastHiringCount: data.pastHiringCount || null,
        desiredJobTypes: data.desiredJobTypes ? JSON.stringify(data.desiredJobTypes) : null,
        annualBudget: data.annualBudget || null,
        annualHiringTarget: data.annualHiringTarget || null,
        hiringAreas: data.hiringAreas ? JSON.stringify(data.hiringAreas) : null,
        hiringTimeline: data.hiringTimeline || null,
        ageRangeMin: data.ageRangeMin || null,
        ageRangeMax: data.ageRangeMax || null,
        ageRange: data.ageRange || null,
        requiredConditions: data.requiredConditions || null,
        preferredConditions: data.preferredConditions || null,
        status: "pending",
      },
    });

    // シミュレーション計算を実行（軽量なので同期でOK）
    const simulationInput = submissionToSimulationInput({
      companyName: data.companyName,
      pastRecruitingCostAgency: data.pastRecruitingCostAgency ?? null,
      pastRecruitingCostAds: data.pastRecruitingCostAds ?? null,
      pastRecruitingCostReferral: data.pastRecruitingCostReferral ?? null,
      pastRecruitingCostOther: data.pastRecruitingCostOther ?? null,
      pastHiringCount: data.pastHiringCount ?? null,
      desiredJobTypes: data.desiredJobTypes ? JSON.stringify(data.desiredJobTypes) : null,
      annualHiringTarget: data.annualHiringTarget ?? null,
      hiringAreas: data.hiringAreas ? JSON.stringify(data.hiringAreas) : null,
    });

    const simulationResult = calculateSimulation(simulationInput);

    // 提案書をスライドなしで即座に作成（お客様の待ち時間を最小化）
    const proposalContent: ProposalContent = {
      input: simulationInput,
      originalInput: { ...simulationInput },
      result: simulationResult,
      generatedAt: new Date().toISOString(),
      version: 1,
      slides: [],
    };

    const proposalNumber = await generateProposalNumber();
    const proposal = await prisma.stpProposal.create({
      data: {
        submission: { connect: { id: submission.id } },
        title: `${data.companyName} 様向け提案書`,
        proposalNumber,
        status: "draft",
        isAutoGenerated: true,
        note: "リード獲得フォームから自動生成",
        proposalContent: JSON.parse(JSON.stringify(proposalContent)) as Prisma.InputJsonValue,
      },
    });

    // Googleスライド生成はバックグラウンドで実行（レスポンスをブロックしない）
    generateSlideInBackground(proposal.id, simulationInput, simulationResult);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
