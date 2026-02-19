import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exportSlideToPdf } from "@/lib/proposals/slide-generator";
import fs from "fs/promises";
import path from "path";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PDF保存（GoogleスライドからPDFをエクスポートしてCRMに保存）
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const proposal = await prisma.stpProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return NextResponse.json({ error: "提案書が見つかりません" }, { status: 404 });
    }

    // GoogleスライドのファイルIDが必要
    if (!proposal.externalUrl || proposal.externalService !== "google_slides") {
      return NextResponse.json(
        { error: "Googleスライドが生成されていません。先にスライドを生成してください。" },
        { status: 400 },
      );
    }

    // externalUrl からファイルIDを抽出
    const match = proposal.externalUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return NextResponse.json({ error: "GoogleスライドのURLが不正です" }, { status: 400 });
    }
    const slideFileId = match[1];

    // GoogleスライドからPDFをエクスポート
    const pdfBuffer = await exportSlideToPdf(slideFileId);

    // ローカルにPDF保存
    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const uploadDir = path.join(process.cwd(), "public/uploads/proposals", yearMonth);
    await fs.mkdir(uploadDir, { recursive: true });

    const pdfFileName = `proposal-${proposalId}-${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, pdfFileName);
    const publicPath = `/uploads/proposals/${yearMonth}/${pdfFileName}`;

    await fs.writeFile(filePath, pdfBuffer);

    // DB更新
    const companyName = proposal.title.replace(/ 様向け提案書.*$/, "") || "提案書";
    await prisma.stpProposal.update({
      where: { id: proposalId },
      data: {
        filePath: publicPath,
        fileName: `${companyName}_提案書.pdf`,
      },
    });

    return NextResponse.json({
      success: true,
      filePath: publicPath,
    });
  } catch (error) {
    console.error("PDF保存エラー:", error);
    return NextResponse.json(
      { error: "PDF保存に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * PDFダウンロード
 * - ?slideFileId=xxx : 指定スライドからオンザフライでPDF生成（保存なし）
 * - それ以外: 保存済みPDFを返す
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const slideFileId = request.nextUrl.searchParams.get("slideFileId");

    // オンザフライPDF生成（保存なし、プレビュー用）
    if (slideFileId) {
      const pdfBuffer = await exportSlideToPdf(slideFileId);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent("提案書プレビュー.pdf")}"`,
        },
      });
    }

    // 保存済みPDFを返す
    const proposal = await prisma.stpProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return NextResponse.json({ error: "提案書が見つかりません" }, { status: 404 });
    }

    if (!proposal.filePath) {
      return NextResponse.json({ error: "PDFが保存されていません" }, { status: 404 });
    }

    const localPath = path.join(process.cwd(), "public", proposal.filePath);
    const buffer = await fs.readFile(localPath);
    const fileName = proposal.fileName || `${proposalId}_提案書.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error("PDFダウンロードエラー:", error);
    return NextResponse.json(
      { error: "PDFの取得に失敗しました" },
      { status: 500 },
    );
  }
}
