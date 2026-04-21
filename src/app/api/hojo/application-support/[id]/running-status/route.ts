import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * 資料生成中状態 + 最新 documents を返す軽量エンドポイント。
 * 資料保管モーダルのポーリング用（router.refresh を避けページ全体SSRを回避）。
 * 並列実行時、各資料は完了した順に documents に反映されるので、
 * クライアントはこのレスポンスで順次タブの表示を更新できる。
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
    select: {
      trainingReportRunningAt: true,
      supportApplicationRunningAt: true,
      businessPlanRunningAt: true,
      documents: {
        select: {
          docType: true,
          filePath: true,
          fileName: true,
          generatedAt: true,
          generatedSections: true,
          editedSections: true,
          modelName: true,
          inputTokens: true,
          outputTokens: true,
          cacheReadTokens: true,
          cacheCreationTokens: true,
          costUsd: true,
          previousFilePath: true,
        },
      },
    },
  });
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    runningByDocType: {
      trainingReport: record.trainingReportRunningAt?.toISOString() ?? null,
      supportApplication: record.supportApplicationRunningAt?.toISOString() ?? null,
      businessPlan: record.businessPlanRunningAt?.toISOString() ?? null,
    },
    documents: record.documents.map((d) => ({
      docType: d.docType,
      filePath: d.filePath,
      fileName: d.fileName,
      generatedAt: d.generatedAt.toISOString(),
      generatedSections: (d.generatedSections as Record<string, string> | null) ?? null,
      editedSections: (d.editedSections as Record<string, string> | null) ?? null,
      modelName: d.modelName,
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
      cacheReadTokens: d.cacheReadTokens,
      cacheCreationTokens: d.cacheCreationTokens,
      costUsd: d.costUsd ? d.costUsd.toString() : null,
      hasPreviousBackup: !!d.previousFilePath,
    })),
  });
}
