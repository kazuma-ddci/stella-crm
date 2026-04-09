import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * SLP公的提出書類フォームの初期化API
 *
 * 入力: ?uid=xxx[&companyRecordId=N]
 *
 * フロー:
 *   1. uid を検証して SlpLineFriend を取得
 *   2. その LineFriend が担当者になっている企業（SlpCompanyRecord）を一覧で返す
 *   3. companyRecordId が指定されていれば、その企業に既に提出されている書類一覧も同梱
 *
 * 担当企業が複数ある場合はフロント側で企業選択させる前提。
 *
 * レスポンス（成功）:
 *   {
 *     authorized: true,
 *     uid: "...",
 *     snsname: "...",
 *     companies: [{ id, name }, ...],
 *     documents?: [...] (companyRecordId指定時のみ)
 *   }
 *
 * レスポンス（失敗）:
 *   { authorized: false, reason: "missing_uid" | "uid_not_found" | "no_companies" }
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid")?.trim();
  const companyRecordIdParam = request.nextUrl.searchParams
    .get("companyRecordId")
    ?.trim();

  if (!uid) {
    return NextResponse.json(
      { authorized: false, reason: "missing_uid" },
      { status: 400 },
    );
  }

  // 1. uid 検証
  const lineFriend = await prisma.slpLineFriend.findUnique({
    where: { uid },
    select: {
      id: true,
      uid: true,
      snsname: true,
      sei: true,
      mei: true,
      deletedAt: true,
    },
  });

  if (!lineFriend || lineFriend.deletedAt) {
    return NextResponse.json(
      { authorized: false, reason: "uid_not_found" },
      { status: 404 },
    );
  }

  // 2. 担当企業を取得
  const contacts = await prisma.slpCompanyContact.findMany({
    where: { lineFriendId: lineFriend.id },
    include: {
      companyRecord: {
        select: {
          id: true,
          companyName: true,
          deletedAt: true,
        },
      },
    },
  });

  const companies = contacts
    .map((c) => c.companyRecord)
    .filter((r): r is NonNullable<typeof r> => !!r && !r.deletedAt)
    // 重複排除（同じ友達が同じ企業の複数担当者になっているケース）
    .filter(
      (r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx,
    )
    .map((r) => ({
      id: r.id,
      name: r.companyName ?? `企業 #${r.id}`,
    }));

  if (companies.length === 0) {
    return NextResponse.json(
      { authorized: false, reason: "no_companies" },
      { status: 403 },
    );
  }

  // 3. companyRecordId 指定時は書類一覧も同梱
  let documents: Array<{
    id: number;
    category: string;
    documentType: string;
    fiscalPeriod: number | null;
    fileName: string;
    fileSize: number | null;
    mimeType: string | null;
    isCurrent: boolean;
    uploadedByName: string | null;
    uploadedByUid: string | null;
    createdAt: string;
  }> | undefined;

  if (companyRecordIdParam) {
    const companyRecordId = Number(companyRecordIdParam);
    if (Number.isFinite(companyRecordId) && companies.some((c) => c.id === companyRecordId)) {
      const docs = await prisma.slpCompanyDocument.findMany({
        where: {
          companyRecordId,
          deletedAt: null,
        },
        orderBy: [
          { category: "asc" },
          { documentType: "asc" },
          { fiscalPeriod: "asc" },
          { createdAt: "desc" },
        ],
      });
      documents = docs.map((d) => ({
        id: d.id,
        category: d.category,
        documentType: d.documentType,
        fiscalPeriod: d.fiscalPeriod,
        fileName: d.fileName,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        isCurrent: d.isCurrent,
        uploadedByName: d.uploadedByName,
        uploadedByUid: d.uploadedByUid,
        createdAt: d.createdAt.toISOString(),
      }));
    }
  }

  const displayName =
    lineFriend.snsname ??
    [lineFriend.sei, lineFriend.mei].filter(Boolean).join(" ").trim() ??
    "";

  return NextResponse.json({
    authorized: true,
    uid: lineFriend.uid,
    snsname: displayName,
    companies,
    ...(documents !== undefined ? { documents } : {}),
  });
}
