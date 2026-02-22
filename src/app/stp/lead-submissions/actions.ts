"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import {
  getOrCreateCompanyFolder,
  moveSlideToFolder,
} from "@/lib/proposals/slide-generator";
import type { ProposalContent } from "@/lib/proposals/simulation";

/**
 * 紐付け時にスライドを企業フォルダへ移動（エラーはログのみ）
 */
async function moveSlidesToCompanyFolder(
  submissionId: number,
  companyCode: string,
  companyName: string,
) {
  try {
    const proposals = await prisma.stpProposal.findMany({
      where: { submissionId, NOT: { proposalContent: { equals: Prisma.DbNull } } },
      select: { proposalContent: true },
    });

    if (proposals.length === 0) return;

    const folderId = await getOrCreateCompanyFolder(companyCode, companyName);

    for (const p of proposals) {
      const content = p.proposalContent as unknown as ProposalContent | null;
      if (!content?.slides) continue;
      for (const slide of content.slides) {
        if (slide.deletedAt) continue;
        try {
          await moveSlideToFolder(slide.slideFileId, folderId);
        } catch (e) {
          console.error(`スライド移動エラー (fileId=${slide.slideFileId}):`, e);
        }
      }
    }
  } catch (e) {
    console.error("企業フォルダへのスライド移動エラー:", e);
  }
}

// 新規企業として処理
export async function processAsNewCompany(
  submissionId: number,
  processingNote?: string,
  stpCompanyInfo?: {
    companyName?: string;
    note?: string;
    agentId?: number;
    leadAcquiredDate?: string;
    industry?: string;
    revenueScale?: string;
    websiteUrl?: string;
  }
) {
  await requireEdit("stp");
  const submission = await prisma.stpLeadFormSubmission.findUnique({
    where: { id: submissionId },
    include: {
      token: {
        include: {
          agent: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("フォーム回答が見つかりません");
  }

  if (submission.status !== "pending") {
    throw new Error("この回答は既に処理されています");
  }

  // トランザクションで全顧客マスタとSTP企業を作成
  const result = await prisma.$transaction(async (tx) => {
    // 企業コードを生成
    const lastCompany = await tx.masterStellaCompany.findFirst({
      orderBy: { companyCode: "desc" },
    });
    const lastNumber = lastCompany
      ? parseInt(lastCompany.companyCode.replace("SC-", ""), 10)
      : 0;
    const newCompanyCode = `SC-${lastNumber + 1}`;

    // 全顧客マスタに企業を作成（代理店経由のリードは流入経路を自動設定）
    const companyName = stpCompanyInfo?.companyName || submission.companyName;
    const masterCompany = await tx.masterStellaCompany.create({
      data: {
        companyCode: newCompanyCode,
        name: companyName,
        industry: stpCompanyInfo?.industry || null,
        revenueScale: stpCompanyInfo?.revenueScale || null,
        websiteUrl: stpCompanyInfo?.websiteUrl || null,
        leadSource: submission.token.agentId ? "代理店" : "Web問い合わせ",
        note: `リード獲得フォームから登録\n担当者: ${submission.contactName}\nメール: ${submission.contactEmail}${submission.contactPhone ? `\n電話: ${submission.contactPhone}` : ""}`,
      },
    });

    // 拠点を作成（担当者情報含む）
    await tx.stellaCompanyLocation.create({
      data: {
        companyId: masterCompany.id,
        name: "本社",
        email: submission.contactEmail,
        phone: submission.contactPhone,
        isPrimary: true,
      },
    });

    // 担当者を作成
    await tx.stellaCompanyContact.create({
      data: {
        companyId: masterCompany.id,
        name: submission.contactName,
        email: submission.contactEmail,
        phone: submission.contactPhone,
        isPrimary: true,
      },
    });

    // 流入経路のIDを取得
    const leadSourceName = submission.token.agentId ? "代理店" : "Web問い合わせ";
    const agentLeadSource = await tx.stpLeadSource.findFirst({
      where: { name: leadSourceName },
    });

    // STP企業を作成
    const agentId = stpCompanyInfo?.agentId ?? submission.token.agentId;
    const leadAcquiredDate = stpCompanyInfo?.leadAcquiredDate
      ? new Date(stpCompanyInfo.leadAcquiredDate)
      : submission.submittedAt;
    const stpCompany = await tx.stpCompany.create({
      data: {
        companyId: masterCompany.id,
        agentId,
        currentStageId: 1, // リードステージ
        leadAcquiredDate,
        leadSourceId: agentLeadSource?.id || null,
        note: stpCompanyInfo?.note || buildStpCompanyNote(submission),
      },
    });

    // フォーム回答の企業名が変更されている場合は更新
    const updateSubmissionData: Record<string, unknown> = {
      status: "processed",
      stpCompanyId: stpCompany.id,
      masterCompanyId: masterCompany.id,
      processedAt: new Date(),
      processingNote,
    };
    if (stpCompanyInfo?.companyName && stpCompanyInfo.companyName !== submission.companyName) {
      updateSubmissionData.companyName = stpCompanyInfo.companyName;
    }

    // フォーム回答を処理済みに更新
    await tx.stpLeadFormSubmission.update({
      where: { id: submissionId },
      data: updateSubmissionData,
    });

    // このsubmissionに紐付いている提案書にstpCompanyIdを設定
    await tx.stpProposal.updateMany({
      where: { submissionId: submissionId, stpCompanyId: null },
      data: { stpCompanyId: stpCompany.id },
    });

    return { masterCompany, stpCompany };
  });

  // スライドを企業フォルダへ移動（非同期・エラー無視）
  await moveSlidesToCompanyFolder(
    submissionId,
    result.masterCompany.companyCode,
    result.masterCompany.name,
  );

  revalidatePath("/stp/lead-submissions");
  revalidatePath("/stp/companies");
  revalidatePath("/companies");

  return result;
}

// 既存企業に紐付けて処理
export async function processWithExistingCompany(
  submissionId: number,
  masterCompanyId: number,
  processingNote?: string,
  overwriteAgent?: boolean, // 代理店を上書きするかどうか
  companyNameUnification?: "master" | "form" | null, // 企業名統一: master=マスタに統一, form=フォームに統一
  stpCompanyInfo?: {
    companyName?: string;
    note?: string;
    agentId?: number;
    leadAcquiredDate?: string;
    industry?: string;
    revenueScale?: string;
    websiteUrl?: string;
  }
) {
  await requireEdit("stp");
  const submission = await prisma.stpLeadFormSubmission.findUnique({
    where: { id: submissionId },
    include: {
      token: {
        include: {
          agent: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("フォーム回答が見つかりません");
  }

  if (submission.status !== "pending") {
    throw new Error("この回答は既に処理されています");
  }

  // 既存企業がSTP企業として登録済みかチェック
  const existingStpCompany = await prisma.stpCompany.findFirst({
    where: { companyId: masterCompanyId },
  });

  // トランザクションで処理
  const result = await prisma.$transaction(async (tx) => {
    let stpCompanyId: number;

    // 流入経路のIDを取得
    const leadSourceName = submission.token.agentId ? "代理店" : "Web問い合わせ";
    const agentLeadSource = await tx.stpLeadSource.findFirst({
      where: { name: leadSourceName },
    });

    const agentId = stpCompanyInfo?.agentId ?? submission.token.agentId;
    const leadAcquiredDate = stpCompanyInfo?.leadAcquiredDate
      ? new Date(stpCompanyInfo.leadAcquiredDate)
      : submission.submittedAt;

    if (existingStpCompany) {
      // 既存のSTP企業に紐付け → 情報を更新
      stpCompanyId = existingStpCompany.id;

      const updateData: Record<string, unknown> = {};
      // 代理店の更新（stpCompanyInfoのagentIdが指定されていて異なる場合、またはoverwriteAgent）
      if (stpCompanyInfo?.agentId && stpCompanyInfo.agentId !== existingStpCompany.agentId) {
        updateData.agentId = stpCompanyInfo.agentId;
      } else if (overwriteAgent && existingStpCompany.agentId !== submission.token.agentId) {
        updateData.agentId = submission.token.agentId;
      }
      // その他のフィールド更新
      if (stpCompanyInfo?.note !== undefined) {
        updateData.note = stpCompanyInfo.note || existingStpCompany.note;
      }
      if (stpCompanyInfo?.leadAcquiredDate) {
        updateData.leadAcquiredDate = leadAcquiredDate;
      }
      if (!existingStpCompany.leadSourceId && agentLeadSource) {
        updateData.leadSourceId = agentLeadSource.id;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.stpCompany.update({
          where: { id: existingStpCompany.id },
          data: updateData,
        });
      }
    } else {
      // STP企業を新規作成
      const stpCompany = await tx.stpCompany.create({
        data: {
          companyId: masterCompanyId,
          agentId,
          currentStageId: 1, // リードステージ
          leadAcquiredDate,
          leadSourceId: agentLeadSource?.id || null,
          note: stpCompanyInfo?.note || buildStpCompanyNote(submission),
        },
      });
      stpCompanyId = stpCompany.id;
    }

    // MasterStellaCompanyの業界・売上規模・企業HP・流入経路を更新
    {
      const masterUpdateData: Record<string, unknown> = {};
      if (stpCompanyInfo?.industry !== undefined) masterUpdateData.industry = stpCompanyInfo.industry || null;
      if (stpCompanyInfo?.revenueScale !== undefined) masterUpdateData.revenueScale = stpCompanyInfo.revenueScale || null;
      if (stpCompanyInfo?.websiteUrl !== undefined) masterUpdateData.websiteUrl = stpCompanyInfo.websiteUrl || null;

      // 流入経路が未設定の場合、自動設定
      const masterCompany = await tx.masterStellaCompany.findUnique({
        where: { id: masterCompanyId },
        select: { leadSource: true },
      });
      if (!masterCompany?.leadSource) {
        masterUpdateData.leadSource = submission.token.agentId ? "代理店" : "Web問い合わせ";
      }

      if (Object.keys(masterUpdateData).length > 0) {
        await tx.masterStellaCompany.update({
          where: { id: masterCompanyId },
          data: masterUpdateData,
        });
      }
    }

    // 企業名統一処理
    if (companyNameUnification === "master") {
      // フォーム回答の企業名を全顧客マスタの企業名に更新
      const masterCompany = await tx.masterStellaCompany.findUnique({
        where: { id: masterCompanyId },
      });
      if (masterCompany) {
        await tx.stpLeadFormSubmission.update({
          where: { id: submissionId },
          data: { companyName: masterCompany.name },
        });
      }
    } else if (companyNameUnification === "form") {
      // 全顧客マスタの企業名をフォーム回答の企業名に更新
      const companyName = stpCompanyInfo?.companyName || submission.companyName;
      await tx.masterStellaCompany.update({
        where: { id: masterCompanyId },
        data: { name: companyName },
      });
    }

    // フォーム回答を処理済みに更新
    await tx.stpLeadFormSubmission.update({
      where: { id: submissionId },
      data: {
        status: "processed",
        stpCompanyId: stpCompanyId,
        masterCompanyId,
        processedAt: new Date(),
        processingNote,
      },
    });

    // このsubmissionに紐付いている提案書にstpCompanyIdを設定
    await tx.stpProposal.updateMany({
      where: { submissionId: submissionId, stpCompanyId: null },
      data: { stpCompanyId: stpCompanyId },
    });

    return { stpCompanyId, isExisting: !!existingStpCompany };
  });

  // スライドを企業フォルダへ移動（非同期・エラー無視）
  try {
    const masterCompany = await prisma.masterStellaCompany.findUnique({
      where: { id: masterCompanyId },
      select: { companyCode: true, name: true },
    });
    if (masterCompany) {
      await moveSlidesToCompanyFolder(
        submissionId,
        masterCompany.companyCode,
        masterCompany.name,
      );
    }
  } catch (e) {
    console.error("既存企業紐付け時のスライド移動エラー:", e);
  }

  revalidatePath("/stp/lead-submissions");
  revalidatePath("/stp/companies");
  revalidatePath(`/companies/${masterCompanyId}`);

  return result;
}

// フォーム回答を編集
export async function updateSubmission(
  submissionId: number,
  data: {
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string | null;
    pastHiringJobTypes?: string[];
    pastRecruitingCostAgency?: number | null;
    pastRecruitingCostAds?: number | null;
    pastRecruitingCostReferral?: number | null;
    pastRecruitingCostOther?: number | null;
    pastHiringCount?: number | null;
    desiredJobTypes?: string[];
    annualBudget?: number | null;
    annualHiringTarget?: number | null;
    hiringAreas?: string[];
    hiringTimeline?: string | null;
    ageRangeMin?: number | null;
    ageRangeMax?: number | null;
    ageRange?: string | null;
    requiredConditions?: string | null;
    preferredConditions?: string | null;
    masterCompanyId?: number | null;
    overwriteAgent?: boolean;
  }
) {
  await requireEdit("stp");
  const submission = await prisma.stpLeadFormSubmission.findUnique({
    where: { id: submissionId },
    include: {
      token: true,
    },
  });

  if (!submission) {
    throw new Error("フォーム回答が見つかりません");
  }

  await prisma.$transaction(async (tx) => {
    // フォーム回答を更新
    await tx.stpLeadFormSubmission.update({
      where: { id: submissionId },
      data: {
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        pastHiringJobTypes: data.pastHiringJobTypes ? JSON.stringify(data.pastHiringJobTypes) : null,
        pastRecruitingCostAgency: data.pastRecruitingCostAgency,
        pastRecruitingCostAds: data.pastRecruitingCostAds,
        pastRecruitingCostReferral: data.pastRecruitingCostReferral,
        pastRecruitingCostOther: data.pastRecruitingCostOther,
        pastHiringCount: data.pastHiringCount,
        desiredJobTypes: data.desiredJobTypes ? JSON.stringify(data.desiredJobTypes) : null,
        annualBudget: data.annualBudget,
        annualHiringTarget: data.annualHiringTarget,
        hiringAreas: data.hiringAreas ? JSON.stringify(data.hiringAreas) : null,
        hiringTimeline: data.hiringTimeline,
        ageRangeMin: data.ageRangeMin,
        ageRangeMax: data.ageRangeMax,
        ageRange: data.ageRange,
        requiredConditions: data.requiredConditions,
        preferredConditions: data.preferredConditions,
        masterCompanyId: data.masterCompanyId,
      },
    });

    // 代理店上書きが指定されていて、紐付け企業がある場合
    if (data.overwriteAgent && data.masterCompanyId) {
      const stpCompany = await tx.stpCompany.findFirst({
        where: { companyId: data.masterCompanyId },
      });

      if (stpCompany && submission.token.agentId && stpCompany.agentId !== submission.token.agentId) {
        await tx.stpCompany.update({
          where: { id: stpCompany.id },
          data: { agentId: submission.token.agentId },
        });
      }
    }
  });

  revalidatePath("/stp/lead-submissions");
  revalidatePath("/stp/companies");
  if (submission.masterCompanyId) {
    revalidatePath(`/companies/${submission.masterCompanyId}`);
  }
  if (data.masterCompanyId && data.masterCompanyId !== submission.masterCompanyId) {
    revalidatePath(`/companies/${data.masterCompanyId}`);
  }
}

// 却下する
export async function rejectSubmission(
  submissionId: number,
  processingNote?: string
) {
  await requireEdit("stp");
  const submission = await prisma.stpLeadFormSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("フォーム回答が見つかりません");
  }

  if (submission.status !== "pending") {
    throw new Error("この回答は既に処理されています");
  }

  await prisma.stpLeadFormSubmission.update({
    where: { id: submissionId },
    data: {
      status: "rejected",
      processedAt: new Date(),
      processingNote,
    },
  });

  revalidatePath("/stp/lead-submissions");
}

// STP企業のノートを生成
function buildStpCompanyNote(submission: {
  pastHiringJobTypes: string | null;
  pastRecruitingCostAgency: number | null;
  pastRecruitingCostAds: number | null;
  pastRecruitingCostReferral: number | null;
  pastRecruitingCostOther: number | null;
  pastHiringCount: number | null;
  desiredJobTypes: string | null;
  annualBudget: number | null;
  annualHiringTarget: number | null;
  hiringAreas: string | null;
  hiringTimeline: string | null;
  ageRangeMin: number | null;
  ageRangeMax: number | null;
  requiredConditions: string | null;
  preferredConditions: string | null;
}): string {
  const lines: string[] = ["【リード獲得フォームからの情報】"];

  // 採用実績
  if (submission.pastHiringJobTypes) {
    try {
      const jobTypes = JSON.parse(submission.pastHiringJobTypes);
      if (Array.isArray(jobTypes) && jobTypes.length > 0) {
        lines.push(`過去採用職種: ${jobTypes.join(", ")}`);
      }
    } catch {}
  }

  const costs: string[] = [];
  if (submission.pastRecruitingCostAgency) costs.push(`人材紹介: ${submission.pastRecruitingCostAgency.toLocaleString()}円`);
  if (submission.pastRecruitingCostAds) costs.push(`求人広告: ${submission.pastRecruitingCostAds.toLocaleString()}円`);
  if (submission.pastRecruitingCostReferral) costs.push(`リファラル: ${submission.pastRecruitingCostReferral.toLocaleString()}円`);
  if (submission.pastRecruitingCostOther) costs.push(`その他: ${submission.pastRecruitingCostOther.toLocaleString()}円`);
  if (costs.length > 0) {
    lines.push(`過去採用費用: ${costs.join(", ")}`);
  }

  if (submission.pastHiringCount) {
    lines.push(`過去採用人数: ${submission.pastHiringCount}人`);
  }

  // 希望情報
  if (submission.desiredJobTypes) {
    try {
      const jobTypes = JSON.parse(submission.desiredJobTypes);
      if (Array.isArray(jobTypes) && jobTypes.length > 0) {
        lines.push(`希望職種: ${jobTypes.join(", ")}`);
      }
    } catch {}
  }

  if (submission.annualBudget) {
    lines.push(`年間予算: ${submission.annualBudget.toLocaleString()}円`);
  }

  if (submission.annualHiringTarget) {
    lines.push(`年間採用予定: ${submission.annualHiringTarget}人`);
  }

  if (submission.hiringAreas) {
    try {
      const areas = JSON.parse(submission.hiringAreas);
      if (Array.isArray(areas) && areas.length > 0) {
        lines.push(`採用エリア: ${areas.join(", ")}`);
      }
    } catch {}
  }

  if (submission.hiringTimeline) {
    lines.push(`採用希望時期: ${submission.hiringTimeline}`);
  }

  if (submission.ageRangeMin || submission.ageRangeMax) {
    const range = [];
    if (submission.ageRangeMin) range.push(`${submission.ageRangeMin}歳`);
    if (submission.ageRangeMax) range.push(`${submission.ageRangeMax}歳`);
    lines.push(`採用可能年齢: ${range.join("〜")}`);
  }

  if (submission.requiredConditions) {
    lines.push(`必須条件: ${submission.requiredConditions}`);
  }

  if (submission.preferredConditions) {
    lines.push(`希望条件: ${submission.preferredConditions}`);
  }

  return lines.join("\n");
}
