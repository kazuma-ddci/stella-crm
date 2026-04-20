import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * 資料生成中状態だけを返す軽量エンドポイント。
 * 資料保管モーダルのポーリング用（router.refresh の代替、ページ全体SSRを回避）。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const record = await prisma.hojoApplicationSupport.findUnique({
    where: { id: numId },
    select: { pdfGenerationRunningAt: true, pdfGenerationRunningDocType: true },
  });
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    runningDocType: record.pdfGenerationRunningDocType,
    runningStartedAt: record.pdfGenerationRunningAt?.toISOString() ?? null,
  });
}
