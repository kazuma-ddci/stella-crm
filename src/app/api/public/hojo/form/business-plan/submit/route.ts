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
      // 基本情報
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
      // 口座情報
      bankAccount: {
        bankType: answers.bankType || null,
        // ゆうちょ
        yuchoSymbol: answers.yuchoSymbol?.trim() || null,
        yuchoPassbookNumber: answers.yuchoPassbookNumber?.trim() || null,
        yuchoAccountHolder: answers.yuchoAccountHolder?.trim() || null,
        yuchoAccountHolderKana: answers.yuchoAccountHolderKana?.trim() || null,
        // 他の金融機関
        otherBankName: answers.otherBankName?.trim() || null,
        otherBankCode: answers.otherBankCode?.trim() || null,
        otherBranchName: answers.otherBranchName?.trim() || null,
        otherBranchCode: answers.otherBranchCode?.trim() || null,
        otherAccountType: answers.otherAccountType || null,
        otherAccountNumber: answers.otherAccountNumber?.trim() || null,
        otherAccountHolder: answers.otherAccountHolder?.trim() || null,
        otherAccountHolderKana: answers.otherAccountHolderKana?.trim() || null,
      },
      // 事業概要
      businessOverview: {
        businessContent: answers.businessContent?.trim() || null,
        mainProductService: answers.mainProductService?.trim() || null,
        businessStrength: answers.businessStrength?.trim() || null,
        openingBackground: answers.openingBackground?.trim() || null,
        businessScale: answers.businessScale?.trim() || null,
      },
      // 市場・競合情報
      marketCompetition: {
        targetMarket: answers.targetMarket?.trim() || null,
        targetCustomerProfile: answers.targetCustomerProfile?.trim() || null,
        competitors: answers.competitors?.trim() || null,
        strengthsAndChallenges: answers.strengthsAndChallenges?.trim() || null,
      },
      // 支援制度申請関連
      supportApplication: {
        supportPurpose: answers.supportPurpose?.trim() || null,
        supportGoal: answers.supportGoal?.trim() || null,
        investmentPlan: answers.investmentPlan?.trim() || null,
        expectedOutcome: answers.expectedOutcome?.trim() || null,
      },
      // 事業体制とご経歴
      businessStructure: {
        ownerCareer: answers.ownerCareer?.trim() || null,
        staffRoles: answers.staffRoles?.trim() || null,
        futureHiring: answers.futureHiring?.trim() || null,
      },
      // 事業計画
      businessPlan: {
        shortTermGoal: answers.shortTermGoal?.trim() || null,
        midTermGoal: answers.midTermGoal?.trim() || null,
        longTermGoal: answers.longTermGoal?.trim() || null,
        salesStrategy: answers.salesStrategy?.trim() || null,
      },
      // 財務情報
      financial: {
        futureInvestmentPlan: answers.futureInvestmentPlan?.trim() || null,
        debtInfo: answers.debtInfo?.trim() || null,
      },
    };

    // ファイルURL情報を構造化
    const structuredFileUrls: Prisma.InputJsonValue | null =
      fileUrls && typeof fileUrls === "object"
        ? (fileUrls as Prisma.InputJsonValue)
        : null;

    await prisma.hojoFormSubmission.create({
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

    // UIDから助成金申請サポートLINE友達を特定し、申請者管理の「フォーム回答日」を自動更新
    if (uid) {
      try {
        const lineFriend = await prisma.hojoLineFriendJoseiSupport.findUnique({
          where: { uid: String(uid) },
          select: { id: true },
        });
        if (lineFriend) {
          await prisma.hojoApplicationSupport.updateMany({
            where: { lineFriendId: lineFriend.id, deletedAt: null },
            data: { formAnswerDate: new Date() },
          });
        }
      } catch (e) {
        console.error("[BusinessPlan] formAnswerDate update error:", e);
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
