import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import {
  getInvoicePdfData,
  generateInvoicePdfBuffer,
} from "@/lib/invoices/pdf-generator";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET: PDFプレビュー / ダウンロード
 * - ?preview=true: オンザフライでPDF生成（保存なし、プレビュー用）
 * - それ以外: 保存済みPDFを返す
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await context.params;
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const isPreview = request.nextUrl.searchParams.get("preview") === "true";
    const projectIdParam = request.nextUrl.searchParams.get("projectId");
    const projectId = projectIdParam ? parseInt(projectIdParam, 10) : undefined;

    // プレビュー: オンザフライでPDF生成
    if (isPreview) {
      const data = await getInvoicePdfData(groupId, projectId);
      const buffer = await generateInvoicePdfBuffer(data);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent("請求書プレビュー.pdf")}"`,
        },
      });
    }

    // 保存済みPDFを返す（projectIdでスコープ）
    const group = await prisma.invoiceGroup.findUnique({
      where: { id: groupId, deletedAt: null, ...(projectId ? { projectId } : {}) },
    });

    if (!group) {
      return NextResponse.json(
        { error: "請求が見つかりません" },
        { status: 404 }
      );
    }

    if (!group.pdfPath) {
      return NextResponse.json(
        { error: "PDFが保存されていません" },
        { status: 404 }
      );
    }

    const localPath = path.join(process.cwd(), "public", group.pdfPath);
    const buffer = await fs.readFile(localPath);
    const fileName =
      group.pdfFileName ?? `請求書_${group.invoiceNumber ?? groupId}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error("請求書PDFエラー:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "PDFの取得に失敗しました",
      },
      { status: 500 }
    );
  }
}
