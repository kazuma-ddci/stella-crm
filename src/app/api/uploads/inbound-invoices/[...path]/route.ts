import { NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // 認証チェック
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "inbound-invoices",
    ...pathSegments
  );

  // パストラバーサル防止
  const resolved = path.resolve(filePath);
  const allowedDir = path.resolve(
    path.join(process.cwd(), "public", "uploads", "inbound-invoices")
  );
  if (!resolved.startsWith(allowedDir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const file = await fs.readFile(resolved);
    const filename = path.basename(resolved);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
