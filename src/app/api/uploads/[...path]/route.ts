import { NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

// XSS リスクのある拡張子(ブラウザ内でスクリプト実行され得る)は強制ダウンロードにする
const FORCE_ATTACHMENT_EXTENSIONS = new Set([
  ".svg", // SVG は <script> を含められる
  ".html",
  ".htm",
  ".xml",
  ".xhtml",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // BBS / ベンダー / 貸金業社ユーザーは /api/uploads/* 経由のファイル取得を一切許可しない。
  // 彼らは独自のページ(/hojo/bbs, /hojo/vendor, /hojo/lender)からだけ操作する想定で、
  // CRM 内部の uploads にアクセスする正当な理由がない。
  // 外部ユーザー(顧客 / userType=external)は portal で proposal/contract 等を
  // 開く必要があるため許可するが、リソース所有権チェックは個別 API でないため、
  // file path がランダム性(timestamp)を持つことに依存している。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = (session.user as any).userType;
  if (userType === "bbs" || userType === "vendor" || userType === "lender") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { path: pathSegments } = await params;
  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    ...pathSegments
  );

  // パストラバーサル防止
  const resolved = path.resolve(filePath);
  const allowedDir = path.resolve(
    path.join(process.cwd(), "public", "uploads")
  );
  if (!resolved.startsWith(allowedDir + path.sep)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const file = await fs.readFile(resolved);
    const filename = path.basename(resolved);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // SVG 等は inline 表示すると <script> 実行で XSS になり得るので強制ダウンロード
    const disposition = FORCE_ATTACHMENT_EXTENSIONS.has(ext)
      ? "attachment"
      : "inline";

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
        // セキュリティ: ブラウザの content-type sniffing を無効化
        "X-Content-Type-Options": "nosniff",
        // セキュリティ: ファイル内容によるスクリプト実行を全面禁止(CSP)
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
