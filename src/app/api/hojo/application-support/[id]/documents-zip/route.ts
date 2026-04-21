import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canView as canViewProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import {
  buildDisplayFileName,
  buildZipFileName,
  contentDispositionForDownload,
} from "@/lib/hojo/document-filename";

export const runtime = "nodejs";

/**
 * 申請者の資料PDFをZIPで一括ダウンロードする。
 * 認可:
 * - 社内スタッフ: hojo view 権限以上
 * - ベンダー: session.user.vendorId === applicationSupport.vendorId
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const applicationSupportId = Number(id);
  if (!Number.isFinite(applicationSupportId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const record = await prisma.hojoApplicationSupport.findUnique({
    where: { id: applicationSupportId },
    select: {
      id: true,
      applicantName: true,
      vendorId: true,
      lineFriend: { select: { snsname: true } },
      documents: {
        select: { docType: true, filePath: true, fileName: true, generatedAt: true },
      },
    },
  });
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 認可チェック
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

  if (record.documents.length === 0) {
    return NextResponse.json({ error: "no documents" }, { status: 404 });
  }

  const displayName = record.applicantName || record.lineFriend?.snsname || null;

  // 各PDFを読み込んで zip に詰める
  const zip = new JSZip();
  for (const d of record.documents) {
    const absPath = path.join(process.cwd(), "public", d.filePath);
    try {
      const buf = await fs.readFile(absPath);
      const entryName = buildDisplayFileName(d.docType, displayName, d.generatedAt);
      zip.file(entryName, buf);
    } catch (e) {
      console.error(`[documents-zip] read failed: ${absPath}`, e);
      // 1ファイル読めなくても他は出す
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const zipName = buildZipFileName(displayName);

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDispositionForDownload(zipName),
      "Cache-Control": "private, no-store",
    },
  });
}
