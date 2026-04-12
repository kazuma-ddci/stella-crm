import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { authorizeApi } from "@/lib/api-auth";

/**
 * POST /api/cloudsign/documents
 * テンプレートからCloudSign書類ドラフトを作成し、
 * widgets（入力項目）とparticipants（宛先）情報を返す
 *
 * このAPIはテンプレート選択時に呼ばれ、送信元が入力すべき項目を取得するために使う
 */
export async function POST(request: NextRequest) {
  try {
    // STP編集 or 経理編集 のスタッフのみ
    const authz = await authorizeApi([
      { project: "stp", level: "edit" },
      { project: "accounting", level: "edit" },
    ]);
    if (!authz.ok) return authz.response;

    const body = await request.json();
    const { operatingCompanyId, templateId, title } = body;

    if (!operatingCompanyId || !templateId || !title) {
      return NextResponse.json(
        { error: "operatingCompanyId, templateId, title は必須です" },
        { status: 400 }
      );
    }

    const operatingCompany = await prisma.operatingCompany.findUnique({
      where: { id: Number(operatingCompanyId) },
      select: { cloudsignClientId: true },
    });

    if (!operatingCompany?.cloudsignClientId) {
      return NextResponse.json(
        { error: "この運営会社にはCloudSignクライアントIDが設定されていません" },
        { status: 400 }
      );
    }

    const token = await cloudsignClient.getToken(
      operatingCompany.cloudsignClientId
    );

    // テンプレートからドラフト書類を作成
    const document = await cloudsignClient.createDocument(token, templateId, title);

    return NextResponse.json(document);
  } catch (error) {
    console.error("CloudSign document creation error:", error);
    return NextResponse.json(
      { error: "書類の作成に失敗しました" },
      { status: 500 }
    );
  }
}
