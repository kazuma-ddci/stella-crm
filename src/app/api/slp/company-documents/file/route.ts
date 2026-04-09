import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
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
 * SLP公的提出書類のファイル配信API（CRM管理画面用）
 *
 * 入力: ?id=xxx[&dl=1]
 *
 * 認証: スタッフ（middleware で /api 自体は通過するが、ここで session を再確認する）
 * SLP プロジェクトの権限がない場合は弾く。
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // SLP プロジェクト権限チェック（view 以上）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions = ((session.user as any).permissions ?? []) as Array<{
    projectCode: string;
    permissionLevel: string;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loginId = (session.user as any).loginId as string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizationRole = (session.user as any).organizationRole ?? "member";
  const isAdmin = loginId === "admin";
  const isFounder = organizationRole === "founder";
  const slpPerm = permissions.find((p) => p.projectCode === "slp");
  const hasSlpAccess = !!slpPerm && slpPerm.permissionLevel !== "none";
  if (!isAdmin && !isFounder && !hasSlpAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const idParam = request.nextUrl.searchParams.get("id");
  const downloadMode = request.nextUrl.searchParams.get("dl") === "1";
  if (!idParam) {
    return NextResponse.json({ error: "idが必須です" }, { status: 400 });
  }
  const documentId = Number(idParam);
  if (!Number.isFinite(documentId)) {
    return NextResponse.json({ error: "idが不正です" }, { status: 400 });
  }

  // 削除済みも閲覧可能か？ → 論理削除されたものは管理画面でも非表示にしたいので除外
  const doc = await prisma.slpCompanyDocument.findFirst({
    where: { id: documentId, deletedAt: null },
  });
  if (!doc) {
    return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
  }

  const abs = resolveCompanyDocumentAbsolutePath(doc.filePath);
  if (!abs) {
    return NextResponse.json({ error: "ファイルパスが不正です" }, { status: 500 });
  }
  try {
    const buf = await readFile(abs);
    const ext = path.extname(doc.fileName).toLowerCase();
    const contentType =
      doc.mimeType ?? MIME_TYPES_BY_EXT[ext] ?? "application/octet-stream";
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
