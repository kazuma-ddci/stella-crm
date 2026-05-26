import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FORM_UPDATE_STATUS,
  formTypeFromApplicantType,
  mergeFixedLoanAnswers,
} from "@/lib/hojo/loan-progress-wholesale";

function extractContact(formType: string, answers: Record<string, unknown>) {
  if (formType === "loan-corporate") {
    return {
      representName: answers.corp_rep_name ? String(answers.corp_rep_name) : null,
      email: answers.corp_email ? String(answers.corp_email) : null,
      phone: answers.corp_phone ? String(answers.corp_phone) : null,
    };
  }
  return {
    representName: answers.ind_name ? String(answers.ind_name) : null,
    email: answers.ind_email ? String(answers.ind_email) : null,
    phone: answers.ind_phone ? String(answers.ind_phone) : null,
  };
}

async function loadProgressByToken(token: string) {
  return prisma.hojoLoanProgress.findUnique({
    where: { formToken: token },
    include: {
      vendor: { select: { id: true, name: true, isActive: true } },
      wholesaleAccount: true,
      formSubmission: true,
    },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "無効なURLです" }, { status: 400 });
  }

  const progress = await loadProgressByToken(token);
  if (
    !progress ||
    progress.deletedAt ||
    !progress.vendor.isActive ||
    !progress.wholesaleAccount ||
    progress.wholesaleAccount.deletedAt ||
    progress.wholesaleAccount.deletedByVendor
  ) {
    return NextResponse.json({ error: "無効なURLです" }, { status: 404 });
  }

  const formType = formTypeFromApplicantType(progress.wholesaleAccount.applicantType);
  if (!formType) {
    return NextResponse.json({ error: "法人/個人区分が未設定です" }, { status: 400 });
  }

  return NextResponse.json({
    progressId: progress.id,
    formType,
    applicantType: progress.wholesaleAccount.applicantType,
    companyName: progress.wholesaleAccount.companyName ?? "",
    loanAmount: progress.wholesaleAccount.subsidyTargetAmountTaxIncluded ?? null,
    alreadySubmitted: progress.formSubmissionId != null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formType, formToken, answers } = body;

    if (!formType || !formToken || !answers) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    const progress = await loadProgressByToken(String(formToken));
    if (
      !progress ||
      progress.deletedAt ||
      !progress.vendor.isActive ||
      !progress.wholesaleAccount ||
      progress.wholesaleAccount.deletedAt ||
      progress.wholesaleAccount.deletedByVendor
    ) {
      return NextResponse.json({ error: "無効なURLです" }, { status: 400 });
    }

    const expectedFormType = formTypeFromApplicantType(progress.wholesaleAccount.applicantType);
    if (!expectedFormType || formType !== expectedFormType) {
      return NextResponse.json({ error: "無効なフォームタイプです" }, { status: 400 });
    }

    const fixedAnswers = mergeFixedLoanAnswers(
      formType,
      answers as Record<string, unknown>,
      progress.wholesaleAccount,
    );

    const answersWithVendor = {
      ...fixedAnswers,
      _vendorId: progress.vendor.id,
      _vendorName: progress.vendor.name,
      _wholesaleAccountId: progress.wholesaleAccount.id,
      _loanProgressId: progress.id,
    };

    const contact = extractContact(formType, answersWithVendor);
    const companyName = progress.wholesaleAccount.companyName ?? null;
    const loanAmount = progress.wholesaleAccount.subsidyTargetAmountTaxIncluded ?? null;
    const applicantType = progress.wholesaleAccount.applicantType ?? null;

    if (progress.formSubmissionId) {
      await prisma.hojoLoanProgress.update({
        where: { id: progress.id },
        data: {
          pendingFormType: formType,
          pendingAnswers: answersWithVendor,
          formUpdateStatus: FORM_UPDATE_STATUS.PENDING,
        },
      });
      return NextResponse.json({ success: true, mode: "pending" });
    }

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.hojoFormSubmission.create({
        data: {
          formType,
          companyName,
          representName: contact.representName,
          email: contact.email,
          phone: contact.phone,
          answers: answersWithVendor,
        },
      });

      await tx.hojoLoanProgress.update({
        where: { id: progress.id },
        data: {
          formSubmissionId: created.id,
          companyName,
          representName: contact.representName,
          loanAmount,
          applicantType,
          formUpdateStatus: FORM_UPDATE_STATUS.SUBMITTED,
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, id: submission.id, mode: "created" });
  } catch (err) {
    console.error("[LoanApplication] submit error:", err);
    return NextResponse.json(
      { error: "送信に失敗しました" },
      { status: 500 }
    );
  }
}
