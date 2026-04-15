import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { answers } = body;

    if (!answers) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    const companyName = answers.companyName?.trim() || null;
    const representName = answers.representativeName?.trim() || null;
    const email = answers.representativeEmail?.trim() || answers.contactEmail?.trim() || null;
    const phone = answers.representativePhone?.trim() || answers.contactPhone?.trim() || null;

    await prisma.hojoFormSubmission.create({
      data: {
        formType: "contract-confirmation",
        companyName,
        representName,
        email,
        phone,
        answers,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ContractConfirmation] submit error:", err);
    return NextResponse.json(
      { error: "送信に失敗しました" },
      { status: 500 }
    );
  }
}
