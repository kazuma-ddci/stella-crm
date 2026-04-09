import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, answers } = body;

    if (!answers) {
      return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
    }

    const answersWithMeta = { ...answers, _uid: uid || null };

    await prisma.hojoFormSubmission.create({
      data: {
        formType: "business-plan",
        companyName: answers.tradeName?.trim() || null,
        representName: answers.contactPerson?.trim() || null,
        email: answers.businessEmail?.trim() || null,
        phone: answers.mainPhone?.trim() || null,
        answers: answersWithMeta,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[BusinessPlan] submit error:", err);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
