import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canView as canViewProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import {
  buildDisplayFileName,
  contentDispositionForDownload,
} from "@/lib/hojo/document-filename";

export const runtime = "nodejs";

const ALLOWED_DOC_TYPES = new Set(["training_report", "support_application", "business_plan"]);

/**
 * 申請者の特定資料PDFを配信する。
 * 認可:
 * - 社内スタッフ: hojo view 権限以上
 * - ベンダー: session.user.vendorId === applicationSupport.vendorId
 *
 * 通常の /uploads/ 経由はベンダーには 403 で塞がれているので、
 * このエンドポイント経由でのみベンダーは PDF を閲覧できる。
 *
 * クエリパラメータ `dl=1` で強制ダウンロード（Content-Disposition: attachment）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docType: string }> },
) {
  const session = await auth();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, docType } = await params;
  const applicationSupportId = Number(id);
  if (!Number.isFinite(applicationSupportId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: "invalid docType" }, { status: 400 });
  }

  const record = await prisma.hojoApplicationSupport.findUnique({
    where: { id: applicationSupportId },
    select: {
      id: true,
      applicantName: true,
      vendorId: true,
      lineFriend: { select: { snsname: true } },
      documents: {
        where: { docType },
        select: { docType: true, filePath: true, generatedAt: true },
      },
    },
  });
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 認可
  let allowed = false;
  if (user.userType === "staff") {
    const perms = (user.permissions ?? []) as UserPermission[];
    allowed = canViewProject(perms, "hojo");
  } else if (user.userType === "vendor") {
    const sessionVendorId = (user as { vendorId?: number | null }).vendorId;
    allowed = !!sessionVendorId && sessionVendorId === record.vendorId;
  }
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const doc = record.documents[0];
  if (!doc) {
    return NextResponse.json({ error: "document not found" }, { status: 404 });
  }

  // filePath は "/uploads/..." で始まる。public/ からの相対パスとして読み込む。
  const absPath = path.join(process.cwd(), "public", doc.filePath);
  const allowedDir = path.resolve(path.join(process.cwd(), "public", "uploads"));
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(allowedDir + path.sep)) {
    return NextResponse.json({ error: "forbidden path" }, { status: 403 });
  }

  const buf = await fs.readFile(resolved);
  const displayName = record.applicantName || record.lineFriend?.snsname || null;
  const fileName = buildDisplayFileName(docType, displayName, doc.generatedAt);

  const url = new URL(req.url);
  const forceDownload = url.searchParams.get("dl") === "1";

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": forceDownload
        ? contentDispositionForDownload(fileName)
        : `inline; filename="${fileName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
