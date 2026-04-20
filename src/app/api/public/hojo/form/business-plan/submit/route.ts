import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 補助金事業計画フォーム 送信API（公開・認証不要）
 *
 * Body (JSON):
 *   - uid: string (LINE UID)
 *   - answers: Record<string, string> (フォーム回答)
 *   - fileUrls: Record<string, { filePath, fileName, fileSize, mimeType }> (アップロード済みファイル)
 *
 * answers は構造化されたキーで保存され、後からPDF生成やBBS社への共有に利用される。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, answers, fileUrls } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 },
      );
    }

    // 構造化された回答データにメタ情報を付与
    const structuredAnswers = {
      _meta: {
        formVersion: "2026-04-12",
        formType: "digital-support-business-plan",
        uid: uid || null,
        submittedAt: new Date().toISOString(),
      },
      basic: {
        tradeName: answers.tradeName?.trim() || null,
        openingDate: answers.openingDate?.trim() || null,
        fullName: answers.fullName?.trim() || null,
        officeAddress: answers.officeAddress?.trim() || null,
        phone: answers.phone?.trim() || null,
        email: answers.email?.trim() || null,
        employeeCount: answers.employeeCount?.trim() || null,
        homepageUrl: answers.homepageUrl?.trim() || null,
      },
      bankAccount: {
        bankType: answers.bankType || null,
        yuchoSymbol: answers.yuchoSymbol?.trim() || null,
        yuchoPassbookNumber: answers.yuchoPassbookNumber?.trim() || null,
        yuchoAccountHolder: answers.yuchoAccountHolder?.trim() || null,
        yuchoAccountHolderKana: answers.yuchoAccountHolderKana?.trim() || null,
        otherBankName: answers.otherBankName?.trim() || null,
        otherBankCode: answers.otherBankCode?.trim() || null,
        otherBranchName: answers.otherBranchName?.trim() || null,
        otherBranchCode: answers.otherBranchCode?.trim() || null,
        otherAccountType: answers.otherAccountType || null,
        otherAccountNumber: answers.otherAccountNumber?.trim() || null,
        otherAccountHolder: answers.otherAccountHolder?.trim() || null,
        otherAccountHolderKana: answers.otherAccountHolderKana?.trim() || null,
      },
      businessOverview: {
        businessContent: answers.businessContent?.trim() || null,
        mainProductService: answers.mainProductService?.trim() || null,
        businessStrength: answers.businessStrength?.trim() || null,
        openingBackground: answers.openingBackground?.trim() || null,
        businessScale: answers.businessScale?.trim() || null,
      },
      marketCompetition: {
        targetMarket: answers.targetMarket?.trim() || null,
        targetCustomerProfile: answers.targetCustomerProfile?.trim() || null,
        competitors: answers.competitors?.trim() || null,
        strengthsAndChallenges: answers.strengthsAndChallenges?.trim() || null,
      },
      supportApplication: {
        supportPurpose: answers.supportPurpose?.trim() || null,
        supportGoal: answers.supportGoal?.trim() || null,
        investmentPlan: answers.investmentPlan?.trim() || null,
        expectedOutcome: answers.expectedOutcome?.trim() || null,
      },
      businessStructure: {
        ownerCareer: answers.ownerCareer?.trim() || null,
        staffRoles: answers.staffRoles?.trim() || null,
        futureHiring: answers.futureHiring?.trim() || null,
      },
      businessPlan: {
        shortTermGoal: answers.shortTermGoal?.trim() || null,
        midTermGoal: answers.midTermGoal?.trim() || null,
        longTermGoal: answers.longTermGoal?.trim() || null,
        salesStrategy: answers.salesStrategy?.trim() || null,
      },
      financial: {
        futureInvestmentPlan: answers.futureInvestmentPlan?.trim() || null,
        debtInfo: answers.debtInfo?.trim() || null,
      },
    };

    const structuredFileUrls: Prisma.InputJsonValue | null =
      fileUrls && typeof fileUrls === "object"
        ? (fileUrls as Prisma.InputJsonValue)
        : null;

    const created = await prisma.hojoFormSubmission.create({
      data: {
        formType: "business-plan",
        companyName: answers.tradeName?.trim() || null,
        representName: answers.fullName?.trim() || null,
        email: answers.email?.trim() || null,
        phone: answers.phone?.trim() || null,
        answers: structuredAnswers,
        fileUrls: structuredFileUrls ?? Prisma.JsonNull,
      },
    });

    if (uid) {
      try {
        const lineFriend = await prisma.hojoLineFriendJoseiSupport.findUnique({
          where: { uid: String(uid) },
          select: {
            applicationSupports: {
              where: { deletedAt: null },
              select: { id: true },
            },
          },
        });
        const apps = lineFriend?.applicationSupports ?? [];
        if (apps.length > 0) {
          await prisma.hojoApplicationSupport.updateMany({
            where: { id: { in: apps.map((a) => a.id) } },
            data: { formAnswerDate: new Date() },
          });
        }
        if (apps.length === 1) {
          await prisma.hojoFormSubmission.update({
            where: { id: created.id },
            data: {
              linkedApplicationSupportId: apps[0].id,
              linkedAt: new Date(),
            },
          });
        }
      } catch (e) {
        console.error("[BusinessPlan] formAnswerDate/link update error:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[BusinessPlan] submit error:", err);
    return NextResponse.json(
      { error: "送信に失敗しました" },
      { status: 500 },
    );
  }
}
