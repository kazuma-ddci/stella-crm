import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { resolveCompanyDocumentAbsolutePath } from "@/lib/slp/document-storage";

const MIME_TYPES_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * SLP公的提出書類のファイル配信API（公開フォーム用）
 *
 * 入力: ?id=xxx&uid=yyy[&dl=1]
 *
 * 検証:
 *   1. uid の SlpLineFriend が存在
 *   2. その LineFriend が書類の所属企業の担当者である
 *   3. 書類が論理削除されていない
 *
 * dl=1 を渡すと Content-Disposition: attachment になりダウンロードに切り替わる。
 */
export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id");
  const uid = request.nextUrl.searchParams.get("uid")?.trim();
  const downloadMode = request.nextUrl.searchParams.get("dl") === "1";

  if (!idParam || !uid) {
    return NextResponse.json({ error: "id/uidが必須です" }, { status: 400 });
  }
  const documentId = Number(idParam);
  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "idが不正です" }, { status: 400 });
  }

  // LINE友達取得
  const lineFriend = await prisma.slpLineFriend.findUnique({
    where: { uid },
    select: { id: true, deletedAt: true },
  });
  if (!lineFriend || lineFriend.deletedAt) {
    return NextResponse.json({ error: "提出者情報が見つかりません" }, { status: 403 });
  }

  // 書類取得
  const doc = await prisma.slpCompanyDocument.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
  }

  // 企業所属チェック
  const contact = await prisma.slpCompanyContact.findFirst({
    where: {
      lineFriendId: lineFriend.id,
      companyRecordId: doc.companyRecordId,
    },
    select: { id: true },
  });
  if (!contact) {
    return NextResponse.json({ error: "閲覧権限がありません" }, { status: 403 });
  }

  // ファイル配信
  const abs = resolveCompanyDocumentAbsolutePath(doc.filePath);
  if (!abs) {
    return NextResponse.json({ error: "ファイルパスが不正です" }, { status: 500 });
  }

  try {
    const buf = await readFile(abs);
    const ext = path.extname(doc.fileName).toLowerCase();
    const contentType = doc.mimeType ?? MIME_TYPES_BY_EXT[ext] ?? "application/octet-stream";
    const disposition = downloadMode ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
  }
}
