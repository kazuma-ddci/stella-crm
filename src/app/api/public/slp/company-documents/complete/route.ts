import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * SLP公的 初回提出書類の最終完了API（公開）
 *
 * アップロード自体は /api/public/slp/company-documents/upload で即時保存される。
 * このAPIは、お客様が「全ての書類のアップロードを完了して提出する」ボタンを
 * 押した日時と提出者を企業レコードへ記録する。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";
    const companyRecordId = Number(body?.companyRecordId);

    if (!uid) {
      return NextResponse.json({ error: "uidが指定されていません" }, { status: 400 });
    }
    if (!Number.isFinite(companyRecordId)) {
      return NextResponse.json(
        { error: "companyRecordIdが不正です" },
        { status: 400 },
      );
    }

    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid },
      select: { id: true, uid: true, snsname: true, sei: true, mei: true, deletedAt: true },
    });
    if (!lineFriend || lineFriend.deletedAt) {
      return NextResponse.json(
        { error: "提出者情報が見つかりません" },
        { status: 403 },
      );
    }

    const contact = await prisma.slpCompanyContact.findFirst({
      where: {
        lineFriendId: lineFriend.id,
        companyRecordId,
        companyRecord: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json(
        { error: "この企業へ書類を提出する権限がありません" },
        { status: 403 },
      );
    }

    const fullName = [lineFriend.sei, lineFriend.mei]
      .filter(Boolean)
      .join(" ")
      .trim();
    const completedByName = lineFriend.snsname || fullName || null;
    const completedAt = new Date();

    await prisma.slpCompanyRecord.update({
      where: { id: companyRecordId },
      data: {
        initialDocumentsCompletedAt: completedAt,
        initialDocumentsCompletedByUid: uid,
        initialDocumentsCompletedByName: completedByName,
      },
    });

    return NextResponse.json({
      success: true,
      initialDocumentsCompletedAt: completedAt.toISOString(),
      initialDocumentsCompletedByUid: uid,
      initialDocumentsCompletedByName: completedByName,
    });
  } catch (error) {
    console.error("[SLP_COMPANY_DOC_COMPLETE_ERROR]", error);
    return NextResponse.json(
      { error: "初回提出書類の完了記録に失敗しました" },
      { status: 500 },
    );
  }
}
