import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { documentId } = await params;
    const body = await request.json();
    const { operatingCompanyId } = body;

    if (!operatingCompanyId) {
      return NextResponse.json(
        { error: "operatingCompanyId は必須です" },
        { status: 400 }
      );
    }

    const operatingCompany = await prisma.operatingCompany.findUnique({
      where: { id: Number(operatingCompanyId) },
      select: { cloudsignClientId: true },
    });

    if (!operatingCompany) {
      return NextResponse.json(
        { error: "運営会社が見つかりません" },
        { status: 404 }
      );
    }

    if (!operatingCompany.cloudsignClientId) {
      return NextResponse.json(
        { error: "この運営会社にはCloudSignクライアントIDが設定されていません" },
        { status: 400 }
      );
    }

    const token = await cloudsignClient.getToken(
      operatingCompany.cloudsignClientId
    );
    await cloudsignClient.sendDocument(token, documentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CloudSign document send error:", error);
    return NextResponse.json(
      { error: "書類の送信に失敗しました" },
      { status: 500 }
    );
  }
}
