import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPLICATION_FORM_UPDATE_STATUS } from "@/lib/hojo/application-support-wholesale";

/**
 * 補助金事業計画フォーム 送信API（公開・認証不要）
 *
 * Body (JSON):
 *   - token: string (顧客専用フォームトークン)
 *   - answers: Record<string, string> (フォーム回答)
 *   - fileUrls: Record<string, { filePath, fileName, fileSize, mimeType }> (アップロード済みファイル)
 *
 * answers は構造化されたキーで保存され、後からPDF生成やBBS社への共有に利用される。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, uid, answers, fileUrls } = body;

    if (uid || !token || typeof token !== "string" || !answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "フォームURLが無効です" },
        { status: 400 },
      );
    }

    const applicationSupport = await prisma.hojoApplicationSupport.findUnique({
      where: { formToken: token },
      include: {
        wholesaleAccount: true,
        linkedFormSubmissions: {
          where: { deletedAt: null, formType: "business-plan" },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
    });
    if (
      !applicationSupport ||
      applicationSupport.deletedAt ||
      !applicationSupport.wholesaleAccount ||
      applicationSupport.wholesaleAccount.deletedAt ||
      applicationSupport.wholesaleAccount.deletedByVendor
    ) {
      return NextResponse.json(
        { error: "フォームURLが無効です" },
        { status: 404 },
      );
    }

    // 構造化された回答データにメタ情報を付与
    const structuredAnswers = {
      _meta: {
        formVersion: "2026-04-12",
        formType: "digital-support-business-plan",
        formToken: token,
        applicationSupportId: applicationSupport.id,
        wholesaleAccountId: applicationSupport.wholesaleAccountId,
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
        pastBusinessRecord: answers.pastBusinessRecord?.trim() || null,
        futureInvestmentPlan: answers.futureInvestmentPlan?.trim() || null,
        debtInfo: answers.debtInfo?.trim() || null,
      },
    };

    const structuredFileUrls: Prisma.InputJsonValue | null =
      fileUrls && typeof fileUrls === "object"
        ? (fileUrls as Prisma.InputJsonValue)
        : null;

    const existingSubmission = applicationSupport.linkedFormSubmissions[0] ?? null;
    if (!existingSubmission) {
      await prisma.$transaction(async (tx) => {
        const created = await tx.hojoFormSubmission.create({
          data: {
            formType: "business-plan",
            companyName: answers.tradeName?.trim() || null,
            representName: answers.fullName?.trim() || null,
            email: answers.email?.trim() || null,
            phone: answers.phone?.trim() || null,
            answers: structuredAnswers,
            fileUrls: structuredFileUrls ?? Prisma.JsonNull,
            linkedApplicationSupportId: applicationSupport.id,
            linkedAt: new Date(),
          },
        });
        await tx.hojoApplicationSupport.update({
          where: { id: applicationSupport.id },
          data: {
            formAnswerDate: created.submittedAt,
            formUpdateStatus: APPLICATION_FORM_UPDATE_STATUS.SUBMITTED,
          },
        });
      });
    } else {
      await prisma.hojoApplicationSupport.update({
        where: { id: applicationSupport.id },
        data: {
          pendingAnswers: structuredAnswers as Prisma.InputJsonValue,
          pendingFileUrls: structuredFileUrls ?? Prisma.JsonNull,
          formUpdateStatus: APPLICATION_FORM_UPDATE_STATUS.PENDING,
        },
      });
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
