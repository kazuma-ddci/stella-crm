import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formType, vendorToken, answers } = body;

    if (!formType || !vendorToken || !answers) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    if (formType !== "loan-corporate" && formType !== "loan-individual") {
      return NextResponse.json(
        { error: "無効なフォームタイプです" },
        { status: 400 }
      );
    }

    // ベンダートークンからベンダー情報を取得
    const vendor = await prisma.hojoVendor.findUnique({
      where: { accessToken: vendorToken },
      select: { id: true, name: true, isActive: true },
    });

    if (!vendor || !vendor.isActive) {
      return NextResponse.json(
        { error: "無効なベンダー情報です" },
        { status: 400 }
      );
    }

    // 回答データにベンダー情報を埋め込む
    const answersWithVendor = {
      ...answers,
      _vendorId: vendor.id,
      _vendorName: vendor.name,
    };

    // companyName / representName の抽出
    let companyName: string | null = null;
    let representName: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;

    if (formType === "loan-corporate") {
      companyName = answers.corp_company_name || null;
      representName = answers.corp_rep_name || null;
      email = answers.corp_email || null;
      phone = answers.corp_phone || null;
    } else {
      companyName = answers.ind_business_name || null;
      representName = answers.ind_name || null;
      email = answers.ind_email || null;
      phone = answers.ind_phone || null;
    }

    // 貸付金額の抽出
    let loanAmount: number | null = null;
    const loanAmountStr = formType === "loan-corporate"
      ? answers.corp_loan_amount
      : answers.ind_loan_amount;
    if (loanAmountStr) {
      const parsed = parseInt(loanAmountStr, 10);
      if (!isNaN(parsed)) loanAmount = parsed;
    }

    const applicantType = formType === "loan-corporate" ? "法人" : "個人事業主";

    const submission = await prisma.hojoFormSubmission.create({
      data: {
        formType,
        companyName,
        representName,
        email,
        phone,
        answers: answersWithVendor,
      },
    });

    // 顧客進捗レコードを自動作成
    await prisma.hojoLoanProgress.create({
      data: {
        formSubmissionId: submission.id,
        vendorId: vendor.id,
        companyName,
        representName,
        loanAmount,
        applicantType,
      },
    });

    return NextResponse.json({ success: true, id: submission.id });
  } catch (err) {
    console.error("[LoanApplication] submit error:", err);
    return NextResponse.json(
      { error: "送信に失敗しました" },
      { status: 500 }
    );
  }
}
